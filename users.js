const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "users.json");

// Create file if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

function readUsers() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function writeUsers(users) {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

module.exports = {

  register(username, password) {
    const users = readUsers();

    if (users.find(u => u.username === username)) {
      return { success: false, error: "User exists" };
    }

    users.push({ username, password });
    writeUsers(users);

    return { success: true };
  },

  login(username, password) {
    const users = readUsers();
    return users.find(u => u.username === username && u.password === password);
  }

};
