const express = require('express');
const { Op } = require('sequelize');
const { User, Office, Document, StatusLog, DocumentType, DocumentRecipient } = require('../models');
const { requireUser } = require('../middleware/requireUser');
const router = express.Router();

const RECIPIENT_STATUS = {
  RELEASED: 'RELEASED',
  RETURNED: 'RETURNED',
  RECEIVED: 'RECEIVED',
  DECLINED: 'DECLINED',
  COMPLETED: 'COMPLETED',
  FORWARDED: 'FORWARDED'
};

function normalizeRecipientStatus(value) {
  return String(value || '').trim().toUpperCase();
}

function formatRecipientLifecycleStatus(status) {
  const normalized = normalizeRecipientStatus(status);
  if (!normalized) return null;
  if (normalized === RECIPIENT_STATUS.RELEASED) return 'PENDING';
  if (normalized === RECIPIENT_STATUS.DECLINED) return RECIPIENT_STATUS.RETURNED;
  return normalized;
}

function deriveRequesterLifecycleStatus(recipientStatuses) {
  const statuses = Array.isArray(recipientStatuses)
    ? recipientStatuses.map((status) => normalizeRecipientStatus(status)).filter(Boolean)
    : [];
  if (!statuses.length) return null;
  if (statuses.includes(RECIPIENT_STATUS.RETURNED)) return RECIPIENT_STATUS.RETURNED;
  if (statuses.includes(RECIPIENT_STATUS.DECLINED)) return RECIPIENT_STATUS.RETURNED;
  if (statuses.includes(RECIPIENT_STATUS.RELEASED)) return 'PENDING';
  if (statuses.includes(RECIPIENT_STATUS.RECEIVED)) return RECIPIENT_STATUS.RECEIVED;
  if (statuses.includes(RECIPIENT_STATUS.COMPLETED)) return RECIPIENT_STATUS.COMPLETED;
  if (statuses.includes(RECIPIENT_STATUS.FORWARDED)) return RECIPIENT_STATUS.FORWARDED;
  return null;
}

function getDateRange(datePreset, fromDate, toDate) {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  end.setHours(23, 59, 59, 999);
  start.setHours(0, 0, 0, 0);

  const preset = String(datePreset || 'last7').toLowerCase();
  if (preset === 'last7') {
    start.setDate(start.getDate() - 6);
    return { start, end };
  }
  if (preset === 'last30') {
    start.setDate(start.getDate() - 29);
    return { start, end };
  }
  if (preset === 'custom') {
    if (!fromDate || !toDate) return null;
    const customStart = new Date(fromDate);
    const customEnd = new Date(toDate);
    if (Number.isNaN(customStart.getTime()) || Number.isNaN(customEnd.getTime())) return null;
    customStart.setHours(0, 0, 0, 0);
    customEnd.setHours(23, 59, 59, 999);
    return { start: customStart, end: customEnd };
  }
  return { start, end };
}

// Generate report (placeholder)
router.get('/', async (req, res) => {
  res.json({ message: 'Generate report (placeholder)' });
});

