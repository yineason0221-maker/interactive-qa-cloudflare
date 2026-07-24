const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyAdminToken } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for video/audio
  fileFilter: (req, file, cb) => {
    const allowedMime = ['audio/mpeg', 'audio/mp3', 'video/mp4', 'audio/wav', 'video/webm'];
    if (allowedMime.includes(file.mimetype) || file.originalname.match(/\.(mp3|mp4|wav|webm)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('只支援 MP3, WAV 音訊及 MP4, WEBM 影片檔案'));
    }
  }
});

// POST /api/upload - Admin Only
router.post('/', verifyAdminToken, upload.single('mediaFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '請選擇要上傳的檔案' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  return res.json({
    success: true,
    fileUrl,
    filename: req.file.originalname,
    mimeType: req.file.mimetype
  });
});

module.exports = router;
