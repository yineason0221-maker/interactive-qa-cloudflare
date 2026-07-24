const express = require('express');
const router = express.Router();
const db = require('../database');
const { verifyAdminToken } = require('../middleware/auth');

// POST /api/responses/start
router.post('/start', (req, res) => {
  const { sessionId, deviceInfo } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: '需要 sessionId' });
  }

  try {
    const nowUTC = db.prepare("SELECT strftime('%Y-%m-%dT%H:%M:%S', 'now', 'utc') as now").get().now + 'Z';
    const stmt = db.prepare(`
      INSERT INTO sessions (session_id, start_time, device_info)
      VALUES (?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET start_time=?
    `);
    stmt.run(sessionId, nowUTC, deviceInfo || '', nowUTC);
    return res.json({ success: true, sessionId, startTime: nowUTC });
  } catch (err) {
    console.error('Error starting session:', err);
    return res.status(500).json({ error: '建立 session 失敗' });
  }
});

// POST /api/responses/answer
router.post('/answer', (req, res) => {
  const { sessionId, stepId, stepTitle, questionText, answerValue, nickname } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: '缺少 sessionId' });
  }

  try {
    // If nickname is passed, update session nickname
    if (nickname) {
      db.prepare('UPDATE sessions SET nickname = ? WHERE session_id = ?').run(nickname, sessionId);
    }

    const nowUTC = db.prepare("SELECT strftime('%Y-%m-%dT%H:%M:%S', 'now', 'utc') as now").get().now + 'Z';
    db.prepare(`
      INSERT INTO answers (session_id, step_id, step_title, question_text, answer_value, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, stepId || null, stepTitle || '', questionText || '', String(answerValue), nowUTC);

    return res.json({ success: true });
  } catch (err) {
    console.error('Error recording answer:', err);
    return res.status(500).json({ error: '儲存回答失敗' });
  }
});

// POST /api/responses/log
router.post('/log', (req, res) => {
  const { sessionId, eventType, detail } = req.body;
  if (!sessionId || !eventType) {
    return res.status(400).json({ error: '缺少必填欄位' });
  }

  try {
    const nowUTC = db.prepare("SELECT strftime('%Y-%m-%dT%H:%M:%S', 'now', 'utc') as now").get().now + 'Z';
    db.prepare(`
      INSERT INTO logs (session_id, event_type, detail, created_at)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, eventType, detail || '', nowUTC);

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: '紀錄日誌失敗' });
  }
});

// POST /api/responses/finish
router.post('/finish', (req, res) => {
  const { sessionId, nickname } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: '缺少 sessionId' });
  }

  try {
    const session = db.prepare('SELECT start_time FROM sessions WHERE session_id = ?').get(sessionId);
    const rawStart = session && session.start_time ? session.start_time : null;
    const startISO = rawStart ? rawStart.replace(/Z$/, '').replace(' ', 'T') + 'Z' : null;
    const startTime = startISO ? new Date(startISO).getTime() : Date.now();
    const endTime = Date.now();
    const durationSeconds = Math.max(0, Math.round((endTime - startTime) / 1000));

    const endUTC = db.prepare("SELECT strftime('%Y-%m-%dT%H:%M:%S', 'now', 'utc') as now").get().now;
    db.prepare(`
      UPDATE sessions
      SET end_time = ?,
          duration_seconds = ?,
          nickname = COALESCE(?, nickname)
      WHERE session_id = ?
    `).run(endUTC, durationSeconds, nickname || null, sessionId);

    return res.json({ success: true, durationSeconds });
  } catch (err) {
    console.error('Error finishing session:', err);
    return res.status(500).json({ error: '更新完成狀態失敗' });
  }
});

// GET /api/responses/analytics - Admin Only
router.get('/analytics', verifyAdminToken, (req, res) => {
  try {
    const sessions = db.prepare('SELECT * FROM sessions ORDER BY start_time DESC').all();
    const answers = db.prepare('SELECT * FROM answers ORDER BY created_at ASC').all();
    const logs = db.prepare('SELECT * FROM logs ORDER BY created_at ASC').all();

    // Group answers and logs by session_id
    const answersBySession = {};
    answers.forEach(a => {
      if (!answersBySession[a.session_id]) answersBySession[a.session_id] = [];
      answersBySession[a.session_id].push(a);
    });

    const logsBySession = {};
    logs.forEach(l => {
      if (!logsBySession[l.session_id]) logsBySession[l.session_id] = [];
      logsBySession[l.session_id].push(l);
    });

    const result = sessions.map(s => ({
      ...s,
      answers: answersBySession[s.session_id] || [],
      logs: logsBySession[s.session_id] || []
    }));

    return res.json({
      success: true,
      totalCount: sessions.length,
      sessions: result
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    return res.status(500).json({ error: '無法讀取數據分析紀錄' });
  }
});

// GET /api/responses/incomplete - Admin Only (sessions still in progress)
router.get('/incomplete', verifyAdminToken, (req, res) => {
  try {
    const incomplete = db.prepare(`
      SELECT s.*,
        ROUND((julianday('now', 'utc') - julianday(s.start_time)) * 86400) as dwell_seconds
      FROM sessions s
      WHERE s.end_time IS NULL OR s.end_time = ''
      ORDER BY s.start_time DESC
    `).all();

    const enriched = incomplete.map(s => {
      const answerCount = db.prepare('SELECT COUNT(*) as cnt FROM answers WHERE session_id = ?').get(s.session_id).cnt;
      const lastAnswer = db.prepare('SELECT * FROM answers WHERE session_id = ? ORDER BY created_at DESC LIMIT 1').get(s.session_id);
      return {
        ...s,
        answerCount,
        lastStepTitle: lastAnswer ? lastAnswer.step_title : null,
        lastAnswerTime: lastAnswer ? lastAnswer.created_at : null
      };
    });

    return res.json({ success: true, sessions: enriched });
  } catch (err) {
    console.error('Error fetching incomplete sessions:', err);
    return res.status(500).json({ error: '查詢未完成紀錄失敗' });
  }
});

// DELETE /api/responses/clear-all - Admin Only
router.delete('/clear-all', verifyAdminToken, (req, res) => {
  try {
    const clearTransaction = db.transaction(() => {
      db.prepare('DELETE FROM logs').run();
      db.prepare('DELETE FROM answers').run();
      db.prepare('DELETE FROM sessions').run();
    });
    clearTransaction();

    return res.json({
      success: true,
      message: '所有使用者作答紀錄、停留時間與行為軌跡已一鍵清空！'
    });
  } catch (err) {
    console.error('Error clearing analytics:', err);
    return res.status(500).json({ error: '清除紀錄失敗' });
  }
});

module.exports = router;