// GET /api/reports/my-office?datePreset=last7|last30|custom&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
router.get('/my-office', requireUser, async (req, res) => {
  try {
    const officeId = req.userRecord.office_id;
    const officeName = req.userRecord.office ? req.userRecord.office.office_name : '';
    const datePreset = String(req.query.datePreset || 'last7').toLowerCase();
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    const range = getDateRange(datePreset, fromDate, toDate);
    if (!range) {
      return res.status(400).json({ message: 'Invalid date range.' });
    }

    // Document-scope filter: include docs with at least one status step within range.
    const datedStatusRows = await StatusLog.findAll({
      attributes: ['document_id'],
      where: {
        date: { [Op.between]: [range.start, range.end] }
      },
      group: ['document_id'],
      raw: true
    });
    const dateScopedIds = new Set(
      datedStatusRows.map((row) => row.document_id).filter(Boolean).map((id) => String(id))
    );

    if (dateScopedIds.size === 0) {
      return res.json({
        office: { id: officeId, name: officeName || 'Unknown Office' },
        filters: {
          datePreset,
          startDate: range.start.toISOString(),
          endDate: range.end.toISOString(),
          generatedAt: new Date().toISOString()
        },
        created_documents: [],
        handled_documents: [],
        documents: []
      });
    }

    const dateScopedIdList = Array.from(dateScopedIds);

    // Created by my office: requester/originating office equals current office.
    const requesterDocs = await Document.findAll({
      attributes: ['id'],
      where: {
        requester_office_id: officeId,
        id: { [Op.in]: dateScopedIdList }
      },
      raw: true
    });
    const createdIds = new Set(
      requesterDocs.map((row) => row.id).filter(Boolean).map((id) => String(id))
    );

    const routeRows = await StatusLog.findAll({
      attributes: ['document_id'],
      where: {
        document_id: { [Op.in]: dateScopedIdList },
        [Op.or]: [
          { from_office_id: officeId },
          { to_office_id: officeId }
        ]
      },
      group: ['document_id'],
      raw: true
    });
    const routeIds = new Set(
      routeRows.map((row) => row.document_id).filter(Boolean).map((id) => String(id))
    );

    // Handled by my office: route history involvement OR currently owned by office.
    const currentOfficeDocs = await Document.findAll({
      attributes: ['id'],
      where: {
        current_office_id: officeId,
        id: { [Op.in]: dateScopedIdList }
      },
      raw: true
    });
    const currentOfficeIds = new Set(
      currentOfficeDocs.map((row) => row.id).filter(Boolean).map((id) => String(id))
    );

    const recipientRows = await DocumentRecipient.findAll({
      attributes: ['document_id'],
      where: {
        document_id: { [Op.in]: dateScopedIdList },
        recipient_office_id: officeId
      },
      group: ['document_id'],
      raw: true
    });
    const recipientIds = new Set(
      recipientRows.map((row) => row.document_id).filter(Boolean).map((id) => String(id))
    );

    const handledCandidateIds = new Set([...routeIds, ...currentOfficeIds, ...recipientIds]);
    const handledIds = new Set(
      Array.from(handledCandidateIds).filter((id) => !createdIds.has(id))
    );

    const eligibleIds = Array.from(new Set([...createdIds, ...handledIds]));
    if (eligibleIds.length === 0) {
      return res.json({
        office: { id: officeId, name: officeName || 'Unknown Office' },
        filters: {
          datePreset,
          startDate: range.start.toISOString(),
          endDate: range.end.toISOString(),
          generatedAt: new Date().toISOString()
        },
        created_documents: [],
        handled_documents: [],
        documents: []
      });
    }

    const recipientStatusRows = await DocumentRecipient.findAll({
      attributes: ['document_id', 'recipient_status'],
      where: {
        document_id: { [Op.in]: eligibleIds }
      },
      raw: true
    });
    const recipientStatusesByDocument = new Map();
    recipientStatusRows.forEach((row) => {
      const docId = String(row.document_id || '');
      if (!docId) return;
      const list = recipientStatusesByDocument.get(docId) || [];
      list.push(row.recipient_status);
      recipientStatusesByDocument.set(docId, list);
    });

    const officeRecipientStatusRows = await DocumentRecipient.findAll({
      attributes: ['document_id', 'recipient_status', 'updated_at'],
      where: {
        document_id: { [Op.in]: eligibleIds },
        recipient_office_id: officeId
      },
      order: [['updated_at', 'DESC']],
      raw: true
    });
    const officeRecipientStatusByDocument = new Map();
    officeRecipientStatusRows.forEach((row) => {
      const docId = String(row.document_id || '');
      if (!docId || officeRecipientStatusByDocument.has(docId)) return;
      officeRecipientStatusByDocument.set(docId, row.recipient_status);
    });

    const documents = await Document.findAll({
      where: { id: { [Op.in]: eligibleIds } },
      include: [
        {
          model: StatusLog,
          as: 'status_history',
          include: [
            { model: Office, as: 'from_office', attributes: ['id', 'office_name'] },
            { model: Office, as: 'to_office', attributes: ['id', 'office_name'] },
            { model: User, as: 'user', attributes: ['id', 'username'] }
          ]
        },
        { model: Office, as: 'current_office', attributes: ['id', 'office_name'] },
        { model: DocumentType, as: 'type', attributes: ['id', 'type_name'] }
      ],
      order: [['updated_at', 'DESC']]
    });

    const mappedDocuments = documents.map((doc) => {
      const history = Array.isArray(doc.status_history) ? [...doc.status_history] : [];
      history.sort((a, b) => {
        const tsDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (tsDiff !== 0) return tsDiff;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
      const latestTimelineDate = history.length > 0 ? history[history.length - 1].date : null;
      const docId = String(doc.id || '');
      const officeRecipientStatus = officeRecipientStatusByDocument.get(docId);
      const requesterDerivedStatus = createdIds.has(docId)
        ? deriveRequesterLifecycleStatus(recipientStatusesByDocument.get(docId))
        : null;
      const scopedStatus =
        requesterDerivedStatus ||
        formatRecipientLifecycleStatus(officeRecipientStatus) ||
        doc.status;
      return {
        id: doc.id,
        tracking_code: doc.document_code,
        title: doc.title,
        content: doc.content ?? null,
        type_name: doc.type ? doc.type.type_name : null,
        current_status: scopedStatus,
        last_updated: doc.updated_at || latestTimelineDate || null,
        timeline: history.map((item) => ({
          timestamp: item.date || null,
          document_code: doc.document_code || null,
          title: doc.title || null,
          from_office_id: item.from_office ? item.from_office.id : null,
          from_office_name: item.from_office ? item.from_office.office_name : null,
          to_office_id: item.to_office ? item.to_office.id : null,
          to_office_name: item.to_office ? item.to_office.office_name : null,
          status: item.status || '',
          action_by_user_id: item.user ? item.user.id : item.user_id,
          action_by_username: item.user ? item.user.username : 'System',
          remarks: item.remarks || ''
        }))
      };
    });

    const createdDocuments = [];
    const handledDocuments = [];
    mappedDocuments.forEach((doc) => {
      const docId = String(doc.id || '');
      if (createdIds.has(docId)) {
        createdDocuments.push(doc);
      } else if (handledIds.has(docId)) {
        handledDocuments.push(doc);
      }
    });

    return res.json({
      office: { id: officeId, name: officeName || 'Unknown Office' },
      filters: {
        datePreset,
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
        generatedAt: new Date().toISOString()
      },
      created_documents: createdDocuments,
      handled_documents: handledDocuments,
      documents: mappedDocuments
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load office report.', error: err.message });
  }
});

module.exports = router;