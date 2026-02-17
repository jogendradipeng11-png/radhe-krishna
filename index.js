require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const multer = require("multer");
const path = require("path");

const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const bcrypt = require("bcryptjs");
const { findUser, addUser } = require("./users.js");

const app = express();
const PORT = process.env.PORT || 10000;

// ============================
// CORS & SESSION CONFIG
// ============================

// Allowed frontend URLs
const allowedOrigins = [
  "https://radhe-krishna-h7lq.onrender.com", // Render frontend
  "https://jogendradipeng11-png.github.io",  // GitHub Pages
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

// Enable CORS with credentials
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow curl/Postman
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS Not Allowed"));
    }
  },
  credentials: true
}));

// Parse JSON
app.use(express.json());

// ============================
// SESSION SETUP
// ============================
app.set("trust proxy", 1); // for Render / production

app.use(session({
  secret: process.env.JWT_SECRET || "rk-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production", // HTTPS required
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    httpOnly: true,
    maxAge: 14 * 24 * 60 * 60 * 1000
  }
}));

// ============================
// IDrive S3 CLIENT
// ============================
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.IDRIVE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.IDRIVE_ACCESS_KEY_ID,
    secretAccessKey: process.env.IDRIVE_SECRET_ACCESS_KEY
  },
  forcePathStyle: true
});

const BUCKET = process.env.IDRIVE_BUCKET_NAME;

// ============================
// MULTER SETUP
// ============================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// ============================
// AUTH MIDDLEWARE
// ============================
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: "Login required" });
  }
  next();
};

// ============================
// ROUTES
// ============================

// Test backend
app.get("/", (req, res) => {
  res.json({ message: "Radhe Krishna Backend Running" });
});

// REGISTER
app.post("/register", async (req, res) => {
  try {
    const user = await addUser(req.body.username, req.body.password);
    req.session.user = { username: user.username };
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  const user = findUser(req.body.username);
  if (!user) return res.status(401).json({ success: false });

  const ok = await bcrypt.compare(req.body.password, user.password);
  if (!ok) return res.status(401).json({ success: false });

  req.session.user = { username: user.username };
  res.json({ success: true });
});

// LOGOUT
app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ============================
// FILE ROUTES
// ============================

// UPLOAD
app.post("/upload", requireLogin, upload.single("file"), async (req, res) => {
  try {
    const username = req.session.user.username;
    const key = `${username}/${Date.now()}-${req.file.originalname}`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

// LIST FILES
app.get("/files", requireLogin, async (req, res) => {
  try {
    const prefix = req.session.user.username + "/";
    const data = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix
    }));

    const files = (data.Contents || []).map(f => path.basename(f.Key));
    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// DOWNLOAD FILE
app.get("/file/:name", requireLogin, async (req, res) => {
  try {
    const key = `${req.session.user.username}/${req.params.name}`;
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: 3600 }
    );
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ url: null });
  }
});

// DELETE FILE
app.delete("/file/:name", requireLogin, async (req, res) => {
  try {
    const key = `${req.session.user.username}/${req.params.name}`;
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ============================
// START SERVER
// ============================
app.listen(PORT, () => {
  console.log("Server running:", PORT);
});
