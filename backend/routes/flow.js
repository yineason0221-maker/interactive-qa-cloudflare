const express = require('express');
const router = express.Router();
const db = require('../database');
const { verifyAdminToken } = require('../middleware/auth');
const multer = require('multer');
const zipStorage = multer.memoryStorage();
const zipUpload = multer({ storage: zipStorage, limits: { fileSize: 200 * 1024 * 1024 } });
const crypto = require('crypto');

function getEncryptionKey() {
  const secret = process.env.JWT_SECRET || 'default-backup-encryption-key';
  const key = crypto.scryptSync(secret, 'backup-salt', 32);
  return key;
}

function encryptField(text) {
  if (!text) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptField(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  const key = getEncryptionKey();
  const [ivHex, encryptedHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  try {
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return encryptedText;
  }
}

// GET /api/flow/steps - Public (for players and editor preview)
router.get('/steps', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM steps ORDER BY order_index ASC').all();
    const steps = rows.map(row => ({
      id: row.id,
      order_index: row.order_index,
      type: row.type,
      title: row.title,
      content: JSON.parse(row.content_json)
    }));
    return res.json({ success: true, steps });
  } catch (err) {
    console.error('Error fetching steps:', err);
    return res.status(500).json({ error: '獲取流程數據失敗' });
  }
});

// GET /api/flow/settings - Public
router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    rows.forEach(r => {
      if (r.key === 'bgm_timeline') {
        try { settings[r.key] = JSON.parse(r.value || '[]'); }
        catch { settings[r.key] = []; }
      } else {
        settings[r.key] = r.value;
      }
    });
    return res.json({ success: true, settings });
  } catch (err) {
    return res.status(500).json({ error: '獲取系統設定失敗' });
  }
});

// PUT /api/flow/settings - Admin Only
router.put('/settings', verifyAdminToken, (req, res) => {
  const { site_title, bgm_url, bgm_timeline, force_fullscreen } = req.body;
  try {
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    if (site_title !== undefined) upsert.run('site_title', String(site_title));
    if (bgm_url !== undefined) upsert.run('bgm_url', String(bgm_url));
    if (bgm_timeline !== undefined) upsert.run('bgm_timeline', JSON.stringify(bgm_timeline));
    if (force_fullscreen !== undefined) upsert.run('force_fullscreen', String(force_fullscreen));

    return res.json({ success: true, message: '設定已更新' });
  } catch (err) {
    return res.status(500).json({ error: '更新系統設定失敗' });
  }
});

// POST /api/flow/steps - Admin Only (Create Single Step)
router.post('/steps', verifyAdminToken, (req, res) => {
  const { type, title, content } = req.body;
  if (!type || !title || !content) {
    return res.status(400).json({ error: '缺少必要的欄位 (type, title, content)' });
  }

  try {
    const maxOrderRow = db.prepare('SELECT MAX(order_index) as max_order FROM steps').get();
    const nextOrder = (maxOrderRow.max_order !== null) ? maxOrderRow.max_order + 1 : 0;

    const result = db.prepare('INSERT INTO steps (order_index, type, title, content_json) VALUES (?, ?, ?, ?)').run(
      nextOrder,
      type,
      title,
      JSON.stringify(content)
    );

    return res.json({
      success: true,
      step: {
        id: result.lastInsertRowid,
        order_index: nextOrder,
        type,
        title,
        content
      }
    });
  } catch (err) {
    return res.status(500).json({ error: '新增步驟失敗' });
  }
});

// PUT /api/flow/steps/reorder - Admin Only (Batch Save / Reorder)
router.put('/steps/batch', verifyAdminToken, (req, res) => {
  const { steps } = req.body;
  if (!Array.isArray(steps)) {
    return res.status(400).json({ error: '步驟必須是陣列' });
  }

  try {
    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM steps').run();
      const insertStmt = db.prepare('INSERT INTO steps (id, order_index, type, title, content_json) VALUES (?, ?, ?, ?, ?)');
      steps.forEach((step, idx) => {
        insertStmt.run(
          step.id || null,
          idx,
          step.type,
          step.title,
          JSON.stringify(step.content)
        );
      });
    });

    deleteTransaction();
    return res.json({ success: true, message: '全域流程與順序已儲存' });
  } catch (err) {
    console.error('Error saving steps:', err);
    return res.status(500).json({ error: '儲存步驟失敗' });
  }
});

// DELETE /api/flow/steps/:id - Admin Only
router.delete('/steps/:id', verifyAdminToken, (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM steps WHERE id = ?').run(id);
    return res.json({ success: true, message: '已刪除該步驟' });
  } catch (err) {
    return res.status(500).json({ error: '刪除步驟失敗' });
  }
});

