const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'qa-interactive-admin-secret-key-2025';

function verifyAdminToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: '未提供身份認證 Token' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token 無效或已過期，請重新登入' });
  }
}

module.exports = {
  verifyAdminToken,
  JWT_SECRET
};
