const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const railwayDbPath = 'C:/Users/88692/Documents/interactive-qa-app/backend/database.sqlite';
const outputPath = 'C:/Users/88692/Documents/interactive-qa-app/cloudflare-migration/migration-export.json';

console.log('Reading Railway database from:', railwayDbPath);

if (!fs.existsSync(railwayDbPath)) {
  console.error('Railway database not found at:', railwayDbPath);
  process.exit(1);
}

const db = new Database(railwayDbPath);

// Export settings
const settings = {};
try {
  const rows = db.prepare('SELECT * FROM settings').all();
  rows.forEach(row => {
    settings[row.key] = row.value;
  });
  console.log(`Exported ${rows.length} settings`);
} catch (e) {
  console.warn('Settings export failed:', e.message);
}

// Export steps
const steps = [];
try {
  const rows = db.prepare('SELECT * FROM steps ORDER BY order_index ASC').all();
  rows.forEach(row => {
    steps.push({
      id: row.id,
      order_index: row.order_index,
      type: row.type,
      title: row.title,
      content: JSON.parse(row.content_json || '{}')
    });
  });
  console.log(`Exported ${rows.length} steps`);
} catch (e) {
  console.warn('Steps export failed:', e.message);
}

// Export admin password (bcrypt hash from Railway)
let adminPasswordHash = '';
try {
  const adminRow = db.prepare('SELECT * FROM admin WHERE id = 1').get();
  if (adminRow) {
    adminPasswordHash = adminRow.password_hash;
    console.log('Exported admin password hash (bcrypt)');
  }
} catch (e) {
  console.warn('Admin export failed:', e.message);
}

// Collect media files from uploads folder
const uploadsDir = 'C:/Users/88692/Documents/interactive-qa-app/backend/uploads';
const mediaFiles = {};

if (fs.existsSync(uploadsDir)) {
  const files = fs.readdirSync(uploadsDir).filter(f => !f.startsWith('.'));
  console.log(`Found ${files.length} files in uploads/`);
  
  files.forEach(filename => {
    const filepath = path.join(uploadsDir, filename);
    const ext = path.extname(filename).toLowerCase();
    const isMedia = ['.mp3', '.mp4', '.wav', '.ogg', '.m4a', '.webm', '.avi', '.mov'].includes(ext);
    
    if (isMedia) {
      try {
        const buffer = fs.readFileSync(filepath);
        const base64 = buffer.toString('base64');
        const mimeType = ext === '.mp3' ? 'audio/mpeg' :
                        ext === '.mp4' ? 'video/mp4' :
                        ext === '.wav' ? 'audio/wav' :
                        ext === '.webm' ? 'video/webm' :
                        ext === '.ogg' ? 'audio/ogg' :
                        ext === '.m4a' ? 'audio/mp4' :
                        'application/octet-stream';
        mediaFiles[filename] = {
          base64,
          mimeType,
          size: buffer.length
        };
        console.log(`  - ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
      } catch (e) {
        console.warn(`  - Failed to read ${filename}:`, e.message);
      }
    }
  });
}

const exportData = {
  version: '2.0',
  exportedAt: new Date().toISOString(),
  source: 'railway',
  settings,
  steps,
  mediaFiles,
  adminPasswordHash
};

fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');
console.log('\nMigration export saved to:', outputPath);
console.log(`Total: ${steps.length} steps, ${Object.keys(settings).length} settings, ${Object.keys(mediaFiles).length} media files`);
