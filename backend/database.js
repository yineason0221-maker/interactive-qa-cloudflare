const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

function initDatabase() {
  // 1. Admin Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      password_hash TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default admin password if not exists
  const adminRow = db.prepare('SELECT * FROM admin WHERE id = 1').get();
  const newHash = bcrypt.hashSync('admin', 8);
  if (!adminRow) {
    db.prepare('INSERT INTO admin (id, password_hash) VALUES (1, ?)').run(newHash);
    console.log('[DB Init] Created default admin password: admin');
  } else {
    db.prepare('UPDATE admin SET password_hash = ? WHERE id = 1').run(newHash);
    console.log('[DB Init] Migrated admin hash to bcrypt cost 8');
  }

  // 2. Steps / Flow Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_index INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'subtitle', 'question', 'effect', 'video', 'bgm'
      title TEXT NOT NULL,
      content_json TEXT NOT NULL
    )
  `);

  // Populate default demo flow steps if empty
  const stepCount = db.prepare('SELECT COUNT(*) as count FROM steps').get().count;
  if (stepCount === 0) {
    const defaultSteps = [
      {
        order_index: 0,
        type: 'subtitle',
        title: '歡迎語',
        content_json: JSON.stringify({
          text: '歡迎來到這段特別的問答旅程...',
          duration: 3,
          fadeIn: 1,
          fadeOut: 1,
          textSize: 'large'
        })
      },
      {
        order_index: 1,
        type: 'subtitle',
        title: '前導說明',
        content_json: JSON.stringify({
          text: '請跟隨你的直覺，回答接下來的每一個問題。',
          duration: 4,
          fadeIn: 0.8,
          fadeOut: 0.8,
          textSize: 'medium'
        })
      },
      {
        order_index: 2,
        type: 'effect',
        title: '震撼登場',
        content_json: JSON.stringify({
          effectType: 'matrix', // 'fireworks', 'glitch', 'shake', 'matrix', 'flash'
          duration: 3,
          soundEffect: ''
        })
      },
      {
        order_index: 3,
        type: 'question',
        title: '基礎暱稱',
        content_json: JSON.stringify({
          questionText: '首先，請告诉我你的名字或暱稱：',
          questionType: 'text', // 'text', 'single_choice', 'multi_choice', 'rating'
          options: [],
          required: true
        })
      },
      {
        order_index: 4,
        type: 'question',
        title: '心情指數',
        content_json: JSON.stringify({
          questionText: '今天的心情如何？滿分 10 分你給幾分？',
          questionType: 'rating',
          options: [],
          required: true
        })
      },
      {
        order_index: 5,
        type: 'question',
        title: '特別喜好',
        content_json: JSON.stringify({
          questionText: '如果可以擁有一個超能力，你最想選擇哪一個？',
          questionType: 'single_choice',
          options: ['瞬間移動', '讀心術', '預知未來', '時間暫停', '隱形能力'],
          required: true
        })
      },
      {
        order_index: 6,
        type: 'effect',
        title: '絢麗煙火慶祝',
        content_json: JSON.stringify({
          effectType: 'fireworks',
          duration: 4
        })
      },
      {
        order_index: 7,
        type: 'question',
        title: '衷心祝福與真心話',
        content_json: JSON.stringify({
          questionText: '最後，有什麼想對我說的話嗎？（任意長度）',
          questionType: 'text',
          options: [],
          required: false
        })
      },
      {
        order_index: 8,
        type: 'subtitle',
        title: '感謝尾聲',
        content_json: JSON.stringify({
          text: '感謝你的認真回答，我們的故事才剛剛開始！',
          duration: 5,
          fadeIn: 1,
          fadeOut: 1,
          textSize: 'large'
        })
      }
    ];

    const insertStmt = db.prepare('INSERT INTO steps (order_index, type, title, content_json) VALUES (?, ?, ?, ?)');
    defaultSteps.forEach(step => {
      insertStmt.run(step.order_index, step.type, step.title, step.content_json);
    });
    console.log('[DB Init] Created default interactive steps');
  }

  // 3. Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const setStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  setStmt.run('site_title', '神秘互動問答');
  setStmt.run('bgm_url', '');
  setStmt.run('bgm_timeline', '[]');
  setStmt.run('force_fullscreen', 'true');

  // 4. User Sessions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      nickname TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      duration_seconds INTEGER DEFAULT 0,
      device_info TEXT
    )
  `);

  // 5. User Answers Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      step_id INTEGER,
      step_title TEXT,
      question_text TEXT,
      answer_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    )
  `);

  // 6. User Behavior Logs Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL, -- e.g. 'ENTER_FULLSCREEN', 'EXIT_FULLSCREEN', 'STEP_CHANGE', 'IDLE_ALERT'
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    )
  `);
}

initDatabase();

module.exports = db;
