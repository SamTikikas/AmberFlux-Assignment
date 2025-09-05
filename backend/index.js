// Backend Server - Express.js with MySQL
const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory');
}

// --- Middleware Configuration ---
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use('/uploads', express.static(uploadsDir));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// --- Database Configuration ---
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'pass123', // ⚠️ CHANGE THIS TO YOUR MYSQL PASSWORD
  database: 'media_recorder_db'
};

let db;

// Database Connection Function
async function initializeDatabase() {
  try {
    console.log('🔄 Connecting to MySQL database...');
    db = await mysql.createConnection(dbConfig);
    console.log('✅ Successfully connected to MySQL database');
    
    // Create recordings table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS recordings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        size BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at),
        INDEX idx_filename (filename)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    
    await db.execute(createTableQuery);
    console.log('✅ Database table "recordings" is ready');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.log('💡 Make sure MySQL is running and credentials are correct');
    process.exit(1);
  }
}

// --- Multer Configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.webm');
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// --- API ENDPOINTS ---

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Screen Recorder API is running!',
    timestamp: new Date().toISOString()
  });
});

// POST /api/recordings - Upload recording
app.post('/api/recordings', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const { filename, size } = req.file;
    
    const [result] = await db.execute(
      'INSERT INTO recordings (filename, size) VALUES (?, ?)',
      [filename, size]
    );

    res.status(201).json({ 
      message: 'File uploaded successfully!', 
      recordingId: result.insertId
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Failed to save recording.' });
  }
});

// GET /api/recordings - List all recordings
app.get('/api/recordings', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM recordings ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch recordings.' });
  }
});

// GET /api/recordings/:id - Stream specific recording
app.get('/api/recordings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await db.execute('SELECT * FROM recordings WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Recording not found.' });
    }
    
    const recording = rows[0];
    const filePath = path.join(uploadsDir, recording.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found.' });
    }
    
    res.setHeader('Content-Type', 'video/webm');
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ message: 'Failed to stream recording.' });
  }
});

// Start server
startServer();

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}