const express = require("express");
const session = require("express-session");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const userDB = require("./user");

const app = express();

// ===== CONFIG =====
const PORT = process.env.PORT || 8080;
const BASE_URL = process.env.BASE_URL || "http://localhost:" + PORT;

// ===== FOLDERS =====
const FILE_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(FILE_DIR)) fs.mkdirSync(FILE_DIR);

// ===== MIDDLEWARE =====
app.use(express.json());

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(session({
  secret: "radhekrishna-secret",
  resave: false,
  saveUninitialized: false
}));

// ===== FILE STORAGE =====
const storage = multer.diskStorage({
  destination: FILE_DIR,
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// ===== AUTH MIDDLEWARE =====
function auth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
}

// ===== ROUTES =====

// Register
app.post("/register", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ success: false, error: "Missing fields" });
  }

  const result = userDB.register(username, password);
  res.json(result);
});

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (userDB.login(username, password)) {
    req.session.user = username;
    return res.json({ success: true });
  }

  res.json({ success: false, error: "Invalid credentials" });
});

// Upload
app.post("/upload", auth, upload.single("file"), (req, res) => {
  res.json({ success: true });
});

// List Files
app.get("/files", auth, (req, res) => {
  const files = fs.readdirSync(FILE_DIR);
  res.json(files);
});

// Get File URL
app.get("/file/:name", auth, (req, res) => {
  const filePath = path.join(FILE_DIR, req.params.name);

  if (!fs.existsSync(filePath)) {
    return res.json({ success: false, error: "File not found" });
  }

  res.json({
    success: true,
    url: BASE_URL + "/uploads/" + encodeURIComponent(req.params.name)
  });
});

// Delete File
app.delete("/file/:name", auth, (req, res) => {
  const filePath = path.join(FILE_DIR, req.params.name);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  res.json({ success: true });
});

// Static serve uploads
app.use("/uploads", express.static(FILE_DIR));

// ===== START =====
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
