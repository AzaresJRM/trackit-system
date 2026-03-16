const express = require('express');
const { StatusLog, User, Office } = require('../models');
const router = express.Router();

// Get logs for the admin dashboard
router.get('/', async (req, res) => {
  try {
    const logs = await StatusLog.findAll({
      order: [['date', 'DESC'], ['id', 'DESC']],
      limit: 50,
      include: [
        { model: User, as: 'user' },
        { model: Office, as: 'from_office' },
        { model: Office, as: 'to_office' }
      ]
    });

    const mappedLogs = logs.map(log => {
      let actionType = log.status || 'STATUS_UPDATE';
      let actionDetails = log.remarks || 'No remarks provided';
      const normalizedStatus = String(log.status || '').toUpperCase();
      if (
        log.from_office &&
        log.to_office &&
        log.from_office.id !== log.to_office.id &&
        !normalizedStatus.includes('FORWARDED BY')
      ) {
        actionType = 'TRANSFER';
        actionDetails = `Transferred from ${log.from_office.office_name} to ${log.to_office.office_name}`;
      }

      return {
        timestamp: log.date.toISOString(),
        user_id: log.user ? log.user.username : 'System',
        action_type: actionType,
        action_details: actionDetails
      };
    });

    res.json(mappedLogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;