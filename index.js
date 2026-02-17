// index.js
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- USER AUTH ---
const USERNAME = 'k';
const PASSWORD = 'r';

function validateUser(username, password) {
  return username === USERNAME && password === PASSWORD;
}

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'radhekrishna_secret_key',
  resave: false,
  saveUninitialized: true
}));

// --- MULTER SETUP ---
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// --- AUTH MIDDLEWARE ---
function requireLogin(req, res, next) {
  if (req.session.loggedIn) next();
  else res.status(401).json({ message: 'Unauthorized' });
}

// --- ROUTES ---

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (validateUser(username, password)) {
    req.session.loggedIn = true;
    res.json({ message: 'Login successful' });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: 'Error logging out' });
    res.json({ message: 'Logged out' });
  });
});

// Upload file
app.post('/upload', requireLogin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.json({ message: 'File uploaded', filename: req.file.filename });
});

// List files
app.get('/files', requireLogin, (req, res) => {
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) return res.status(500).json({ message: 'Error reading files' });
    res.json({ files });
  });
});

// Download file
app.get('/files/:name', requireLogin, (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found' });
  res.download(filePath);
});

// Delete file
app.delete('/files/:name', requireLogin, (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found' });
  fs.unlink(filePath, err => {
    if (err) return res.status(500).json({ message: 'Error deleting file' });
    res.json({ message: 'File deleted' });
  });
});

// Test route
app.get('/', (req, res) => res.send('Radhe Krishna File Library Backend is running'));

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
