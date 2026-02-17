// user.js
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, 'users.json');

// Ensure users.json exists
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]', 'utf8');

function readUsers() {
  const data = fs.readFileSync(USERS_FILE, 'utf8');
  return JSON.parse(data || '[]');
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function addUser(username, password) {
  const users = readUsers();
  if (users.find(u => u.username === username)) return false;
  const hash = bcrypt.hashSync(password, 10);
  users.push({ username, password: hash });
  writeUsers(users);
  return true;
}

function validateUser(username, password) {
  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user) return false;
  return bcrypt.compareSync(password, user.password);
}

module.exports = { readUsers, writeUsers, addUser, validateUser };
