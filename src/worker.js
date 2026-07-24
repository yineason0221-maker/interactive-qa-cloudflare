import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AdmZip from 'adm-zip';
import { DEFAULT_ADMIN_PASSWORD, DEFAULT_SETTINGS, DEFAULT_STEPS } from './defaults.js';

const JWT_SECRET_FALLBACK = 'qa-interactive-admin-secret-key-2025';
const BACKUP_SECRET_FALLBACK = 'default-backup-encryption-key';
const TOKEN_TTL = '7d';

let initPromise = null;

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    ...extra
  };
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: corsHeaders(extraHeaders)
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

function nowUtc() {
  return new Date().toISOString().slice(0, 19) + 'Z';
}

function normalizeJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function getJwtSecret(env) {
  return env.JWT_SECRET || JWT_SECRET_FALLBACK;
}

function getBackupSecret(env) {
  return env.JWT_SECRET || BACKUP_SECRET_FALLBACK;
}

function getEncryptionKey(env) {
  return crypto.scryptSync(getBackupSecret(env), 'backup-salt', 32);
}

function encryptField(env, text) {
  if (!text) return '';
  const key = getEncryptionKey(env);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptField(env, encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  const key = getEncryptionKey(env);
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

async function queryAll(env, sql, params = []) {
  const stmt = env.DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const result = await bound.run();
  return result.results || [];
}

async function queryFirst(env, sql, params = []) {
  const rows = await queryAll(env, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function execute(env, sql, params = []) {
  const stmt = env.DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  return await bound.run();
}

async function ensureInitialized(env) {
  if (!initPromise) {
    initPromise = initializeDatabase(env);
  }
  await initPromise;
}

async function initializeDatabase(env) {
  await env.DB.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      password_hash TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_index INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      nickname TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      duration_seconds INTEGER DEFAULT 0,
      device_info TEXT
    );

    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      step_id INTEGER,
      step_title TEXT,
      question_text TEXT,
      answer_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    );
  `);

  const adminRow = await queryFirst(env, 'SELECT id FROM admin WHERE id = ?', [1]);
  if (!adminRow) {
    const defaultPassword = env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
    const defaultHash = crypto.pbkdf2Sync(defaultPassword, 'admin-salt', 120000, 32, 'sha256').toString('hex');
    await execute(env, 'INSERT INTO admin (id, password_hash) VALUES (?, ?)', [1, `pbkdf2$120000$admin-salt$${defaultHash}`]);
  }

  const stepCountRow = await queryFirst(env, 'SELECT COUNT(*) AS count FROM steps');
  if (!stepCountRow || Number(stepCountRow.count || 0) === 0) {
    for (const step of DEFAULT_STEPS) {
      await execute(
        env,
        'INSERT INTO steps (order_index, type, title, content_json) VALUES (?, ?, ?, ?)',
        [step.order_index, step.type, step.title, JSON.stringify(step.content)]
      );
    }
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await execute(
      env,
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      [key, value]
    );
  }
}

function parseStoredPasswordHash(stored) {
  if (!stored) return null;
  if (stored.startsWith('pbkdf2$')) {
    const [, iterationsText, salt, hashHex] = stored.split('$');
    return {
      iterations: Number(iterationsText || 120000),
      salt,
      hashHex
    };
  }
  return null;
}

function hashPassword(password, salt = 'admin-salt', iterations = 120000) {
  const hashHex = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
  return `pbkdf2$${iterations}$${salt}$${hashHex}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;

  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    return bcrypt.compareSync(password, stored);
  }

  const parsed = parseStoredPasswordHash(stored);
  if (!parsed) return false;
  const candidate = crypto.pbkdf2Sync(password, parsed.salt, parsed.iterations, 32, 'sha256').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(parsed.hashHex, 'hex'));
  } catch {
    return false;
  }
}

function getAdminToken(request, env) {
  const header = request.headers.get('authorization');
  if (!header) return null;
  return header.startsWith('Bearer ') ? header.slice(7) : header;
}

