const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { verifyAdminToken, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: '請輸入密碼' });
  }

  const adminRow = db.prepare('SELECT * FROM admin WHERE id = 1').get();
  if (!adminRow) {
    return res.status(500).json({ error: '系統未設定管理員資料' });
  }

  const isValid = bcrypt.compareSync(password, adminRow.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: '密碼錯誤' });
  }

  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({
    success: true,
    token,
    message: '登入成功'
  });
});

// POST /api/auth/change-password
router.post('/change-password', verifyAdminToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: '請提供舊密碼與新密碼' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: '新密碼長度至少需要 4 個字元' });
  }

  const adminRow = db.prepare('SELECT * FROM admin WHERE id = 1').get();
  const isValid = bcrypt.compareSync(currentPassword, adminRow.password_hash);
  if (!isValid) {
    return res.status(400).json({ error: '舊密碼不正確' });
  }

  const newHash = bcrypt.hashSync(newPassword, 8);
      db.prepare('UPDATE admin SET password_hash = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%S\', \'now\', \'localtime\') WHERE id = 1').run(newHash);

  return res.json({
    success: true,
    message: '密碼更新成功！請記住新密碼。'
  });
});

module.exports = router;
