const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const flowRoutes = require('./routes/flow');
const responsesRoutes = require('./routes/responses');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static route for uploaded media
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static build if present
const frontendDist = path.join(__dirname, '../frontend/dist');
if (require('fs').existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/flow', flowRoutes);
app.use('/api/responses', responsesRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Default Admin Password: admin`);
  console.log(`========================================`);
});
