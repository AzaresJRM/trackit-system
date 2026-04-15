require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: [
    'https://azaresjrm.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://127.0.0.1:5501',
    'http://localhost:5501'
  ],
  credentials: true
}));
app.use(bodyParser.json());
app.use((req, res, next) => {
  if (req.method === 'DELETE' && String(req.path || '').includes('/api/documents/') && String(req.path || '').includes('/attachments')) {
    // #region agent log
    fetch('http://127.0.0.1:7529/ingest/2186c759-b7ed-45d3-980b-04cc62c10e13',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6e07b1'},body:JSON.stringify({sessionId:'6e07b1',runId:'run2',hypothesisId:'H6',location:'server.js:24',message:'Incoming attachment DELETE request observed by server',data:{method:req.method,path:String(req.path||''),originalUrl:String(req.originalUrl||'')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7529/ingest/2186c759-b7ed-45d3-980b-04cc62c10e13',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'220726'},body:JSON.stringify({sessionId:'220726',runId:'run2',hypothesisId:'H6',location:'server.js:delete-attachments-middleware',message:'attachment DELETE request reached express app middleware',data:{method:req.method,path:String(req.path||''),originalUrl:String(req.originalUrl||'')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }
  next();
});
app.use((req, res, next) => {
  const watchedPaths = new Set([
    '/api/login',
    '/api/admin/stats',
    '/api/admin/recent-activity',
    '/api/admin/logs/live'
  ]);
  if (watchedPaths.has(req.path) && typeof fetch === 'function') {
    // #region agent log
    fetch('http://127.0.0.1:7507/ingest/940a8e2d-ccff-48a6-a6db-a34f92dab6b3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9cc7bf'},body:JSON.stringify({sessionId:'9cc7bf',runId:'run1',hypothesisId:'H1',location:'server.js:25',message:'watched backend route hit',data:{method:req.method,path:req.path,queryKeys:Object.keys(req.query||{})},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }
  next();
});

// PostgreSQL connection and sync
const dbReady = sequelize.authenticate()
  .then(() => {
    console.log('PostgreSQL connected!');
    // Automatically creates/alters tables based on models
    return sequelize.sync({ alter: true });
  })
  .then(() => console.log('Database synced!'))
  .catch(err => console.error('Database connection error:', err));

// --- API ROUTES ---

// Users
app.use('/api/users', require('./routes/users'));
// Offices
app.use('/api/offices', require('./routes/offices'));
// Documents
app.use('/api/documents', require('./routes/documents'));
// Attachments
app.use('/api/attachments', require('./routes/attachments'));
// Reports
app.use('/api/reports', require('./routes/reports'));
// Logs
app.use('/api/logs', require('./routes/logs'));
// Notifications
app.use('/api/notifications', require('./routes/notifications'));
// Auth
app.use('/api', require('./routes/auth'));
// Document Types
app.use('/api/document-types', require('./routes/documentTypes'));
// Admin
app.use('/api/admin', require('./routes/admin'));

// Root
app.get('/', (req, res) => {
  res.send('TrackIT Admin Backend Running');
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
module.exports.dbReady = dbReady;