function requireAdmin(request, env) {
  const token = getAdminToken(request, env);
  if (!token) {
    return { ok: false, response: errorResponse('未提供身份認證 Token', 401) };
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(env));
    if (!decoded || decoded.role !== 'admin') {
      return { ok: false, response: errorResponse('Token 無效或已過期，請重新登入', 403) };
    }
    return { ok: true, decoded };
  } catch {
    return { ok: false, response: errorResponse('Token 無效或已過期，請重新登入', 403) };
  }
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function handleLogin(env, request) {
  const { password } = await readJsonBody(request);
  if (!password) return errorResponse('請輸入密碼', 400);

  const adminRow = await queryFirst(env, 'SELECT * FROM admin WHERE id = ?', [1]);
  if (!adminRow) return errorResponse('系統未設定管理員資料', 500);

  const isValid = verifyPassword(password, adminRow.password_hash);
  if (!isValid) return errorResponse('密碼錯誤', 401);

  const token = jwt.sign({ role: 'admin' }, getJwtSecret(env), { expiresIn: TOKEN_TTL });
  return jsonResponse({
    success: true,
    token,
    message: '登入成功'
  });
}

async function handleChangePassword(env, request) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  const { currentPassword, newPassword } = await readJsonBody(request);
  if (!currentPassword || !newPassword) {
    return errorResponse('請提供舊密碼與新密碼', 400);
  }

  if (newPassword.length < 4) {
    return errorResponse('新密碼長度至少需要 4 個字元', 400);
  }

  const adminRow = await queryFirst(env, 'SELECT * FROM admin WHERE id = ?', [1]);
  if (!adminRow || !verifyPassword(currentPassword, adminRow.password_hash)) {
    return errorResponse('舊密碼不正確', 400);
  }

  const newHash = hashPassword(newPassword, crypto.randomBytes(16).toString('hex'), 120000);
  await execute(
    env,
    'UPDATE admin SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
    [newHash]
  );

  return jsonResponse({
    success: true,
    message: '密碼更新成功！請記住新密碼。'
  });
}

async function handleGetSteps(env) {
  const rows = await queryAll(env, 'SELECT * FROM steps ORDER BY order_index ASC');
  const steps = rows.map(row => ({
    id: row.id,
    order_index: row.order_index,
    type: row.type,
    title: row.title,
    content: normalizeJson(row.content_json, {})
  }));
  return jsonResponse({ success: true, steps });
}

async function handleGetSettings(env) {
  const rows = await queryAll(env, 'SELECT * FROM settings');
  const settings = {};
  rows.forEach(row => {
    if (row.key === 'bgm_timeline') {
      settings[row.key] = normalizeJson(row.value, []);
    } else {
      settings[row.key] = row.value;
    }
  });
  return jsonResponse({ success: true, settings });
}

