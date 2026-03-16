const jwt = require('jsonwebtoken');
const { User, Office } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'trackit-secret-key';
const ALLOWED_WHEN_PASSWORD_CHANGE_REQUIRED = new Set([
  '/api/auth/change-password'
]);

function readToken(req) {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const queryToken = typeof req.query.access_token === 'string' ? req.query.access_token : '';
  return bearerToken || queryToken || null;
}

async function requireUser(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ message: 'Missing authorization token.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: 'Invalid token payload.' });
    }
    const user = await User.findOne({
      where: { id: decoded.id, is_active: true },
      include: [{ model: Office, as: 'office' }]
    });
    if (!user || !user.office_id) {
      return res.status(403).json({ message: 'User office is not configured.' });
    }
    const currentPath = String(req.originalUrl || '').split('?')[0];
    if (user.must_change_password && !ALLOWED_WHEN_PASSWORD_CHANGE_REQUIRED.has(currentPath)) {
      return res.status(403).json({
        message: 'Password change required before accessing this resource.',
        code: 'PASSWORD_CHANGE_REQUIRED'
      });
    }
    req.user = decoded;
    req.userRecord = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = {
  requireUser
};
