const express = require('express');
const { Op } = require('sequelize');
const { requireUser } = require('../middleware/requireUser');
const { StatusLog, Document, Office, UserNotificationState } = require('../models');

const router = express.Router();

function resolveNotificationType(statusValue) {
  const status = String(statusValue || '').toUpperCase();
  if (status.includes('RETURNED')) return 'returned';
  if (status.includes('RECEIVED BY')) return 'received';
  if (status.includes('FORWARDED BY')) return 'forwarded';
  if (status.includes('COMPLETED BY')) return 'completed';
  return null;
}

router.get('/', requireUser, async (req, res) => {
  try {
    const officeId = req.userRecord?.office_id;
    const userId = req.userRecord?.id;
    if (!officeId || !userId) {
      return res.status(403).json({ error: 'User office is not configured.' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const state = await UserNotificationState.findOne({ where: { user_id: userId } });
    const lastSeenAt = state?.last_seen_at ? new Date(state.last_seen_at) : null;

    const rows = await StatusLog.findAll({
      where: {
        [Op.or]: [{ from_office_id: officeId }, { to_office_id: officeId }]
      },
      include: [
        { model: Document, as: 'document', attributes: ['id', 'document_code', 'title'] },
        { model: Office, as: 'from_office', attributes: ['id', 'office_name'] },
        { model: Office, as: 'to_office', attributes: ['id', 'office_name'] }
      ],
      order: [['date', 'DESC'], ['id', 'DESC']],
      limit: 500
    });

    const items = rows
      .map((row) => {
        const type = resolveNotificationType(row.status);
        if (!type) return null;
        const rowDate = row.date ? new Date(row.date) : null;
        const isRead = Boolean(lastSeenAt && rowDate && rowDate <= lastSeenAt);
        return {
          id: row.id,
          type,
          status: row.status,
          remarks: row.remarks || '',
          date: row.date,
          is_read: isRead,
          document_id: row.document ? row.document.id : null,
          document_code: row.document ? row.document.document_code : null,
          title: row.document ? row.document.title : null,
          from_office: row.from_office
            ? { id: row.from_office.id, office_name: row.from_office.office_name }
            : null,
          to_office: row.to_office
            ? { id: row.to_office.id, office_name: row.to_office.office_name }
            : null
        };
      })
      .filter(Boolean)
      .slice(0, limit);

    const unread_count = items.filter((item) => !item.is_read).length;
    return res.json({
      items,
      unread_count,
      last_seen_at: state?.last_seen_at || null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/mark-seen', requireUser, async (req, res) => {
  try {
    const userId = req.userRecord?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid user context.' });
    }
    const nextSeenAtRaw = req.body?.last_seen_at;
    const nextSeenAt = nextSeenAtRaw ? new Date(nextSeenAtRaw) : new Date();
    if (Number.isNaN(nextSeenAt.getTime())) {
      return res.status(400).json({ error: 'Invalid last_seen_at value.' });
    }
    const nextSeenLogId = req.body?.last_seen_log_id || null;

    const existing = await UserNotificationState.findOne({ where: { user_id: userId } });
    if (!existing) {
      await UserNotificationState.create({
        user_id: userId,
        last_seen_at: nextSeenAt,
        last_seen_log_id: nextSeenLogId,
        created_at: new Date(),
        updated_at: new Date()
      });
    } else {
      await existing.update({
        last_seen_at: nextSeenAt,
        last_seen_log_id: nextSeenLogId,
        updated_at: new Date()
      });
    }

    return res.json({ success: true, last_seen_at: nextSeenAt, last_seen_log_id: nextSeenLogId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
