const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { User, Office } = require('../models');
const { requireAdmin } = require('../middleware/adminAuth');

const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const UUID_V4_OR_V1_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function emitUsersDebug(hypothesisId, location, message, data) {
  // #region agent log
  fetch('http://127.0.0.1:7529/ingest/2186c759-b7ed-45d3-980b-04cc62c10e13',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'605efb'},body:JSON.stringify({sessionId:'605efb',runId:'pre-fix',hypothesisId,location,message,data,timestamp:Date.now()})}).catch(()=>{});
  // #endregion
}

function emitUsersDebugPostFix(hypothesisId, location, message, data) {
  // #region agent log
  fetch('http://127.0.0.1:7529/ingest/2186c759-b7ed-45d3-980b-04cc62c10e13',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'605efb'},body:JSON.stringify({sessionId:'605efb',runId:'post-fix',hypothesisId,location,message,data,timestamp:Date.now()})}).catch(()=>{});
  // #endregion
}

function parseBooleanOrDefault(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function isLikelyOfficeCode(value) {
  return /^[A-Za-z]{2,10}$/.test(String(value || '').trim());
}

function getOfficeIdValidationError(officeIdRaw) {
  const officeId = String(officeIdRaw || '').trim();
  if (!officeId) {
    return 'office_id is required and must be a UUID.';
  }
  if (!UUID_V4_OR_V1_REGEX.test(officeId)) {
    if (isLikelyOfficeCode(officeId)) {
      return `office_id must be a UUID. Received office_code "${officeId}" instead.`;
    }
    return 'office_id must be a valid UUID.';
  }
  return null;
}

function sanitizeUser(user) {
  const mapped = {
    ...user.toJSON(),
    _id: user.id,
    office_id: user.office ? { ...user.office.toJSON(), _id: user.office.id } : user.office_id
  };
  delete mapped.password;
  return mapped;
}

// Get all users
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      where: { is_active: true },
      order: [['username', 'ASC']],
      include: [{ model: Office, as: 'office' }]
    });
    const mapped = users.map(sanitizeUser);
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user (bcrypt-hashed password)
router.post('/', requireAdmin, async (req, res) => {
  const { username, password, office_id, role, is_active } = req.body;
  emitUsersDebug('H3', 'routes/users.js:45', 'create user payload received', {
    username,
    role,
    office_id,
    officeIdType: typeof office_id,
    looksLikeUuid: UUID_V4_OR_V1_REGEX.test(String(office_id || ''))
  });
  try {
    const usernameValue = String(username || '').trim();
    const passwordValue = String(password || '');
    const roleValue = String(role || '').trim().toUpperCase() || 'USER';
    const officeIdError = getOfficeIdValidationError(office_id);
    if (!usernameValue || !passwordValue || !roleValue) {
      return res.status(400).json({ message: 'username, password, role, and office_id are required.' });
    }
    if (passwordValue.length < 8) {
      return res.status(400).json({ message: 'password must be at least 8 characters.' });
    }
    if (officeIdError) {
      return res.status(400).json({ message: officeIdError });
    }
    const officeIdValue = String(office_id).trim();
    const office = await Office.findByPk(officeIdValue);
    emitUsersDebugPostFix('H7', 'routes/users.js:88', 'create user office lookup', {
      office_id: officeIdValue,
      officeFound: Boolean(office),
      isActive: Boolean(office?.is_active)
    });
    if (!office || office.is_active === false) {
      return res.status(400).json({ message: 'office_id must reference an existing active office.' });
    }

    const hashed = await bcrypt.hash(passwordValue, BCRYPT_SALT_ROUNDS);
    const newUser = await User.create({
      username: usernameValue,
      password: hashed,
      office_id: officeIdValue,
      role: roleValue,
      is_active: parseBooleanOrDefault(is_active, true)
    });
    const created = await User.findByPk(newUser.id, { include: [{ model: Office, as: 'office' }] });
    emitUsersDebugPostFix('H7', 'routes/users.js:106', 'create user success', {
      userId: newUser.id,
      office_id: officeIdValue
    });
    return res.json(sanitizeUser(created || newUser));
  } catch (err) {
    emitUsersDebug('H3', 'routes/users.js:59', 'create user failed', {
      name: err?.name || null,
      message: err?.message || null,
      code: err?.original?.code || err?.code || null,
      detail: err?.original?.detail || null
    });
    return res.status(500).json({ message: 'Failed to create user.' });
  }
});

// Update user
router.put('/:id', requireAdmin, async (req, res) => {
  const { username, office_id, role, is_active } = req.body;
  emitUsersDebug('H4', 'routes/users.js:72', 'update user payload received', {
    userId: req.params.id,
    username,
    role,
    office_id,
    officeIdType: typeof office_id,
    looksLikeUuid: UUID_V4_OR_V1_REGEX.test(String(office_id || ''))
  });
  try {
    const user = await User.findByPk(req.params.id, { include: [{ model: Office, as: 'office' }] });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updates = {};
    if (username !== undefined) updates.username = String(username || '').trim();
    if (role !== undefined) updates.role = String(role || '').trim().toUpperCase();
    if (is_active !== undefined) updates.is_active = parseBooleanOrDefault(is_active, user.is_active);

    if (office_id !== undefined) {
      const officeIdError = getOfficeIdValidationError(office_id);
      if (officeIdError) {
        return res.status(400).json({ message: officeIdError });
      }
      const officeIdValue = String(office_id).trim();
      const office = await Office.findByPk(officeIdValue);
      emitUsersDebugPostFix('H8', 'routes/users.js:138', 'update user office lookup', {
        userId: req.params.id,
        office_id: officeIdValue,
        officeFound: Boolean(office),
        isActive: Boolean(office?.is_active)
      });
      if (!office || office.is_active === false) {
        return res.status(400).json({ message: 'office_id must reference an existing active office.' });
      }
      updates.office_id = officeIdValue;
    }

    await user.update(updates);
    const updated = await User.findByPk(req.params.id, { include: [{ model: Office, as: 'office' }] });
    return res.json(sanitizeUser(updated || user));
  } catch (err) {
    emitUsersDebug('H4', 'routes/users.js:89', 'update user failed', {
      name: err?.name || null,
      message: err?.message || null,
      code: err?.original?.code || err?.code || null,
      detail: err?.original?.detail || null
    });
    return res.status(500).json({ message: 'Failed to update user.' });
  }
});

// Delete user (soft deactivate for backwards compatibility)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ is_active: false });
    res.json({ _id: req.params.id, message: 'User deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug route to list all users
router.get('/debug-users', requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users.map((u) => {
      const value = u.toJSON();
      delete value.password;
      return value;
    }));
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;