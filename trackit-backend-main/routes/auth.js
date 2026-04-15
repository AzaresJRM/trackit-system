const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { User, Office, PasswordResetRequest } = require('../models');
const { requireUser } = require('../middleware/requireUser');

const JWT_SECRET = process.env.JWT_SECRET || 'trackit-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const GENERIC_RESET_RESPONSE = { message: 'Request sent to Admin.' };

router.post('/auth/password-reset-request', async (req, res) => {
  const requestedIdentifier = String(req.body?.requested_identifier || req.body?.username || '').trim();
  const message = String(req.body?.message || '').trim();

  if (!requestedIdentifier) {
    return res.status(200).json(GENERIC_RESET_RESPONSE);
  }

  try {
    const account = await User.findOne({
      where: { username: requestedIdentifier, is_active: true }
    });

    await PasswordResetRequest.create({
      office_account_id: account ? account.id : null,
      requested_identifier: requestedIdentifier,
      message: message || null,
      status: 'PENDING'
    });
  } catch (err) {
    // Intentionally return the same generic response to avoid leaking details.
    console.error('password-reset-request error:', err);
  }

  return res.status(200).json(GENERIC_RESET_RESPONSE);
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof fetch === 'function') {
      // #region agent log
      fetch('http://127.0.0.1:7507/ingest/940a8e2d-ccff-48a6-a6db-a34f92dab6b3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9cc7bf'},body:JSON.stringify({sessionId:'9cc7bf',runId:'run1',hypothesisId:'H2',location:'routes/auth.js:13',message:'login route entered',data:{hasUsername:Boolean(username),usernameLength:String(username||'').length,hasPassword:Boolean(password)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }
    const user = await User.findOne({
      where: { username, is_active: true },
      include: [{ model: Office, as: 'office' }]
    });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // Support migrated and legacy plaintext passwords.
    const dbPassword = String(user.password || '');
    const hasHash = dbPassword.startsWith('$2');
    const isPasswordValid = hasHash
      ? await bcrypt.compare(String(password || ''), dbPassword)
      : dbPassword === String(password || '');
    if (typeof fetch === 'function') {
      // #region agent log
      fetch('http://127.0.0.1:7507/ingest/940a8e2d-ccff-48a6-a6db-a34f92dab6b3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9cc7bf'},body:JSON.stringify({sessionId:'9cc7bf',runId:'run1',hypothesisId:'H2',location:'routes/auth.js:29',message:'login credential evaluation',data:{userFound:Boolean(user),hasHash,isPasswordValid},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // Upgrade legacy plaintext credentials to bcrypt hash on successful login.
    if (!hasHash) {
      const hashed = await bcrypt.hash(String(password || ''), Number(process.env.BCRYPT_SALT_ROUNDS || 10));
      await user.update({ password: hashed });
    }

    // Exclude password from response and map ID for frontend
    const userObj = user.toJSON();
    delete userObj.password;
    userObj._id = userObj.id;
    if (userObj.office) {
      userObj.office_id = { ...userObj.office, _id: userObj.office.id };
      delete userObj.office;
    }
    userObj.must_change_password = Boolean(user.must_change_password);

    // Issue JWT token with basic user info
    const payload = {
      id: userObj._id,
      username: userObj.username,
      role: userObj.role || 'USER'
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    userObj.token = token;

    res.json(userObj);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

router.post('/auth/change-password', requireUser, async (req, res) => {
  try {
    const currentPassword = String(req.body?.current_password || '');
    const newPassword = String(req.body?.new_password || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'current_password and new_password are required.' });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `new_password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    const user = req.userRecord || await User.findByPk(req.user?.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const dbPassword = String(user.password || '');
    const hasHash = dbPassword.startsWith('$2');
    const isCurrentValid = hasHash
      ? await bcrypt.compare(currentPassword, dbPassword)
      : dbPassword === currentPassword;
    if (!isCurrentValid) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    const hashed = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await user.update({
      password: hashed,
      must_change_password: false
    });

    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ message: 'Failed to update password.' });
  }
});

// Debug route to list all users
router.get('/debug-users', async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users.map((user) => {
      const value = user.toJSON();
      delete value.password;
      return value;
    }));
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
});

module.exports = router;