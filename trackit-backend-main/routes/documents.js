const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Document, Office, DocumentType, StatusLog, User, Attachment, DocumentRecipient } = require('../models');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { requireUser } = require('../middleware/requireUser');
const { userCanAccessDocument } = require('../middleware/documentAccess');
const { createAuditLog, AUDIT_ACTIONS } = require('../utils/auditLog');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'trackit-secret-key';

function deriveStatusPhase(statusValue) {
  const s = String(statusValue || '').toUpperCase();
  if (s.includes('COMPLETED')) return 'COMPLETED';
  if (s.includes('RETURNED')) return 'RETURNED';
  if (s.includes('DECLINED')) return 'DECLINED';
  if (s.includes('ON HOLD')) return 'ON_HOLD';
  if (s.includes('RECEIVED BY')) return 'RECEIVED';
  if (s.includes('RELEASED')) return 'RELEASED';
  if (s.includes('DRAFT')) return 'DRAFT';
  return 'UNKNOWN';
}

function canTransition(action, currentPhase) {
  const rules = {
    receive: ['RELEASED', 'RETURNED'],
    decline: ['RELEASED'],
    return: ['RECEIVED'],
    forward: ['RECEIVED']
  };
  return (rules[action] || []).includes(currentPhase);
}

function canComplete(currentPhase) {
  return currentPhase === 'RECEIVED';
}

const RECIPIENT_STATUS = {
  RELEASED: 'RELEASED',
  RETURNED: 'RETURNED',
  RECEIVED: 'RECEIVED',
  DECLINED: 'DECLINED',
  COMPLETED: 'COMPLETED',
  FORWARDED: 'FORWARDED'
};

const ATTACHMENT_LIMITS = {
  MIN: 1,
  MAX: 5
};

const ROUTING_STATUS_PATTERNS = [
  'FORWARDED BY % TO %',
  'RESENT BY % TO %',
  'RETURNED BY % TO %'
];

function isRecipientTerminal(status) {
  const normalized = String(status || '').toUpperCase();
  return normalized === RECIPIENT_STATUS.DECLINED || normalized === RECIPIENT_STATUS.COMPLETED;
}

function buildRecipientSummary(recipientRows) {
  const rows = Array.isArray(recipientRows) ? recipientRows : [];
  const summary = {
    total: rows.length,
    pending: 0,
    returned: 0,
    received: 0,
    declined: 0,
    completed: 0
  };
  rows.forEach((row) => {
    const status = String(row?.recipient_status || '').toUpperCase();
    if (status === RECIPIENT_STATUS.RELEASED) summary.pending += 1;
    else if (status === RECIPIENT_STATUS.RETURNED) summary.returned += 1;
    else if (status === RECIPIENT_STATUS.RECEIVED) summary.received += 1;
    else if (status === RECIPIENT_STATUS.DECLINED) summary.declined += 1;
    else if (status === RECIPIENT_STATUS.COMPLETED) summary.completed += 1;
  });
  return summary;
}

function countSenderPendingRecipients(recipientRows) {
  const rows = Array.isArray(recipientRows) ? recipientRows : [];
  return rows.reduce((count, row) => {
    const status = String(row?.recipient_status || '').toUpperCase();
    return status === RECIPIENT_STATUS.RELEASED ? count + 1 : count;
  }, 0);
}

function canEditDocumentFromRecipients(recipientRows) {
  const rows = Array.isArray(recipientRows) ? recipientRows : [];
  return !rows.some((row) => {
    const status = String(row?.recipient_status || '').toUpperCase();
    if (status === RECIPIENT_STATUS.RECEIVED) return true;
    if (status === RECIPIENT_STATUS.COMPLETED) return true;
    return false;
  });
}

function normalizeOfficeIds(ids) {
  return Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .filter(Boolean)
        .map((id) => String(id).trim())
        .filter(Boolean)
    )
  );
}

async function findActiveOfficeById(id) {
  if (!id) return null;
  return Office.findOne({ where: { id, is_active: true } });
}

async function findActiveUserById(id) {
  if (!id) return null;
  return User.findOne({ where: { id, is_active: true } });
}

async function resolvePreviousSenderOfficeId({ documentId, currentOfficeId, requesterOfficeId, transaction }) {
  const latestRoutingInbound = await StatusLog.findOne({
    where: {
      document_id: documentId,
      to_office_id: currentOfficeId,
      from_office_id: { [Op.ne]: null },
      [Op.or]: ROUTING_STATUS_PATTERNS.map((pattern) => ({
        status: { [Op.iLike]: pattern }
      })),
      [Op.and]: [
        sequelize.where(sequelize.col('from_office_id'), Op.ne, sequelize.col('to_office_id'))
      ]
    },
    order: [['date', 'DESC'], ['id', 'DESC']],
    transaction
  });

  return latestRoutingInbound?.from_office_id || requesterOfficeId || null;
}

function getAccessTokenFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const queryToken = typeof req.query.access_token === 'string' ? req.query.access_token : '';
  return bearerToken || queryToken || '';
}

async function resolveOfficeScope(req, fallbackOfficeId) {
  const token = getAccessTokenFromRequest(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded?.id) {
        const user = await User.findOne({
          where: { id: decoded.id, is_active: true },
          include: [{ model: Office, as: 'office' }]
        });
        if (!user || !user.office_id) {
          return { error: 'User office is not configured.', status: 403 };
        }
        const office = await findActiveOfficeById(user.office_id);
        if (!office) {
          return { error: 'User office is inactive or invalid.', status: 403 };
        }
        return { officeId: office.id, office };
      }
      return { error: 'Invalid token payload.', status: 401 };
    } catch (err) {
      return { error: 'Invalid or expired token.', status: 401 };
    }
  }

  const office = await findActiveOfficeById(fallbackOfficeId);
  if (!office) {
    return { error: 'Invalid office ID', status: 400 };
  }
  return { officeId: office.id, office };
}

// Helper to map Sequelize document to expected frontend format
const mapDoc = (d) => {
  const obj = d.toJSON();
  obj._id = obj.id;
  obj.status_phase = deriveStatusPhase(obj.status);
  if (obj.type) {
    obj.type_id = { ...obj.type, _id: obj.type.id };
    delete obj.type;
  } else if (obj.type_id) {
    // Keep reference
  }
  if (obj.requester_office) {
    obj.requester_office_id = { ...obj.requester_office, _id: obj.requester_office.id };
    delete obj.requester_office;
  }
  if (obj.current_office) {
    obj.current_office_id = { ...obj.current_office, _id: obj.current_office.id };
    delete obj.current_office;
  }
  if (obj.completed_by_user) {
    obj.completed_by_user_id = { ...obj.completed_by_user, _id: obj.completed_by_user.id };
    delete obj.completed_by_user;
  }
  if (obj.completed_by_office) {
    obj.completed_by_office_id = { ...obj.completed_by_office, _id: obj.completed_by_office.id };
    delete obj.completed_by_office;
  }
  if (obj.status_history) {
    // Map nested IDs
    obj.status_history = obj.status_history.map(s => {
      const sh = { ...s };
      if (sh.from_office) sh.from_office_id = { ...sh.from_office, _id: sh.from_office.id };
      if (sh.to_office) sh.to_office_id = { ...sh.to_office, _id: sh.to_office.id };
      return sh;
    });
  }
  if (obj.recipients) {
    obj.recipients = obj.recipients.map((r) => {
      const recipient = { ...r, _id: r.id };
      if (recipient.recipient_office) {
        recipient.recipient_office_id = {
          ...recipient.recipient_office,
          _id: recipient.recipient_office.id
        };
      }
      delete recipient.recipient_office;
      return recipient;
    });
    obj.recipient_summary = buildRecipientSummary(obj.recipients);
    obj.sender_pending_recipient_count = countSenderPendingRecipients(obj.recipients);
    obj.can_edit = canEditDocumentFromRecipients(obj.recipients);
  }
  return obj;
};

// Common includes
const docIncludes = [
  { model: DocumentType, as: 'type' },
  { model: Office, as: 'requester_office' },
  { model: Office, as: 'current_office' },
  { model: User, as: 'completed_by_user', attributes: ['id', 'username'] },
  { model: Office, as: 'completed_by_office' },
  {
    model: StatusLog,
    as: 'status_history',
    include: [
      { model: Office, as: 'from_office' },
      { model: Office, as: 'to_office' }
    ],
    order: [['date', 'ASC'], ['id', 'ASC']]
  }
];