async function handleUpdateSettings(env, request) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  const body = await readJsonBody(request);
  const { site_title, bgm_url, bgm_timeline, force_fullscreen } = body;

  if (site_title !== undefined) {
    await execute(env, 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', ['site_title', String(site_title)]);
  }
  if (bgm_url !== undefined) {
    await execute(env, 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', ['bgm_url', String(bgm_url)]);
  }
  if (bgm_timeline !== undefined) {
    await execute(env, 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', ['bgm_timeline', JSON.stringify(bgm_timeline)]);
  }
  if (force_fullscreen !== undefined) {
    await execute(env, 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', ['force_fullscreen', String(force_fullscreen)]);
  }

  return jsonResponse({ success: true, message: '設定已更新' });
}

async function handleCreateStep(env, request) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  const { type, title, content } = await readJsonBody(request);
  if (!type || !title || !content) {
    return errorResponse('缺少必要的欄位 (type, title, content)', 400);
  }

  const maxOrderRow = await queryFirst(env, 'SELECT MAX(order_index) AS max_order FROM steps');
  const nextOrder = maxOrderRow && maxOrderRow.max_order !== null ? Number(maxOrderRow.max_order) + 1 : 0;

  const result = await execute(
    env,
    'INSERT INTO steps (order_index, type, title, content_json) VALUES (?, ?, ?, ?)',
    [nextOrder, type, title, JSON.stringify(content)]
  );

  return jsonResponse({
    success: true,
    step: {
      id: result.meta?.last_row_id,
      order_index: nextOrder,
      type,
      title,
      content
    }
  });
}

async function handleBatchSaveSteps(env, request) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  const { steps } = await readJsonBody(request);
  if (!Array.isArray(steps)) {
    return errorResponse('步驟必須是陣列', 400);
  }

  await execute(env, 'DELETE FROM steps');
  for (let idx = 0; idx < steps.length; idx += 1) {
    const step = steps[idx] || {};
    await execute(
      env,
      'INSERT INTO steps (id, order_index, type, title, content_json) VALUES (?, ?, ?, ?, ?)',
      [
        step.id || null,
        idx,
        step.type || 'subtitle',
        step.title || '未命名步驟',
        JSON.stringify(step.content || {})
      ]
    );
  }

  return jsonResponse({ success: true, message: '全域流程與順序已儲存' });
}

async function handleDeleteStep(env, stepId) {
  await execute(env, 'DELETE FROM steps WHERE id = ?', [stepId]);
  return jsonResponse({ success: true, message: '已刪除該步驟' });
}

async function handleExport(env) {
  try {
    const stepsRows = await queryAll(env, 'SELECT * FROM steps ORDER BY order_index ASC');
    const steps = stepsRows.map(row => ({
      id: row.id,
      order_index: row.order_index,
      type: row.type,
      title: row.title,
      content: normalizeJson(row.content_json, {})
    }));

    const settingsRows = await queryAll(env, 'SELECT * FROM settings');
    const settings = {};
    settingsRows.forEach(row => {
      settings[row.key] = row.value;
    });

    const adminRow = await queryFirst(env, 'SELECT password_hash FROM admin WHERE id = ?', [1]);
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      steps,
      settings,
      adminPasswordHash: adminRow ? adminRow.password_hash : ''
    };

    const zip = new AdmZip();
    const jsonBuffer = Buffer.from(JSON.stringify(exportData, null, 2), 'utf8');
    const encryptedJson = encryptField(env, jsonBuffer.toString('utf8'));
    zip.addFile('backup.json.enc', Buffer.from(encryptedJson, 'utf8'));

    const zipBuffer = zip.toBuffer();
    return new Response(zipBuffer, {
      headers: corsHeaders({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename=qa-backup-${new Date().toISOString().slice(0, 10)}.zip`
      })
    });
  } catch (err) {
    return errorResponse(`匯出備份失敗: ${err.message}`, 500);
  }
}

async function handleImportZip(env, request) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  const form = await request.formData();
  const backupFile = form.get('backup');
  if (!backupFile || typeof backupFile.arrayBuffer !== 'function') {
    return errorResponse('請選擇備份 zip 檔案', 400);
  }

  try {
    const zipBuffer = Buffer.from(await backupFile.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    const backupEntry = entries.find(entry => {
      const name = entry.entryName.replace(/^\.\//, '').split('/').pop();
      return !entry.isDirectory && (name === 'backup.json' || name === 'backup.json.enc');
    });

    if (!backupEntry) {
      const names = entries.map(entry => entry.entryName).join(', ');
      return errorResponse(`備份檔案中缺少 backup.json，zip 內容: ${names}`, 400);
    }

    let backupData;
    const entryName = backupEntry.entryName.replace(/^\.\//, '').split('/').pop();
    const rawContent = backupEntry.getData().toString('utf8');
    if (entryName === 'backup.json.enc') {
      const decrypted = decryptField(env, rawContent);
      backupData = JSON.parse(decrypted);
    } else {
      backupData = JSON.parse(rawContent);
    }

    if (!backupData.steps || !Array.isArray(backupData.steps)) {
      return errorResponse('無效的備份資料格式', 400);
    }

    if (backupData.settings && typeof backupData.settings === 'object') {
      for (const [key, value] of Object.entries(backupData.settings)) {
        await execute(
          env,
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          [key, String(value)]
        );
      }
    }

    await execute(env, 'DELETE FROM steps');
    for (let idx = 0; idx < backupData.steps.length; idx += 1) {
      const step = backupData.steps[idx] || {};
      await execute(
        env,
        'INSERT INTO steps (id, order_index, type, title, content_json) VALUES (?, ?, ?, ?, ?)',
        [
          step.id || null,
          idx,
          step.type || 'subtitle',
          step.title || '未命名步驟',
          JSON.stringify(step.content || {})
        ]
      );
    }

    if (backupData.adminPasswordHash) {
      await execute(
        env,
        'UPDATE admin SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
        [backupData.adminPasswordHash]
      );
    }

    return jsonResponse({
      success: true,
      message: `已匯入 ${backupData.steps.length} 個步驟與設定`
    });
  } catch (err) {
    return errorResponse('匯入備份失敗: ' + err.message, 500);
  }
}

async function handleImportJson(env, request) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  const { data } = await readJsonBody(request);
  if (!data || !Array.isArray(data.steps)) {
    return errorResponse('無效的備份資料格式，缺少 steps 陣列', 400);
  }

  if (data.settings && typeof data.settings === 'object') {
    for (const [key, value] of Object.entries(data.settings)) {
      await execute(
        env,
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, String(value)]
      );
    }
  }

  await execute(env, 'DELETE FROM steps');
  for (let idx = 0; idx < data.steps.length; idx += 1) {
    const step = data.steps[idx] || {};
    await execute(
      env,
      'INSERT INTO steps (id, order_index, type, title, content_json) VALUES (?, ?, ?, ?, ?)',
      [
        step.id || null,
        idx,
        step.type || 'subtitle',
        step.title || '未命名步驟',
        JSON.stringify(step.content || {})
      ]
    );
  }

  return jsonResponse({ success: true, message: `已匯入 ${data.steps.length} 個步驟與設定` });
}

async function handleStartSession(env, request) {
  const { sessionId, deviceInfo } = await readJsonBody(request);
  if (!sessionId) {
    return errorResponse('需要 sessionId', 400);
  }

  const now = nowUtc();
  await execute(
    env,
    `INSERT INTO sessions (session_id, start_time, device_info)
     VALUES (?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET start_time = excluded.start_time, device_info = excluded.device_info`,
    [sessionId, now, deviceInfo || '']
  );

  return jsonResponse({ success: true, sessionId, startTime: now });
}

async function handleAnswer(env, request) {
  const { sessionId, stepId, stepTitle, questionText, answerValue, nickname } = await readJsonBody(request);
  if (!sessionId) {
    return errorResponse('缺少 sessionId', 400);
  }

  if (nickname) {
    await execute(env, 'UPDATE sessions SET nickname = ? WHERE session_id = ?', [nickname, sessionId]);
  }

  const now = nowUtc();
  await execute(
    env,
    `INSERT INTO answers (session_id, step_id, step_title, question_text, answer_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, stepId || null, stepTitle || '', questionText || '', String(answerValue), now]
  );

  return jsonResponse({ success: true });
}

async function handleLog(env, request) {
  const { sessionId, eventType, detail } = await readJsonBody(request);
  if (!sessionId || !eventType) {
    return errorResponse('缺少必填欄位', 400);
  }

  const now = nowUtc();
  await execute(
    env,
    `INSERT INTO logs (session_id, event_type, detail, created_at)
     VALUES (?, ?, ?, ?)`,
    [sessionId, eventType, detail || '', now]
  );

  return jsonResponse({ success: true });
}

async function handleFinish(env, request) {
  const { sessionId, nickname } = await readJsonBody(request);
  if (!sessionId) {
    return errorResponse('缺少 sessionId', 400);
  }

  const session = await queryFirst(env, 'SELECT start_time FROM sessions WHERE session_id = ?', [sessionId]);
  const rawStart = session && session.start_time ? session.start_time : null;
  const startISO = rawStart ? rawStart.replace(/Z$/, '').replace(' ', 'T') + 'Z' : null;
  const startTime = startISO ? new Date(startISO).getTime() : Date.now();
  const endTime = Date.now();
  const durationSeconds = Math.max(0, Math.round((endTime - startTime) / 1000));
  const endUTC = nowUtc();

  await execute(
    env,
    `UPDATE sessions
     SET end_time = ?, duration_seconds = ?, nickname = COALESCE(?, nickname)
     WHERE session_id = ?`,
    [endUTC, durationSeconds, nickname || null, sessionId]
  );

  return jsonResponse({ success: true, durationSeconds });
}

async function handleAnalytics(env) {
  const sessions = await queryAll(env, 'SELECT * FROM sessions ORDER BY start_time DESC');
  const answers = await queryAll(env, 'SELECT * FROM answers ORDER BY created_at ASC');
  const logs = await queryAll(env, 'SELECT * FROM logs ORDER BY created_at ASC');

  const answersBySession = {};
  for (const answer of answers) {
    if (!answersBySession[answer.session_id]) answersBySession[answer.session_id] = [];
    answersBySession[answer.session_id].push(answer);
  }

  const logsBySession = {};
  for (const log of logs) {
    if (!logsBySession[log.session_id]) logsBySession[log.session_id] = [];
    logsBySession[log.session_id].push(log);
  }

  const result = sessions.map(session => ({
    ...session,
    answers: answersBySession[session.session_id] || [],
    logs: logsBySession[session.session_id] || []
  }));

  return jsonResponse({
    success: true,
    totalCount: sessions.length,
    sessions: result
  });
}

async function handleIncomplete(env) {
  const incomplete = await queryAll(
    env,
    `
      SELECT s.*,
        ROUND((julianday('now', 'utc') - julianday(s.start_time)) * 86400) as dwell_seconds
      FROM sessions s
      WHERE s.end_time IS NULL OR s.end_time = ''
      ORDER BY s.start_time DESC
    `
  );

  const enriched = [];
  for (const session of incomplete) {
    const answerCountRow = await queryFirst(env, 'SELECT COUNT(*) AS cnt FROM answers WHERE session_id = ?', [session.session_id]);
    const lastAnswer = await queryFirst(env, 'SELECT * FROM answers WHERE session_id = ? ORDER BY created_at DESC LIMIT 1', [session.session_id]);
    enriched.push({
      ...session,
      answerCount: answerCountRow ? answerCountRow.cnt : 0,
      lastStepTitle: lastAnswer ? lastAnswer.step_title : null,
      lastAnswerTime: lastAnswer ? lastAnswer.created_at : null
    });
  }

  return jsonResponse({ success: true, sessions: enriched });
}

async function handleClearAll(env) {
  await execute(env, 'DELETE FROM logs');
  await execute(env, 'DELETE FROM answers');
  await execute(env, 'DELETE FROM sessions');
  return jsonResponse({
    success: true,
    message: '所有使用者作答紀錄、停留時間與行為軌跡已一鍵清空！'
  });
}

async function routeApi(env, request, pathname) {
  if (pathname === '/api/health' && request.method === 'GET') {
    return jsonResponse({ status: 'ok', time: new Date().toISOString() });
  }

  if (pathname === '/api/auth/login' && request.method === 'POST') {
    return handleLogin(env, request);
  }

  if (pathname === '/api/auth/change-password' && request.method === 'POST') {
    return handleChangePassword(env, request);
  }

  if (pathname === '/api/flow/steps' && request.method === 'GET') {
    return handleGetSteps(env);
  }

  if (pathname === '/api/flow/settings' && request.method === 'GET') {
    return handleGetSettings(env);
  }

  if (pathname === '/api/flow/settings' && request.method === 'PUT') {
    return handleUpdateSettings(env, request);
  }

  if (pathname === '/api/flow/steps' && request.method === 'POST') {
    return handleCreateStep(env, request);
  }

  if (pathname === '/api/flow/steps/batch' && request.method === 'PUT') {
    return handleBatchSaveSteps(env, request);
  }

  if (pathname.startsWith('/api/flow/steps/') && request.method === 'DELETE') {
    const stepId = Number(pathname.split('/').pop());
    if (!Number.isFinite(stepId) || stepId <= 0) {
      return errorResponse('無效的步驟 ID', 400);
    }
    const auth = requireAdmin(request, env);
    if (!auth.ok) return auth.response;
    return handleDeleteStep(env, stepId);
  }

  if (pathname === '/api/flow/export' && request.method === 'GET') {
    const auth = requireAdmin(request, env);
    if (!auth.ok) return auth.response;
    return handleExport(env);
  }

  if (pathname === '/api/flow/import-zip' && request.method === 'POST') {
    return handleImportZip(env, request);
  }

  if (pathname === '/api/flow/import' && request.method === 'POST') {
    return handleImportJson(env, request);
  }

  if (pathname === '/api/responses/start' && request.method === 'POST') {
    return handleStartSession(env, request);
  }

  if (pathname === '/api/responses/answer' && request.method === 'POST') {
    return handleAnswer(env, request);
  }

  if (pathname === '/api/responses/log' && request.method === 'POST') {
    return handleLog(env, request);
  }

  if (pathname === '/api/responses/finish' && request.method === 'POST') {
    return handleFinish(env, request);
  }

  if (pathname === '/api/responses/analytics' && request.method === 'GET') {
    const auth = requireAdmin(request, env);
    if (!auth.ok) return auth.response;
    return handleAnalytics(env);
  }

  if (pathname === '/api/responses/incomplete' && request.method === 'GET') {
    const auth = requireAdmin(request, env);
    if (!auth.ok) return auth.response;
    return handleIncomplete(env);
  }

  if (pathname === '/api/responses/clear-all' && request.method === 'DELETE') {
    const auth = requireAdmin(request, env);
    if (!auth.ok) return auth.response;
    return handleClearAll(env);
  }

  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (pathname === '/api/health') {
      return jsonResponse({ status: 'ok', time: new Date().toISOString() });
    }

    await ensureInitialized(env);

    if (pathname.startsWith('/api/')) {
      const response = await routeApi(env, request, pathname);
      if (response) return response;
      return errorResponse('API 路由不存在', 404);
    }

    return env.ASSETS.fetch(request);
  }
};