// GET /api/flow/export - Admin Only (export all steps + settings + uploads as ZIP)
router.get('/export', verifyAdminToken, (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs');
    const AdmZip = require('adm-zip');

    const steps = db.prepare('SELECT * FROM steps ORDER BY order_index ASC').all().map(row => ({
      id: row.id,
      order_index: row.order_index,
      type: row.type,
      title: row.title,
      content: JSON.parse(row.content_json)
    }));

    const settingsRows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });

    const adminRow = db.prepare('SELECT password_hash FROM admin WHERE id = 1').get();
    const adminPasswordHash = adminRow ? adminRow.password_hash : '';

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      steps,
      settings,
      adminPasswordHash
    };

    const jsonBuffer = Buffer.from(JSON.stringify(exportData, null, 2), 'utf8');
    const encryptedJson = encryptField(jsonBuffer.toString('utf8'));

    const zip = new AdmZip();
    zip.addFile('backup.json.enc', Buffer.from(encryptedJson, 'utf8'));

    const uploadsDir = path.join(__dirname, '../uploads');
    console.log('[Export] Uploads dir:', uploadsDir, 'exists:', fs.existsSync(uploadsDir));
    
    let uploadedFileCount = 0;
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      console.log('[Export] Files in uploads:', files);
      files.forEach(file => {
        const filePath = path.join(uploadsDir, file);
        if (fs.statSync(filePath).isFile()) {
          const fileBuffer = fs.readFileSync(filePath);
          zip.addFile('uploads/' + file, fileBuffer);
          uploadedFileCount++;
        }
      });
    }
    console.log('[Export] Added', uploadedFileCount, 'files to zip');

    const zipBuffer = zip.toBuffer();
    console.log('[Export] Zip size:', zipBuffer.length, 'bytes, entries:', zip.getEntries().length);
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=qa-backup-${new Date().toISOString().slice(0, 10)}.zip`);
    res.send(zipBuffer);
  } catch (err) {
    console.error('[Export] Error exporting data:', err);
    return res.status(500).json({ error: '導出備份失敗' });
  }
});

// POST /api/flow/import-zip - Admin Only (import zip backup with uploads)
router.post('/import-zip', verifyAdminToken, zipUpload.single('backup'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '請上傳備份 zip 檔案' });
  }

  const backupFile = req.file;
  const path = require('path');
  const fs = require('fs');
  const AdmZip = require('adm-zip');

  try {
    const zipBuffer = backupFile.buffer || backupFile.data;
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    const backupEntry = entries.find(e => !e.isDirectory && ['backup.json', 'backup.json.enc'].includes(e.entryName.replace(/^\.\//, '').split('/').pop()));
    if (!backupEntry) {
      const names = entries.map(e => e.entryName).join(', ');
      return res.status(400).json({ error: `備份檔案中缺少 backup.json，zip 內容: ${names}` });
    }

    let backupData;
    const entryName = backupEntry.entryName.replace(/^\.\//, '').split('/').pop();
    if (entryName === 'backup.json.enc') {
      const encrypted = backupEntry.getData().toString('utf8');
      const decrypted = decryptField(encrypted);
      backupData = JSON.parse(decrypted);
    } else {
      backupData = JSON.parse(backupEntry.getData().toString('utf8'));
    }

    if (!backupData.steps || !Array.isArray(backupData.steps)) {
      return res.status(400).json({ error: '無效的備份資料格式' });
    }

    const importTransaction = db.transaction(() => {
      if (backupData.settings && typeof backupData.settings === 'object') {
        const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
        Object.entries(backupData.settings).forEach(([key, value]) => {
          upsert.run(key, String(value));
        });
      }

      db.prepare('DELETE FROM steps').run();
      const insertStmt = db.prepare('INSERT INTO steps (id, order_index, type, title, content_json) VALUES (?, ?, ?, ?, ?)');
      (backupData.steps || []).forEach((step, idx) => {
        insertStmt.run(
          step.id || null,
          idx,
          step.type || 'subtitle',
          step.title || '未命名步驟',
          JSON.stringify(step.content || {})
        );
      });

      if (backupData.adminPasswordHash) {
        db.prepare('UPDATE admin SET password_hash = ? WHERE id = 1').run(backupData.adminPasswordHash);
      }
    });

    importTransaction();

    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    entries.forEach(entry => {
      if (entry.entryName.startsWith('uploads/') && !entry.isDirectory) {
        const fileName = entry.entryName.replace('uploads/', '');
        const destPath = path.join(uploadsDir, fileName);
        fs.writeFileSync(destPath, entry.getData());
        console.log('[Import] Restored file:', fileName, 'to', destPath);
      }
    });

    return res.json({ success: true, message: `已匯入 ${backupData.steps.length} 個步驟、設定與上傳檔案` });
  } catch (err) {
    console.error('Error importing zip backup:', err);
    return res.status(500).json({ error: '匯入備份失敗: ' + err.message });
  }
});

// POST /api/flow/import - Admin Only (import steps + settings from JSON)
router.post('/import', verifyAdminToken, (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !Array.isArray(data.steps)) {
      return res.status(400).json({ error: '無效的備份資料格式，缺少 steps 陣列' });
    }

    const importTransaction = db.transaction(() => {
      if (data.settings && typeof data.settings === 'object') {
        const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
        Object.entries(data.settings).forEach(([key, value]) => {
          upsert.run(key, String(value));
        });
      }

      db.prepare('DELETE FROM steps').run();
      const insertStmt = db.prepare('INSERT INTO steps (id, order_index, type, title, content_json) VALUES (?, ?, ?, ?, ?)');
      (data.steps || []).forEach((step, idx) => {
        insertStmt.run(
          step.id || null,
          idx,
          step.type || 'subtitle',
          step.title || '未命名步驟',
          JSON.stringify(step.content || {})
        );
      });
    });

    importTransaction();
    return res.json({ success: true, message: `已匯入 ${data.steps.length} 個步驟與設定` });
  } catch (err) {
    console.error('Error importing data:', err);
    return res.status(500).json({ error: '匯入備份失敗' });
  }
});

module.exports = router;