const recipientInclude = {
  model: DocumentRecipient,
  as: 'recipients',
  required: false,
  include: [{ model: Office, as: 'recipient_office' }]
};

// Get all documents
router.get('/', async (req, res) => {
  try {
    const docs = await Document.findAll({ include: [...docIncludes, recipientInclude] });
    res.json(docs.map(mapDoc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create document with dynamic code
router.post('/', async (req, res) => {
  const {
    title,
    content,
    type_id,
    requester_office_id,
    created_by_admin_id,
    status,
    current_office_id,
    forward_to_office_id,
    forward_to_office_ids,
    remarks,
    attachment_count
  } = req.body;
  try {
    const office = await findActiveOfficeById(requester_office_id);
    const docType = await DocumentType.findByPk(type_id);
    if (!office || !docType) {
      return res.status(400).json({ error: 'Invalid office or document type.' });
    }

    const recipientCandidates = [];
    if (Array.isArray(forward_to_office_ids)) recipientCandidates.push(...forward_to_office_ids);
    if (forward_to_office_id) recipientCandidates.push(forward_to_office_id);
    if (current_office_id) recipientCandidates.push(current_office_id);
    const recipientIds = Array.from(new Set(
      recipientCandidates
        .filter(Boolean)
        .map((id) => String(id).trim())
        .filter(Boolean)
    ));
    const initialStatus = (status || 'DRAFT').toUpperCase();
    if (initialStatus === 'RELEASED' && recipientIds.length === 0) {
      return res.status(400).json({ error: 'At least one destination office is required.' });
    }
    if (initialStatus === 'RELEASED') {
      const attachmentCount = Number(attachment_count);
      const isValidCount = Number.isInteger(attachmentCount);
      if (!isValidCount || attachmentCount < ATTACHMENT_LIMITS.MIN || attachmentCount > ATTACHMENT_LIMITS.MAX) {
        return res.status(400).json({
          error: `You must attach between ${ATTACHMENT_LIMITS.MIN} and ${ATTACHMENT_LIMITS.MAX} files before sending.`
        });
      }
    }
    if (recipientIds.some((id) => String(id) === String(requester_office_id))) {
      return res.status(400).json({ error: 'Cannot route document to the sender office.' });
    }

    const destinationOffices = [];
    for (const officeId of recipientIds) {
      const destinationOffice = await findActiveOfficeById(officeId);
      if (!destinationOffice) {
        return res.status(400).json({ error: `Invalid destination office: ${officeId}` });
      }
      destinationOffices.push(destinationOffice);
    }

    const officeCode = office.office_code;
    const typeCode = docType.type_code || docType.type_name.substring(0, 3).toUpperCase();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const monthStart = new Date(`${year}-${month}-01T00:00:00Z`);
    const monthEnd = new Date(year, now.getMonth() + 1, 1);

    const count = await Document.count({
      where: {
        type_id,
        requester_office_id,
        created_at: { [Op.gte]: monthStart, [Op.lt]: monthEnd }
      }
    });

    const serialStr = String(count + 1).padStart(4, '0');
    const document_code = `${typeCode}-${officeCode}-${year}-${month}-${serialStr}`;

    const transaction = await sequelize.transaction();
    try {
      const firstRecipientId = destinationOffices.length ? destinationOffices[0].id : null;
      let doc = await Document.create({
        document_code,
        title,
        content,
        type_id,
        requester_office_id,
        created_by_admin_id,
        status: status || 'DRAFT',
        current_office_id: firstRecipientId
      }, { transaction });

      if (initialStatus === 'RELEASED') {
        const normalizedRemarks = String(remarks || '').trim();
        for (const destinationOffice of destinationOffices) {
          await DocumentRecipient.create({
            document_id: doc.id,
            recipient_office_id: destinationOffice.id,
            recipient_status: RECIPIENT_STATUS.RELEASED,
            last_action_at: now,
            latest_remarks: normalizedRemarks || null,
            created_at: now,
            updated_at: now
          }, { transaction });

          await createAuditLog({
            documentId: doc.id,
            status: `FORWARDED BY ${office.office_name} TO ${destinationOffice.office_name}`,
            fromOfficeId: requester_office_id || null,
            toOfficeId: destinationOffice.id,
            userId: created_by_admin_id || null,
            timestamp: now,
            remarks: normalizedRemarks || 'Document released',
            transaction
          });
        }
      }

      await transaction.commit();
      doc = await Document.findByPk(doc.id, { include: [...docIncludes, recipientInclude] });
      return res.json(mapDoc(doc));
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Update document
router.put('/:id', requireUser, async (req, res) => {
  const { title, content, type_id, remarks, forward_to_office_id, forward_to_office_ids, document_code } = req.body;
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const requesterOfficeId = String(doc.requester_office_id || '');
    const actorOfficeId = String(req.userRecord?.office_id || '');
    if (!requesterOfficeId || requesterOfficeId !== actorOfficeId) {
      return res.status(403).json({ error: 'Only the sender office can edit this outgoing document.' });
    }

    const recipientRows = await DocumentRecipient.findAll({
      where: { document_id: doc.id }
    });
    const canEdit = canEditDocumentFromRecipients(recipientRows);
    if (!canEdit) {
      return res.status(409).json({
        error: 'Document can no longer be edited because at least one destination office already received it.'
      });
    }
    const requesterRecipientRow = recipientRows.find(
      (row) => String(row?.recipient_office_id || '') === requesterOfficeId
    );
    const isReturnedToRequester = String(requesterRecipientRow?.recipient_status || '').toUpperCase() === RECIPIENT_STATUS.RETURNED;

    if (document_code && String(document_code).trim() !== String(doc.document_code || '').trim()) {
      return res.status(409).json({ error: 'Document code cannot be changed for edited/resend documents.' });
    }

    const nextTitle = typeof title === 'string' ? title.trim() : doc.title;
    const nextContent = typeof content === 'string' ? content.trim() : doc.content;
    const nextTypeId = type_id || doc.type_id;
    const selectedType = await DocumentType.findByPk(nextTypeId);
    if (!selectedType) {
      return res.status(400).json({ error: 'Invalid document type.' });
    }

    const rerouteCandidates = [];
    if (Array.isArray(forward_to_office_ids)) rerouteCandidates.push(...forward_to_office_ids);
    if (forward_to_office_id) rerouteCandidates.push(forward_to_office_id);
    const rerouteOfficeIds = normalizeOfficeIds(rerouteCandidates);
    const senderOffice = await findActiveOfficeById(req.userRecord.office_id);
    if (!senderOffice) {
      return res.status(400).json({ error: 'Invalid or inactive sender office.' });
    }
    if (rerouteOfficeIds.some((id) => String(id) === String(senderOffice.id))) {
      return res.status(400).json({ error: 'Cannot route document to the sender office.' });
    }
    const rerouteOffices = [];
    for (const officeId of rerouteOfficeIds) {
      const destinationOffice = await findActiveOfficeById(officeId);
      if (!destinationOffice) {
        return res.status(400).json({ error: `Invalid destination office: ${officeId}` });
      }
      rerouteOffices.push(destinationOffice);
    }
    if (isReturnedToRequester && !rerouteOffices.length) {
      return res.status(400).json({ error: 'Select at least one destination office to resend this returned document.' });
    }

    const now = new Date();
    const normalizedRemarks = String(remarks || '').trim();
    const transaction = await sequelize.transaction();
    try {
      await doc.update({
        title: nextTitle,
        content: nextContent,
        type_id: nextTypeId,
        updated_at: now
      }, { transaction });

      await createAuditLog({
        documentId: doc.id,
        status: `EDITED BY ${req.userRecord.office?.office_name || 'OFFICE'}`,
        fromOfficeId: req.userRecord.office_id || null,
        toOfficeId: null,
        userId: req.userRecord.id || null,
        timestamp: now,
        remarks: normalizedRemarks || 'Document details updated',
        transaction
      });

      if (rerouteOffices.length) {
        for (const destinationOffice of rerouteOffices) {
          await DocumentRecipient.upsert({
            document_id: doc.id,
            recipient_office_id: destinationOffice.id,
            recipient_status: RECIPIENT_STATUS.RELEASED,
            last_action_at: now,
            latest_remarks: normalizedRemarks || null,
            created_at: now,
            updated_at: now
          }, { transaction });

          await createAuditLog({
            documentId: doc.id,
            status: `RESENT BY ${senderOffice.office_name} TO ${destinationOffice.office_name}`,
            fromOfficeId: senderOffice.id,
            toOfficeId: destinationOffice.id,
            userId: req.userRecord.id || null,
            timestamp: now,
            remarks: normalizedRemarks || 'Document resent after edit',
            transaction
          });

          await createAuditLog({
            documentId: doc.id,
            status: `FORWARDED BY ${senderOffice.office_name} TO ${destinationOffice.office_name}`,
            fromOfficeId: senderOffice.id,
            toOfficeId: destinationOffice.id,
            userId: req.userRecord.id || null,
            timestamp: now,
            remarks: normalizedRemarks || 'Document resent after edit',
            transaction
          });
        }

        await DocumentRecipient.upsert({
          document_id: doc.id,
          recipient_office_id: senderOffice.id,
          recipient_status: RECIPIENT_STATUS.FORWARDED,
          last_action_at: now,
          latest_remarks: normalizedRemarks || null,
          created_at: now,
          updated_at: now
        }, { transaction });

        await doc.update({
          status: `FORWARDED BY ${senderOffice.office_name} TO ${rerouteOffices.length} OFFICE(S)`,
          current_office_id: rerouteOffices[0].id,
          updated_at: now
        }, { transaction });
      }

      await transaction.commit();
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }

    const updatedDoc = await Document.findByPk(doc.id, { include: [...docIncludes, recipientInclude] });
    res.json(mapDoc(updatedDoc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel outgoing document (append-only)
router.delete('/:id', requireUser, async (req, res) => {
  try {
    const actorOfficeId = String(req.userRecord?.office_id || '');
    const actorOfficeName = req.userRecord?.office?.office_name || 'OFFICE';
    const actorUserId = req.userRecord?.id || null;
    if (!actorOfficeId) {
      return res.status(403).json({ error: 'User office is not configured.' });
    }

    const transaction = await sequelize.transaction();
    try {
      const doc = await Document.findByPk(req.params.id, { transaction });
      if (!doc) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Document not found' });
      }

      const requesterOfficeId = String(doc.requester_office_id || '');
      if (!requesterOfficeId || requesterOfficeId !== actorOfficeId) {
        await transaction.rollback();
        return res.status(403).json({ error: 'Only the sender office can cancel this outgoing document.' });
      }

      const now = new Date();
      const cancellationRemarks = `Outgoing cancelled by ${actorOfficeName}`;

      await DocumentRecipient.update({
        recipient_status: 'CANCELLED',
        last_action_at: now,
        latest_remarks: cancellationRemarks,
        updated_at: now
      }, {
        where: { document_id: doc.id },
        transaction
      });

      await doc.update({
        status: `CANCELLED BY ${actorOfficeName}`,
        current_office_id: doc.requester_office_id || null,
        updated_at: now
      }, { transaction });

      await createAuditLog({
        documentId: doc.id,
        status: `CANCELLED BY ${actorOfficeName}`,
        fromOfficeId: actorOfficeId,
        toOfficeId: null,
        userId: actorUserId,
        timestamp: now,
        remarks: cancellationRemarks,
        transaction
      });

      await transaction.commit();
      res.json({ id: doc.id, _id: doc.id, message: 'Document cancelled successfully.' });
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Document action endpoint: receive, decline, return, forward
router.post('/:id/action', async (req, res) => {
  const { action, user_id, office_id, acting_office_id, to_office_id, to_office_ids, remarks } = req.body;
  if (!['receive', 'decline', 'return', 'forward'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action.' });
  }
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    const actorOfficeId = action === 'forward' ? (acting_office_id || office_id) : office_id;
    const actorOffice = await findActiveOfficeById(actorOfficeId);
    if (!actorOffice) {
      return res.status(400).json({ error: 'Invalid or inactive acting office.' });
    }
    if (user_id) {
      const actorUser = await findActiveUserById(user_id);
      if (!actorUser) {
        return res.status(400).json({ error: 'Invalid or inactive user.' });
      }
    }

    const actorRecipient = await DocumentRecipient.findOne({
      where: {
        document_id: doc.id,
        recipient_office_id: actorOfficeId
      }
    });
    if (!actorRecipient) {
      return res.status(403).json({ error: 'You are not authorized to act on this document.' });
    }

    const currentPhase = String(actorRecipient.recipient_status || '').toUpperCase();
    if (!canTransition(action, currentPhase)) {
      return res.status(409).json({
        error: `Cannot ${action} document from current status.`,
        current_status: actorRecipient.recipient_status,
        current_phase: currentPhase
      });
    }

    const normalizedRemarks = String(remarks || '').trim();
    if ((action === 'decline' || action === 'return') && !normalizedRemarks) {
      return res.status(400).json({ error: `Remarks are required for ${action} action.` });
    }
    const requireRemarksForReceive = action === 'receive' && currentPhase !== RECIPIENT_STATUS.RETURNED;
    if (requireRemarksForReceive && !normalizedRemarks) {
      return res.status(400).json({ error: 'Remarks are required for receive action.' });
    }
    const now = new Date();

    const transaction = await sequelize.transaction();
    try {
      if (action === 'forward') {
        const destinationIds = [];
        if (Array.isArray(to_office_ids)) destinationIds.push(...to_office_ids);
        if (to_office_id) destinationIds.push(to_office_id);
        const normalizedDestinationIds = Array.from(new Set(
          destinationIds
            .filter(Boolean)
            .map((id) => String(id).trim())
            .filter(Boolean)
        ));
        if (!normalizedDestinationIds.length) {
          await transaction.rollback();
          return res.status(400).json({ error: 'Destination office is required for forward action.' });
        }
        if (normalizedDestinationIds.some((id) => String(id) === String(actorOffice.id))) {
          await transaction.rollback();
          return res.status(400).json({ error: 'Cannot forward to the same office.' });
        }

        const destinationOffices = [];
        for (const destinationOfficeId of normalizedDestinationIds) {
          const destinationOffice = await findActiveOfficeById(destinationOfficeId);
          if (!destinationOffice) {
            await transaction.rollback();
            return res.status(400).json({ error: `Invalid or inactive destination office: ${destinationOfficeId}` });
          }
          destinationOffices.push(destinationOffice);
        }

        for (const destinationOffice of destinationOffices) {
          await DocumentRecipient.upsert({
            document_id: doc.id,
            recipient_office_id: destinationOffice.id,
            recipient_status: RECIPIENT_STATUS.RELEASED,
            last_action_at: now,
            latest_remarks: normalizedRemarks || null,
            created_at: now,
            updated_at: now
          }, { transaction });

          await createAuditLog({
            documentId: doc.id,
            status: `FORWARDED BY ${actorOffice.office_name} TO ${destinationOffice.office_name}`,
            fromOfficeId: actorOffice.id,
            toOfficeId: destinationOffice.id,
            userId: user_id || null,
            timestamp: now,
            remarks: normalizedRemarks,
            transaction
          });
        }

        await actorRecipient.update({
          recipient_status: RECIPIENT_STATUS.FORWARDED,
          last_action_at: now,
          latest_remarks: normalizedRemarks || null,
          updated_at: now
        }, { transaction });

        await doc.update({
          status: `FORWARDED BY ${actorOffice.office_name} TO ${destinationOffices.length} OFFICE(S)`,
          current_office_id: destinationOffices[0].id,
          updated_at: now
        }, { transaction });

        await transaction.commit();
        const forwardedDoc = await Document.findByPk(doc.id, { include: [...docIncludes, recipientInclude] });
        return res.json({ success: true, document: mapDoc(forwardedDoc) });
      }

      if (action === 'receive') {
        const latestInbound = await StatusLog.findOne({
          where: { document_id: doc.id, to_office_id: actorOffice.id },
          order: [['date', 'DESC'], ['id', 'DESC']],
          transaction
        });
        if (currentPhase === RECIPIENT_STATUS.RETURNED) {
          await createAuditLog({
            documentId: doc.id,
            status: `ACKNOWLEDGED RETURNED BY ${actorOffice.office_name}`,
            fromOfficeId: latestInbound?.from_office_id || actorOffice.id,
            toOfficeId: actorOffice.id,
            userId: user_id || null,
            timestamp: now,
            remarks: normalizedRemarks || 'Returned document acknowledged',
            transaction
          });
        }
        const receivedAt = new Date(now.getTime() + 1);
        await createAuditLog({
          documentId: doc.id,
          status: `RECEIVED BY ${actorOffice.office_name}`,
          fromOfficeId: latestInbound?.from_office_id || actorOffice.id,
          toOfficeId: actorOffice.id,
          userId: user_id || null,
          timestamp: receivedAt,
          remarks: normalizedRemarks,
          transaction
        });
        await actorRecipient.update({
          recipient_status: RECIPIENT_STATUS.RECEIVED,
          received_at: now,
          last_action_at: now,
          latest_remarks: normalizedRemarks || null,
          updated_at: now
        }, { transaction });
        await doc.update({
          status: `RECEIVED BY ${actorOffice.office_name}`,
          current_office_id: actorOffice.id,
          updated_at: now
        }, { transaction });
      } else if (action === 'decline') {
        const previousSenderOfficeId = await resolvePreviousSenderOfficeId({
          documentId: doc.id,
          currentOfficeId: actorOffice.id,
          requesterOfficeId: doc.requester_office_id,
          transaction
        });
        if (!previousSenderOfficeId) {
          await transaction.rollback();
          return res.status(400).json({ error: 'Cannot resolve previous sender office for return routing.' });
        }
        if (String(previousSenderOfficeId) === String(actorOffice.id)) {
          await transaction.rollback();
          return res.status(400).json({ error: 'Cannot return document to the same office.' });
        }
        const previousSenderOffice = await findActiveOfficeById(previousSenderOfficeId);
        if (!previousSenderOffice) {
          await transaction.rollback();
          return res.status(400).json({ error: 'Resolved previous sender office is inactive or invalid.' });
        }
        const declinedAt = now;
        const returnedAt = new Date(now.getTime() + 1);

        await createAuditLog({
          documentId: doc.id,
          status: `DECLINED BY ${actorOffice.office_name}`,
          fromOfficeId: actorOffice.id,
          toOfficeId: actorOffice.id,
          userId: user_id || null,
          timestamp: declinedAt,
          remarks: normalizedRemarks,
          transaction
        });
        await createAuditLog({
          documentId: doc.id,
          status: `RETURNED BY ${actorOffice.office_name} TO ${previousSenderOffice.office_name}`,
          fromOfficeId: actorOffice.id,
          toOfficeId: previousSenderOffice.id,
          userId: user_id || null,
          timestamp: returnedAt,
          remarks: normalizedRemarks,
          transaction
        });
        // #region agent log
        fetch('http://127.0.0.1:7747/ingest/52959616-5e84-48f3-95c4-210ef6f8a534',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bc97f8'},body:JSON.stringify({sessionId:'bc97f8',runId:'run1',hypothesisId:'H2',location:'routes/documents.js:action:decline',message:'decline/return log write timestamps',data:{documentId:String(doc?.id||''),hasPreviousSender:Boolean(previousSenderOffice),declinedAt:declinedAt?.toISOString?.()||null,returnedAt:returnedAt?.toISOString?.()||null,sameTimestamp:Boolean(declinedAt?.getTime?.()===returnedAt?.getTime?.()),remarksLength:String(normalizedRemarks||'').length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        await actorRecipient.update({
          recipient_status: RECIPIENT_STATUS.DECLINED,
          declined_at: now,
          last_action_at: now,
          latest_remarks: normalizedRemarks,
          updated_at: now
        }, { transaction });
        await DocumentRecipient.upsert({
          document_id: doc.id,
          recipient_office_id: previousSenderOffice.id,
          recipient_status: RECIPIENT_STATUS.RETURNED,
          last_action_at: now,
          latest_remarks: normalizedRemarks,
          created_at: now,
          updated_at: now
        }, { transaction });
        await doc.update({
          status: `RETURNED TO ${previousSenderOffice.office_name}`,
          current_office_id: previousSenderOffice.id,
          updated_at: now
        }, { transaction });
      } else if (action === 'return') {
        const previousSenderOfficeId = await resolvePreviousSenderOfficeId({
          documentId: doc.id,
          currentOfficeId: actorOffice.id,
          requesterOfficeId: doc.requester_office_id,
          transaction
        });
        if (!previousSenderOfficeId) {
          await transaction.rollback();
          return res.status(400).json({ error: 'Cannot resolve previous sender office for return routing.' });
        }
        if (String(previousSenderOfficeId) === String(actorOffice.id)) {
          await transaction.rollback();
          return res.status(400).json({ error: 'Cannot return document to the same office.' });
        }
        const previousSenderOffice = await findActiveOfficeById(previousSenderOfficeId);
        if (!previousSenderOffice) {
          await transaction.rollback();
          return res.status(400).json({ error: 'Resolved previous sender office is inactive or invalid.' });
        }

        await createAuditLog({
          documentId: doc.id,
          status: `RETURNED BY ${actorOffice.office_name} TO ${previousSenderOffice.office_name}`,
          fromOfficeId: actorOffice.id,
          toOfficeId: previousSenderOffice.id,
          userId: user_id || null,
          timestamp: now,
          remarks: normalizedRemarks,
          transaction
        });

        await actorRecipient.update({
          recipient_status: RECIPIENT_STATUS.FORWARDED,
          last_action_at: now,
          latest_remarks: normalizedRemarks,
          updated_at: now
        }, { transaction });

        await DocumentRecipient.upsert({
          document_id: doc.id,
          recipient_office_id: previousSenderOffice.id,
          recipient_status: RECIPIENT_STATUS.RETURNED,
          last_action_at: now,
          latest_remarks: normalizedRemarks,
          created_at: now,
          updated_at: now
        }, { transaction });

        await doc.update({
          status: `RETURNED TO ${previousSenderOffice.office_name}`,
          current_office_id: previousSenderOffice.id,
          updated_at: now
        }, { transaction });
      }

      await transaction.commit();
      const updatedDoc = await Document.findByPk(doc.id, { include: [...docIncludes, recipientInclude] });
      return res.json({ success: true, document: mapDoc(updatedDoc) });
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark document as completed by current holder
router.post('/:id/complete', async (req, res) => {
  const { office_id, user_id, remarks } = req.body || {};
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    if (!office_id) {
      return res.status(400).json({ error: 'office_id is required.' });
    }
    const office = await findActiveOfficeById(office_id);
    if (!office) {
      return res.status(400).json({ error: 'Invalid or inactive office_id.' });
    }
    if (user_id) {
      const user = await findActiveUserById(user_id);
      if (!user) {
        return res.status(400).json({ error: 'Invalid or inactive user_id.' });
      }
    }

    const recipientRow = await DocumentRecipient.findOne({
      where: {
        document_id: doc.id,
        recipient_office_id: office_id
      }
    });
    if (!recipientRow) {
      return res.status(403).json({ error: 'You are not authorized to complete this document.' });
    }

    const currentPhase = String(recipientRow.recipient_status || '').toUpperCase();
    if (currentPhase === 'COMPLETED') {
      const alreadyCompleted = await Document.findByPk(doc.id, { include: [...docIncludes, recipientInclude] });
      return res.json({
        success: true,
        document: mapDoc(alreadyCompleted),
        message: 'Document is already completed.'
      });
    }
    if (!canComplete(currentPhase)) {
      return res.status(409).json({
        error: 'Cannot complete document from current status.',
        current_status: recipientRow.recipient_status,
        current_phase: currentPhase
      });
    }

    const completedStatus = `COMPLETED BY ${office.office_name}`;
    const completionRemarks = String(remarks || '').trim();
    const now = new Date();
    const transaction = await sequelize.transaction();
    try {
      await createAuditLog({
        documentId: doc.id,
        status: completedStatus,
        fromOfficeId: office_id,
        toOfficeId: office_id,
        userId: user_id || null,
        timestamp: now,
        remarks: completionRemarks,
        transaction
      });

      await recipientRow.update({
        recipient_status: RECIPIENT_STATUS.COMPLETED,
        completed_at: now,
        last_action_at: now,
        latest_remarks: completionRemarks || null,
        updated_at: now
      }, { transaction });

      await doc.update({
        status: completedStatus,
        current_office_id: office_id || null,
        completed_at: now,
        completed_by_user_id: user_id || null,
        completed_by_office_id: office_id || null,
        completion_remarks: completionRemarks || null,
        updated_at: now
      }, { transaction });
      await transaction.commit();
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }

    const updatedDoc = await Document.findByPk(doc.id, { include: [...docIncludes, recipientInclude] });
    return res.json({ success: true, document: mapDoc(updatedDoc) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get incoming documents for an office
router.get('/incoming', async (req, res) => {
  try {
    const officeScope = await resolveOfficeScope(req, req.query.office_id);
    if (officeScope.error) return res.status(officeScope.status || 400).json({ error: officeScope.error });
    const office_id = officeScope.officeId;

    const docs = await Document.findAll({
      include: [
        ...docIncludes,
        {
          model: DocumentRecipient,
          as: 'recipients',
          required: true,
          where: {
            recipient_office_id: office_id,
            recipient_status: {
              [Op.in]: [RECIPIENT_STATUS.RELEASED, RECIPIENT_STATUS.RETURNED]
            }
          },
          include: [{ model: Office, as: 'recipient_office' }]
        }
      ],
      distinct: true,
      order: [['updated_at', 'DESC'], ['created_at', 'DESC']]
    });
    res.json(docs.map(mapDoc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get received documents for an office
router.get('/received', async (req, res) => {
  try {
    const officeScope = await resolveOfficeScope(req, req.query.office_id);
    if (officeScope.error) return res.status(officeScope.status || 400).json({ error: officeScope.error });
    const office_id = officeScope.officeId;
    const docs = await Document.findAll({
      include: [
        ...docIncludes,
        {
          model: DocumentRecipient,
          as: 'recipients',
          required: true,
          where: {
            recipient_office_id: office_id,
            recipient_status: RECIPIENT_STATUS.RECEIVED
          },
          include: [{ model: Office, as: 'recipient_office' }]
        }
      ],
      distinct: true,
      order: [['updated_at', 'DESC'], ['created_at', 'DESC']]
    });
    res.json(docs.map(mapDoc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get completed documents for an office
router.get('/complete', async (req, res) => {
  try {
    const officeScope = await resolveOfficeScope(req, req.query.office_id);
    if (officeScope.error) return res.status(officeScope.status || 400).json({ error: officeScope.error });
    const office_id = officeScope.officeId;

    const docs = await Document.findAll({
      include: [
        ...docIncludes,
        {
          model: DocumentRecipient,
          as: 'recipients',
          required: true,
          where: {
            recipient_office_id: office_id,
            recipient_status: RECIPIENT_STATUS.COMPLETED
          },
          include: [{ model: Office, as: 'recipient_office' }]
        }
      ],
      distinct: true,
      order: [
        ['completed_at', 'DESC'],
        ['updated_at', 'DESC']
      ]
    });

    res.json(docs.map(mapDoc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get outgoing documents for the authenticated user's office
router.get('/outgoing', requireUser, async (req, res) => {
  try {
    const officeId = req.userRecord?.office_id;
    if (!officeId) {
      return res.status(403).json({ error: 'User office is not configured.' });
    }

    const search = String(req.query.q || '').trim();
    const hasPagination = req.query.limit !== undefined || req.query.offset !== undefined;
    const parsedLimit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const parsedOffset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = {
      requester_office_id: officeId
    };

    if (search) {
      where[Op.or] = [
        { document_code: { [Op.iLike]: `%${search}%` } },
        { title: { [Op.iLike]: `%${search}%` } },
        { status: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const result = await Document.findAndCountAll({
      where,
      include: [...docIncludes, recipientInclude],
      distinct: true,
      order: [['updated_at', 'DESC'], ['created_at', 'DESC']],
      ...(hasPagination ? { limit: parsedLimit, offset: parsedOffset } : {})
    });

    const items = result.rows
      .map(mapDoc)
      .map((doc) => {
        const recipients = Array.isArray(doc.recipients) ? doc.recipients : [];
        const names = recipients
          .map((r) => r?.recipient_office_id?.office_name)
          .filter(Boolean);
        if (names.length === 1) {
          doc.destination_label = names[0];
        } else if (names.length > 1) {
          doc.destination_label = `Multiple recipients (${names.length})`;
        } else {
          doc.destination_label = doc.current_office_id?.office_name || '-';
        }
        return doc;
      });
    const nonTerminalItems = items.filter((doc) => {
      const recipients = Array.isArray(doc.recipients) ? doc.recipients : [];
      if (!recipients.length) return true;
      return recipients.some((r) => String(r?.recipient_status || '').toUpperCase() === RECIPIENT_STATUS.RELEASED);
    });
    const responseTotal = nonTerminalItems.length;

    return res.json({
      items: nonTerminalItems,
      total: responseTotal,
      limit: hasPagination ? parsedLimit : nonTerminalItems.length,
      offset: hasPagination ? parsedOffset : 0
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

function parseDateRangeFromPreset(datePreset) {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  end.setHours(23, 59, 59, 999);
  start.setHours(0, 0, 0, 0);

  const preset = String(datePreset || '').trim().toLowerCase();
  if (preset === 'today') {
    return { start, end };
  }
  if (preset === 'last7') {
    start.setDate(start.getDate() - 6);
    return { start, end };
  }
  if (preset === 'last30') {
    start.setDate(start.getDate() - 29);
    return { start, end };
  }
  return null;
}

function parseLegacyCreatedAtRange({ date, month, time }) {
  let range = null;
  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    range = { [Op.gte]: start, [Op.lt]: end };
  }
  if (month) {
    const [year, m] = String(month).split('-');
    const start = new Date(`${year}-${m}-01T00:00:00Z`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    range = { [Op.gte]: start, [Op.lt]: end };
  }
  if (time && range?.[Op.gte]) {
    const [h, min] = String(time).split(':');
    const start = new Date(range[Op.gte]);
    start.setHours(Number(h), Number(min), 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 59);
    range = { [Op.gte]: start, [Op.lt]: end };
  }
  return range;
}

function resolveStatusPhaseWhere(statusPhase) {
  const phase = String(statusPhase || '').trim().toLowerCase();
  const patternByPhase = {
    released: 'RELEASED%',
    returned: 'RETURNED TO %',
    received: 'RECEIVED BY %',
    on_hold: 'ON HOLD BY %',
    declined: 'DECLINED BY %',
    completed: 'COMPLETED BY %',
    draft: 'DRAFT%'
  };
  const pattern = patternByPhase[phase];
  return pattern ? { [Op.iLike]: pattern } : null;
}

function resolveRecipientStatusesForPhase(statusPhase) {
  const phase = String(statusPhase || '').trim().toLowerCase();
  const statusesByPhase = {
    released: [RECIPIENT_STATUS.RELEASED],
    returned: [RECIPIENT_STATUS.RETURNED],
    received: [RECIPIENT_STATUS.RECEIVED],
    declined: [RECIPIENT_STATUS.DECLINED],
    completed: [RECIPIENT_STATUS.COMPLETED]
  };
  return statusesByPhase[phase] || null;
}

function buildRecipientStatusExistsLiteral(recipientStatuses) {
  const statuses = Array.isArray(recipientStatuses)
    ? recipientStatuses.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean)
    : [];
  if (!statuses.length) return null;
  const escapedStatuses = statuses.map((status) => sequelize.escape(status));
  return sequelize.literal(
    `EXISTS (SELECT 1 FROM document_recipients dr WHERE dr.document_id = "Document"."id" AND UPPER(dr.recipient_status) IN (${escapedStatuses.join(', ')}))`
  );
}

function buildStatusHistoryExistsLiteral(scopeOfficeId, scopeUserId) {
  const conditions = [];
  if (scopeOfficeId) {
    const officeId = sequelize.escape(scopeOfficeId);
    conditions.push(`sh.from_office_id = ${officeId}`);
    conditions.push(`sh.to_office_id = ${officeId}`);
  }
  if (scopeUserId) {
    const userId = sequelize.escape(scopeUserId);
    conditions.push(`sh.user_id = ${userId}`);
  }
  if (!conditions.length) return null;
  return sequelize.literal(`EXISTS (SELECT 1 FROM status_history sh WHERE sh.document_id = "Document"."id" AND (${conditions.join(' OR ')}))`);
}

function buildRecipientExistsLiteral(scopeOfficeId) {
  if (!scopeOfficeId) return null;
  const officeId = sequelize.escape(scopeOfficeId);
  return sequelize.literal(`EXISTS (SELECT 1 FROM document_recipients dr WHERE dr.document_id = "Document"."id" AND dr.recipient_office_id = ${officeId})`);
}

function debugTrackSearch(runId, hypothesisId, location, message, data) {
  // #region agent log
  fetch('http://127.0.0.1:7554/ingest/211d2500-52e9-414d-b69d-493cd1259842', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'eb249a' }, body: JSON.stringify({ sessionId: 'eb249a', runId, hypothesisId, location, message, data, timestamp: Date.now() }) }).catch(() => {});
  // #endregion
}

// Search documents by code and optional filters
router.get('/search', async (req, res) => {
  try {
    const {
      document_code,
      date,
      month,
      time,
      q,
      statusPhase,
      datePreset,
      fromDate,
      toDate,
      scopeOfficeId,
      scopeUserId,
      recent,
      recentMode = 'both',
      summaryOnly,
      limit = '10',
      offset = '0'
    } = req.query;

    debugTrackSearch('pre-fix', 'H1', 'routes/documents.js:/search:entry', 'search endpoint called', {
      hasDocumentCode: Boolean(document_code),
      hasKeyword: Boolean(q),
      statusPhase: statusPhase || '',
      datePreset: datePreset || '',
      hasScopeOfficeId: Boolean(scopeOfficeId),
      hasScopeUserId: Boolean(scopeUserId),
      recentMode: recentMode || '',
      summaryOnly: String(summaryOnly || ''),
      limitRaw: String(limit || ''),
      offsetRaw: String(offset || '')
    });

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const includeSummary =
      String(summaryOnly || '').toLowerCase() === 'true' ||
      String(summaryOnly || '').toLowerCase() === '1' ||
      String(recent || '').toLowerCase() === 'true' ||
      String(recent || '').toLowerCase() === '1';
    const isRecentMode =
      String(recent || '').toLowerCase() === 'true' ||
      String(recent || '').toLowerCase() === '1';

    const whereClauses = [];

    if (document_code) {
      whereClauses.push({
        document_code: { [Op.iLike]: `%${document_code}%` }
      });
    }

    const keyword = String(q || '').trim();
    if (keyword) {
      whereClauses.push({
        [Op.or]: [
          { title: { [Op.iLike]: `%${keyword}%` } },
          { content: { [Op.iLike]: `%${keyword}%` } }
        ]
      });
    }

    const recipientStatusesForPhase = resolveRecipientStatusesForPhase(statusPhase);
    const recipientStatusExists = buildRecipientStatusExistsLiteral(recipientStatusesForPhase);
    if (recipientStatusExists) {
      whereClauses.push(recipientStatusExists);
    } else {
      const statusWhere = resolveStatusPhaseWhere(statusPhase);
      if (statusWhere) {
        whereClauses.push({ status: statusWhere });
      }
    }

    const dateRange = parseDateRangeFromPreset(datePreset);
    const explicitFrom = fromDate ? new Date(fromDate) : null;
    const explicitTo = toDate ? new Date(toDate) : null;
    if (explicitFrom || explicitTo || dateRange) {
      const start = explicitFrom || (dateRange ? dateRange.start : null);
      const end = explicitTo || (dateRange ? dateRange.end : null);
      if (start || end) {
        const updatedRange = {};
        const createdRange = {};
        if (start) {
          updatedRange[Op.gte] = start;
          createdRange[Op.gte] = start;
        }
        if (end) {
          updatedRange[Op.lte] = end;
          createdRange[Op.lte] = end;
        }
        whereClauses.push({
          [Op.or]: [
            { updated_at: updatedRange },
            { created_at: createdRange }
          ]
        });
      }
    }

    const legacyCreatedAtRange = parseLegacyCreatedAtRange({ date, month, time });
    if (legacyCreatedAtRange) {
      whereClauses.push({ created_at: legacyCreatedAtRange });
    }

    if (scopeOfficeId || scopeUserId) {
      const scopeOr = [];
      if (scopeOfficeId) {
        scopeOr.push({ requester_office_id: scopeOfficeId });
        scopeOr.push({ current_office_id: scopeOfficeId });
      }
      const recipientExists = buildRecipientExistsLiteral(scopeOfficeId);
      if (recipientExists) {
        scopeOr.push(recipientExists);
      }
      const historyExists = buildStatusHistoryExistsLiteral(scopeOfficeId, scopeUserId);
      if (historyExists) {
        scopeOr.push(historyExists);
      }
      whereClauses.push({ [Op.or]: scopeOr });
    }

    const normalizedRecentMode = String(recentMode || 'both').toLowerCase();
    if (isRecentMode && (scopeOfficeId || scopeUserId)) {
      if (normalizedRecentMode === 'created') {
        const createdScopeOr = [];
        if (scopeOfficeId) createdScopeOr.push({ requester_office_id: scopeOfficeId });
        if (scopeUserId) createdScopeOr.push({ created_by_admin_id: scopeUserId });
        whereClauses.push({ [Op.or]: createdScopeOr });
      } else if (normalizedRecentMode === 'handled') {
        const handledScopeOr = [];
        if (scopeOfficeId) {
          handledScopeOr.push({ current_office_id: scopeOfficeId });
        }
        const handledRecipientExists = buildRecipientExistsLiteral(scopeOfficeId);
        if (handledRecipientExists) handledScopeOr.push(handledRecipientExists);
        const handledHistoryExists = buildStatusHistoryExistsLiteral(scopeOfficeId, scopeUserId);
        if (handledHistoryExists) handledScopeOr.push(handledHistoryExists);
        whereClauses.push({ [Op.or]: handledScopeOr });
      }
    }

    const where = whereClauses.length ? { [Op.and]: whereClauses } : {};

    const summaryIncludes = [
      { model: DocumentType, as: 'type' },
      { model: Office, as: 'requester_office' },
      { model: Office, as: 'current_office' },
      { model: User, as: 'completed_by_user', attributes: ['id', 'username'] },
      { model: Office, as: 'completed_by_office' }
    ];

    const include = includeSummary ? summaryIncludes : docIncludes;
    const usePagination =
      includeSummary ||
      req.query.limit !== undefined ||
      req.query.offset !== undefined ||
      Boolean(q) ||
      Boolean(statusPhase) ||
      Boolean(datePreset) ||
      Boolean(fromDate) ||
      Boolean(toDate) ||
      Boolean(scopeOfficeId) ||
      Boolean(scopeUserId);

    const queryResult = await Document.findAndCountAll({
      where,
      include,
      distinct: true,
      order: [['updated_at', 'DESC'], ['created_at', 'DESC']],
      ...(usePagination ? { limit: parsedLimit, offset: parsedOffset } : {})
    });

    debugTrackSearch('pre-fix', 'H2', 'routes/documents.js:/search:query-success', 'search query success', {
      includeSummary,
      usePagination,
      includeCount: Array.isArray(include) ? include.length : -1,
      hasStatusHistoryInclude: Array.isArray(include) ? include.some((inc) => inc?.as === 'status_history') : false,
      whereClauseCount: whereClauses.length,
      resultCount: queryResult.count
    });

    const mappedDocs = queryResult.rows.map((doc) => {
      const mapped = mapDoc(doc);
      if (includeSummary) delete mapped.status_history;
      return mapped;
    });

    const shouldReturnObject =
      includeSummary ||
      Boolean(q) ||
      Boolean(statusPhase) ||
      Boolean(datePreset) ||
      Boolean(fromDate) ||
      Boolean(toDate) ||
      req.query.limit !== undefined ||
      req.query.offset !== undefined ||
      Boolean(scopeOfficeId) ||
      Boolean(scopeUserId);

    if (shouldReturnObject) {
      return res.json({
        items: mappedDocs,
        total: queryResult.count,
        limit: parsedLimit,
        offset: parsedOffset
      });
    }

    return res.json(mappedDocs);
  } catch (err) {
    debugTrackSearch('pre-fix', 'H3', 'routes/documents.js:/search:catch', 'search query failed', {
      errorMessage: String(err?.message || ''),
      errorName: String(err?.name || '')
    });
    return res.status(500).json({ error: err.message });
  }
});

// Get timeline/status history for a specific document
router.get('/:id/timeline', async (req, res) => {
  try {
    const doc = await Document.findByPk(req.params.id, {
      include: [{ model: DocumentType, as: 'type', attributes: ['id', 'type_name'] }]
    });

    if (!doc) return res.status(404).json({ error: 'Document not found' });
    // #region agent log
    fetch('http://127.0.0.1:7747/ingest/52959616-5e84-48f3-95c4-210ef6f8a534',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bc97f8'},body:JSON.stringify({sessionId:'bc97f8',runId:'run1',hypothesisId:'H1',location:'routes/documents.js:timeline:entry',message:'timeline route requested',data:{documentId:String(req.params.id||''),currentStatus:String(doc?.status||'')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const statusHistoryRows = await StatusLog.findAll({
      where: { document_id: doc.id },
      include: [
        { model: Office, as: 'from_office' },
        { model: Office, as: 'to_office' },
        { model: User, as: 'user' }
      ],
      order: [['date', 'ASC'], ['id', 'ASC']]
    });

    const timeline = statusHistoryRows.map((item) => ({
      id: item.id,
      status: item.status,
      from_office: item.from_office ? { id: item.from_office.id, office_name: item.from_office.office_name } : null,
      to_office: item.to_office ? { id: item.to_office.id, office_name: item.to_office.office_name } : null,
      user: item.user ? { id: item.user.id, username: item.user.username } : null,
      date: item.date,
      remarks: item.remarks || ''
    }));
    const timelineEpochs = timeline.map((row) => new Date(row.date).getTime());
    const timelineMonotonicAsc = timelineEpochs.every((ts, index) => index === 0 || ts >= timelineEpochs[index - 1]);
    // #region agent log
    fetch('http://127.0.0.1:7747/ingest/52959616-5e84-48f3-95c4-210ef6f8a534',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bc97f8'},body:JSON.stringify({sessionId:'bc97f8',runId:'run1',hypothesisId:'H1',location:'routes/documents.js:timeline:result',message:'timeline rows sorted result snapshot',data:{documentId:String(doc?.id||''),count:timeline.length,firstDate:timeline[0]?.date||null,lastDate:timeline[timeline.length-1]?.date||null,monotonicAsc:Boolean(timelineMonotonicAsc),invalidDateCount:timelineEpochs.filter((v)=>!Number.isFinite(v)).length,statusPreview:timeline.slice(0,4).map((row)=>String(row?.status||''))},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7507/ingest/940a8e2d-ccff-48a6-a6db-a34f92dab6b3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0680fe'},body:JSON.stringify({sessionId:'0680fe',runId:'run1',hypothesisId:'H2',location:'routes/documents.js:timeline',message:'timeline endpoint payload snapshot',data:{docId:String(doc?.id||''),timelineCount:timeline.length,remarksPreview:timeline.slice(0,3).map(i=>String(i?.remarks||''))},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    res.json({
      document_id: doc.id,
      document_code: doc.document_code,
      title: doc.title,
      content: doc.content ?? null,
      type_name: doc.type ? doc.type.type_name : null,
      current_status: doc.status,
      status_phase: deriveStatusPhase(doc.status),
      timeline
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/documents/:id/attachments (list metadata only)
router.get('/:id/attachments', requireUser, async (req, res) => {
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const canAccess = await userCanAccessDocument(req.userRecord, doc.id);
    if (!canAccess) {
      return res.status(403).json({ error: 'You are not authorized to view attachments for this document.' });
    }

    // Select everything except file_data BYTEA to keep response fast
    const attachments = await Attachment.findAll({
      where: { document_id: doc.id },
      attributes: ['id', 'document_id', 'filename', 'mime_type', 'size_bytes', 'uploaded_at'],
      order: [['uploaded_at', 'DESC'], ['id', 'DESC']]
    });

    const apiBaseUrl = `${req.protocol}://${req.get('host')}`;
    const mapped = attachments.map(att => {
      const version = att.uploaded_at ? `?v=${encodeURIComponent(new Date(att.uploaded_at).getTime())}` : '';
      return {
      id: att.id,
      name: att.filename,
      size: att.size_bytes,
      mimeType: att.mime_type,
      uploadedAt: att.uploaded_at,
      previewUrl: `${apiBaseUrl}/api/attachments/${att.id}/preview${version}`,
      downloadUrl: `${apiBaseUrl}/api/attachments/${att.id}/download${version}`,
      url: `${apiBaseUrl}/api/attachments/${att.id}/download${version}`
      };
    });

    res.json({ attachments: mapped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/:id/attachments
// Allowed types: pdf, docx, xlsx, png, jpg, jpeg
const allowedMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg'
];

function parseAttachmentIdList(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof rawValue !== 'string') return [];
  const trimmed = rawValue.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    }
  } catch (err) {
    // Ignore parse error and fallback to comma-separated parsing.
  }
  return trimmed
    .split(',')
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function parseAttachmentMetadataList(rawValue) {
  if (!rawValue) return [];
  const raw = typeof rawValue === 'string' ? rawValue : String(rawValue || '');
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        id: String(entry?.id || '').trim(),
        name: String(entry?.name || '').trim()
      }))
      .filter((entry) => entry.id || entry.name);
  } catch (err) {
    return [];
  }
}

router.post('/:id/received-attachments', requireUser, upload.array('files[]', ATTACHMENT_LIMITS.MAX), async (req, res) => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7529/ingest/2186c759-b7ed-45d3-980b-04cc62c10e13',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'389aea'},body:JSON.stringify({sessionId:'389aea',runId:'run1',hypothesisId:'H4',location:'routes/documents.js:received-attachments:entry',message:'received-attachments route hit',data:{documentId:String(req.params?.id||''),method:String(req.method||''),originalUrl:String(req.originalUrl||'')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const actorOfficeId = String(req.userRecord?.office_id || '');
    if (!actorOfficeId) {
      return res.status(403).json({ error: 'User office is not configured.' });
    }

    const actorRecipient = await DocumentRecipient.findOne({
      where: {
        document_id: doc.id,
        recipient_office_id: actorOfficeId
      }
    });
    if (!actorRecipient) {
      return res.status(403).json({ error: 'Only the current recipient office can edit received attachments.' });
    }

    const currentPhase = String(actorRecipient.recipient_status || '').toUpperCase();
    if (currentPhase !== RECIPIENT_STATUS.RECEIVED) {
      return res.status(409).json({
        error: 'Attachments can only be edited while document is in RECEIVED status for your office.'
      });
    }

    const removeAttachmentIds = parseAttachmentIdList(req.body?.remove_attachment_ids);
    const incomingFiles = Array.isArray(req.files) ? req.files : [];
    if (!removeAttachmentIds.length && incomingFiles.length === 0) {
      return res.status(400).json({ error: 'No attachment changes provided.' });
    }

    const existingAttachments = await Attachment.findAll({
      where: { document_id: doc.id },
      attributes: ['id', 'filename', 'mime_type', 'size_bytes']
    });
    const existingIdSet = new Set(existingAttachments.map((att) => String(att.id)));
    const invalidRemoveId = removeAttachmentIds.find((id) => !existingIdSet.has(String(id)));
    if (invalidRemoveId) {
      return res.status(400).json({ error: `Attachment does not belong to this document: ${invalidRemoveId}` });
    }

    const uniqueRemoveIds = Array.from(new Set(removeAttachmentIds.map((id) => String(id))));
    const nextAttachmentCount = existingAttachments.length - uniqueRemoveIds.length + incomingFiles.length;
    if (nextAttachmentCount < ATTACHMENT_LIMITS.MIN) {
      return res.status(400).json({
        error: `At least ${ATTACHMENT_LIMITS.MIN} attachment is required.`
      });
    }
    if (nextAttachmentCount > ATTACHMENT_LIMITS.MAX) {
      return res.status(400).json({
        error: `You can upload up to ${ATTACHMENT_LIMITS.MAX} attachments per document.`
      });
    }

    for (const file of incomingFiles) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: `File type ${file.mimetype} completely rejected.` });
      }
    }

    const normalizedRemarks = String(req.body?.remarks || '').trim();
    const now = new Date();
    const transaction = await sequelize.transaction();
    try {
      if (uniqueRemoveIds.length) {
        await Attachment.destroy({
          where: {
            id: { [Op.in]: uniqueRemoveIds },
            document_id: doc.id
          },
          transaction
        });
      }

      const savedAttachments = [];
      for (const file of incomingFiles) {
        const created = await Attachment.create({
          document_id: doc.id,
          filename: file.originalname,
          mime_type: file.mimetype,
          size_bytes: file.size,
          file_data: file.buffer
        }, { transaction });
        savedAttachments.push(created);
      }

      await actorRecipient.update({
        last_action_at: now,
        latest_remarks: normalizedRemarks || null,
        updated_at: now
      }, { transaction });

      await doc.update({ updated_at: now }, { transaction });

      const actorOffice = await findActiveOfficeById(req.userRecord.office_id);
      const removedAttachments = existingAttachments.filter((att) => uniqueRemoveIds.includes(String(att.id)));
      const addedAttachments = savedAttachments.map((att) => ({
        id: att.id,
        filename: att.filename
      }));
      const removedCount = removedAttachments.length;
      const addedCount = addedAttachments.length;
      const replacementDetails = [
        `removed: ${removedAttachments.map((att) => `${att.filename} (${att.id})`).join(', ') || '-'}`,
        `added: ${addedAttachments.map((att) => `${att.filename} (${att.id})`).join(', ') || '-'}`
      ].join(' | ');
      const fallbackRemarks = `Received attachments updated (removed: ${removedCount}, added: ${addedCount}). ${replacementDetails}`;
      await createAuditLog({
        documentId: doc.id,
        status: `${AUDIT_ACTIONS.ATTACHMENT_REPLACED} BY ${actorOffice?.office_name || 'OFFICE'}`,
        fromOfficeId: req.userRecord.office_id || null,
        toOfficeId: actorOffice?.id || req.userRecord.office_id || null,
        userId: req.userRecord.id || null,
        timestamp: now,
        remarks: normalizedRemarks || fallbackRemarks,
        transaction
      });

      await transaction.commit();
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }

    return res.json({
      success: true,
      removed_count: uniqueRemoveIds.length,
      added_count: incomingFiles.length
    });
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'A file exceeds the 10MB limit.' });
    }
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/attachments', requireUser, upload.array('files[]', ATTACHMENT_LIMITS.MAX), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided for upload.' });
    }

    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const requesterOfficeId = String(doc.requester_office_id || '');
    const actorOfficeId = String(req.userRecord?.office_id || '');
    if (!requesterOfficeId || requesterOfficeId !== actorOfficeId) {
      return res.status(403).json({ error: 'Only the sender office can edit this outgoing document.' });
    }

    const recipientRows = await DocumentRecipient.findAll({
      where: { document_id: doc.id }
    });
    const canEdit = canEditDocumentFromRecipients(recipientRows);
    if (!canEdit) {
      return res.status(409).json({
        error: 'Document can no longer be edited because at least one destination office already received it.'
      });
    }

    const existingAttachmentCount = await Attachment.count({ where: { document_id: doc.id } });
    const incomingAttachmentCount = req.files.length;
    if (existingAttachmentCount === 0 && incomingAttachmentCount < ATTACHMENT_LIMITS.MIN) {
      return res.status(400).json({
        error: `At least ${ATTACHMENT_LIMITS.MIN} attachment is required.`
      });
    }
    if (existingAttachmentCount + incomingAttachmentCount > ATTACHMENT_LIMITS.MAX) {
      return res.status(400).json({
        error: `You can upload up to ${ATTACHMENT_LIMITS.MAX} attachments per document.`
      });
    }

    const apiBaseUrl = `${req.protocol}://${req.get('host')}`;
    const savedAttachments = [];
    const now = new Date();
    const replacedAttachments = parseAttachmentMetadataList(req.body?.replaced_attachments);

    for (const file of req.files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: `File type ${file.mimetype} completely rejected.` });
      }

      const att = await Attachment.create({
        document_id: doc.id,
        filename: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
        file_data: file.buffer // Write BYTEA
      });

      savedAttachments.push({
        id: att.id,
        name: att.filename,
        size: att.size_bytes,
        url: `${apiBaseUrl}/api/attachments/${att.id}/download`
      });
    }

    const actorOffice = await findActiveOfficeById(req.userRecord.office_id);
    const addedAttachmentDetails = savedAttachments
      .map((att) => `${att.name} (${att.id})`)
      .join(', ');
    const replacedAttachmentDetails = replacedAttachments
      .map((att) => `${att.name || 'Unknown'} (${att.id || '-'})`)
      .join(', ');
    const auditStatus = replacedAttachments.length
      ? `${AUDIT_ACTIONS.ATTACHMENT_REPLACED} BY ${actorOffice?.office_name || 'OFFICE'}`
      : `${AUDIT_ACTIONS.ATTACHMENT_ADDED} BY ${actorOffice?.office_name || 'OFFICE'}`;
    const auditRemarks = replacedAttachments.length
      ? `Replaced attachments old=[${replacedAttachmentDetails || '-'}] new=[${addedAttachmentDetails || '-'}]`
      : (addedAttachmentDetails ? `Added attachments: ${addedAttachmentDetails}` : 'Attachment upload completed');
    await createAuditLog({
      documentId: doc.id,
      status: auditStatus,
      fromOfficeId: req.userRecord.office_id || null,
      toOfficeId: null,
      userId: req.userRecord.id || null,
      timestamp: now,
      remarks: auditRemarks
    });

    res.json({ success: true, attachments: savedAttachments });
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'A file exceeds the 10MB limit.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/documents/:id/attachments/:attachmentId
router.delete('/:id/attachments/:attachmentId', requireUser, async (req, res) => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7529/ingest/2186c759-b7ed-45d3-980b-04cc62c10e13',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'220726'},body:JSON.stringify({sessionId:'220726',runId:'run2',hypothesisId:'H7',location:'routes/documents.js:delete-attachment-entry',message:'entered delete attachment route handler',data:{documentId:String(req.params?.id||''),attachmentId:String(req.params?.attachmentId||''),hasAuthHeader:Boolean(req.headers?.authorization),userId:String(req.userRecord?.id||'')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7529/ingest/2186c759-b7ed-45d3-980b-04cc62c10e13',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6e07b1'},body:JSON.stringify({sessionId:'6e07b1',runId:'run1',hypothesisId:'H4',location:'routes/documents.js:1538',message:'Delete attachment route entered',data:{documentId:String(req.params?.id||''),attachmentId:String(req.params?.attachmentId||''),method:String(req.method||''),originalUrl:String(req.originalUrl||'')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const attachment = await Attachment.findOne({
      where: {
        id: req.params.attachmentId,
        document_id: doc.id
      }
    });
    if (!attachment) {
      // #region agent log
      fetch('http://127.0.0.1:7529/ingest/2186c759-b7ed-45d3-980b-04cc62c10e13',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6e07b1'},body:JSON.stringify({sessionId:'6e07b1',runId:'run1',hypothesisId:'H5',location:'routes/documents.js:1549',message:'Attachment record not found for delete',data:{documentId:String(doc?.id||''),attachmentId:String(req.params?.attachmentId||'')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return res.status(404).json({ error: 'Attachment not found for this document.' });
    }

    const requesterOfficeId = String(doc.requester_office_id || '');
    const actorOfficeId = String(req.userRecord?.office_id || '');
    if (!requesterOfficeId || requesterOfficeId !== actorOfficeId) {
      return res.status(403).json({ error: 'Only the sender office can edit this outgoing document.' });
    }

    const recipientRows = await DocumentRecipient.findAll({
      where: { document_id: doc.id }
    });
    const canEdit = canEditDocumentFromRecipients(recipientRows);
    if (!canEdit) {
      return res.status(409).json({
        error: 'Document can no longer be edited because at least one destination office already received it.'
      });
    }

    const transaction = await sequelize.transaction();
    try {
      const now = new Date();
      await attachment.destroy({ transaction });
      await createAuditLog({
        documentId: doc.id,
        status: `${AUDIT_ACTIONS.ATTACHMENT_REMOVED} BY ${req.userRecord.office?.office_name || 'OFFICE'}`,
        fromOfficeId: req.userRecord.office_id || null,
        toOfficeId: null,
        userId: req.userRecord.id || null,
        timestamp: now,
        remarks: `Removed attachment: ${attachment.filename} (${attachment.id})`,
        transaction
      });
      await transaction.commit();
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }

    return res.json({ success: true, removed_attachment_id: attachment.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;