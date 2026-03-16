const express = require('express');
const bcrypt = require('bcryptjs');
const { User, Office, PasswordResetRequest } = require('../models');
const { requireAdmin } = require('../middleware/adminAuth');

const router = express.Router();
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const RESET_REQUEST_STATUSES = new Set(['PENDING', 'RESOLVED', 'REJECTED']);

router.use(requireAdmin);

function emitAdminDebug(message, data) {
  // #region agent log
  fetch('http://127.0.0.1:7507/ingest/940a8e2d-ccff-48a6-a6db-a34f92dab6b3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9cc7bf'},body:JSON.stringify({sessionId:'9cc7bf',runId:'run1',hypothesisId:'H3',location:'routes/admin.js:14',message,data,timestamp:Date.now()})}).catch(()=>{});
  // #endregion
}

function sanitizeUser(user) {
  const value = user.toJSON();
  value._id = user.id;
  if (value.office) {
    value.office_id = { ...value.office, _id: value.office.id };
    delete value.office;
  }
  delete value.password;
  return value;
}

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      include: [{ model: Office, as: 'office' }],
      order: [['username', 'ASC']]
    });
    return res.json(users.map(sanitizeUser));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load users.' });
  }
});

// GET /api/admin/offices
router.get('/offices', async (req, res) => {
  try {
    const offices = await Office.findAll({
      order: [['office_name', 'ASC']]
    });
    const mapped = offices.map((o) => ({
      ...o.toJSON(),
      _id: o.id
    }));
    return res.json(mapped);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load offices.' });
  }
});

// GET /api/admin/password-reset-requests?status=pending
router.get('/password-reset-requests', async (req, res) => {
  try {
    const requestedStatus = String(req.query?.status || 'PENDING').trim().toUpperCase();
    const where = RESET_REQUEST_STATUSES.has(requestedStatus) ? { status: requestedStatus } : {};

    const requests = await PasswordResetRequest.findAll({
      where,
      include: [{
        model: User,
        as: 'office_account',
        attributes: ['id', 'username', 'office_id'],
        include: [{
          model: Office,
          as: 'office',
          attributes: ['id', 'office_name', 'office_code']
        }]
      }],
      order: [['created_at', 'DESC']]
    });

    const mapped = requests.map((request) => {
      const value = request.toJSON();
      value._id = value.id;
      if (value.office_account) {
        value.office_account._id = value.office_account.id;
        if (value.office_account.office) {
          value.office_account.office._id = value.office_account.office.id;
        }
      }
      return value;
    });

    return res.json(mapped);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load password reset requests.' });
  }
});

// PATCH /api/admin/users/:id/active
router.patch('/users/:id/active', async (req, res) => {
  try {
    const { is_active } = req.body || {};
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ message: 'is_active must be a boolean.' });
    }

    const user = await User.findByPk(req.params.id, {
      include: [{ model: Office, as: 'office' }]
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await user.update({ is_active });
    return res.json(sanitizeUser(user));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update user active state.' });
  }
});

// PATCH /api/admin/offices/:id/active
router.patch('/offices/:id/active', async (req, res) => {
  try {
    const { is_active } = req.body || {};
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ message: 'is_active must be a boolean.' });
    }

    const office = await Office.findByPk(req.params.id);
    if (!office) {
      return res.status(404).json({ message: 'Office not found.' });
    }

    await office.update({ is_active });
    return res.json({ ...office.toJSON(), _id: office.id });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update office active state.' });
  }
});

// PATCH /api/admin/users/:id/password
router.patch('/users/:id/password', async (req, res) => {
  try {
    const newPassword = String(req.body?.new_password || '').trim();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `new_password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const hashed = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await user.update({ password: hashed });
    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update password.' });
  }
});

// POST /api/admin/password-reset-requests/:id/resolve
router.post('/password-reset-requests/:id/resolve', async (req, res) => {
  try {
    const tempPassword = String(req.body?.temp_password || '').trim();
    if (tempPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `temp_password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    const requestRecord = await PasswordResetRequest.findByPk(req.params.id);
    if (!requestRecord) {
      return res.status(404).json({ message: 'Password reset request not found.' });
    }
    if (requestRecord.status !== 'PENDING') {
      return res.status(400).json({ message: 'Password reset request is already processed.' });
    }
    if (!requestRecord.office_account_id) {
      return res.status(400).json({ message: 'No linked account exists for this request.' });
    }

    const user = await User.findByPk(requestRecord.office_account_id);
    if (!user) {
      return res.status(404).json({ message: 'Linked user account not found.' });
    }

    const hashed = await bcrypt.hash(tempPassword, BCRYPT_SALT_ROUNDS);
    await user.update({
      password: hashed,
      must_change_password: true
    });

    await requestRecord.update({
      status: 'RESOLVED',
      resolved_at: new Date(),
      resolved_by_admin_id: req.user?.id || null
    });

    return res.json({ message: 'Password reset request resolved successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to resolve password reset request.' });
  }
});

// PATCH /api/admin/me/password
router.patch('/me/password', async (req, res) => {
  try {
    const currentPassword = String(req.body?.current_password || '');
    const newPassword = String(req.body?.new_password || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'current_password and new_password are required.' });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `new_password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Invalid token payload.' });
    }
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    let isCurrentValid = false;
    if (user.password && user.password.startsWith('$2')) {
      isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    } else {
      isCurrentValid = user.password === currentPassword;
    }
    if (!isCurrentValid) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    const hashed = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await user.update({ password: hashed });
    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update password.' });
  }
});

// Disabled confidential admin endpoints
router.get('/stats', (req, res) => {
  emitAdminDebug('blocked confidential endpoint', { endpoint: '/api/admin/stats' });
  return res.status(403).json({ message: 'Forbidden by confidentiality policy.' });
});
router.get('/recent-activity', (req, res) => {
  emitAdminDebug('blocked confidential endpoint', { endpoint: '/api/admin/recent-activity' });
  return res.status(403).json({ message: 'Forbidden by confidentiality policy.' });
});
router.get('/logs/live', (req, res) => {
  emitAdminDebug('blocked confidential endpoint', { endpoint: '/api/admin/logs/live' });
  return res.status(403).json({ message: 'Forbidden by confidentiality policy.' });
});
router.get('/reports/office/:officeId/logs', (req, res) => {
  emitAdminDebug('blocked confidential endpoint', { endpoint: '/api/admin/reports/office/:officeId/logs' });
  return res.status(403).json({ message: 'Forbidden by confidentiality policy.' });
});

module.exports = router;

