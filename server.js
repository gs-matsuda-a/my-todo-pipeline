const path = require('path');
const express = require('express');
const helmet = require('helmet');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

const app = express();
const db = new Database(path.join(__dirname, 'tasks.db'));

// Security constants
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 20;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 64;
const BCRYPT_ROUNDS = 10;
const MAX_TITLE_LENGTH = 200;
const JSON_BODY_LIMIT = '100kb';

// ===== DB Schema =====
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS task_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    shared_with_user_id INTEGER NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(task_id, shared_with_user_id),
    FOREIGN KEY(task_id) REFERENCES tasks(id),
    FOREIGN KEY(shared_with_user_id) REFERENCES users(id)
  );
`);

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting for login endpoint (5 attempts per 15 minutes per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// ===== Helpers =====

/**
 * Validate username format: 3-20 chars, alphanumeric + underscore + multibyte chars allowed
 * @param {string} username - Username to validate
 * @returns {boolean} True if valid format
 */
function validateUsername(username) {
  if (typeof username !== 'string') return false;
  if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) return false;
  const normalized = username.normalize('NFKC');
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code < 32 || code === 127 || /\s/.test(normalized[i])) return false;
  }
  if (!/^[\w\p{L}\p{N}]+$/u.test(normalized)) return false;
  return true;
}

/**
 * Validate password strength: 8-64 chars
 * @param {string} password - Password to validate
 * @returns {boolean} True if valid length
 */
function validatePassword(password) {
  if (typeof password !== 'string') return false;
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}

/**
 * Hash password using bcrypt (cost factor: 10)
 * @param {string} password - Plain password
 * @returns {string} Bcrypt hash with salt
 */
function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

/**
 * Compare password with bcrypt hash
 * @param {string} password - Plain password to verify
 * @param {string} hash - Bcrypt hash to compare against
 * @returns {boolean} True if password matches hash
 */
function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

/**
 * Validate task title: non-empty (after trim) string within MAX_TITLE_LENGTH
 * @param {string} title - Task title to validate
 * @returns {boolean} True if valid
 */
function validateTitle(title) {
  if (typeof title !== 'string') return false;
  const trimmed = title.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_TITLE_LENGTH;
}

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function getCookies(req) {
  const cookies = {};
  const cookieString = req.headers.cookie || '';
  cookieString.split(';').forEach(cookie => {
    const [key, value] = cookie.split('=').map(s => s.trim());
    if (key) cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function getAuthenticatedUser(req) {
  const cookies = getCookies(req);
  const sessionId = cookies.sessionId;
  if (!sessionId) return null;

  const session = db.prepare('SELECT user_id FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return null;

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(session.user_id);
  return user || null;
}

function requireAuth(req, res, next) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = user;
  next();
}

// ===== Auth Endpoints =====
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  if (!validateUsername(username)) {
    return res.status(400).json({ error: `username must be ${MIN_USERNAME_LENGTH}-${MAX_USERNAME_LENGTH} characters, alphanumeric and underscore only` });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({ error: `password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters` });
  }

  try {
    const normalizedUsername = username.normalize('NFKC');
    const passwordHash = hashPassword(password);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)'
    ).run(normalizedUsername, passwordHash);

    return res.status(201).json({ id: result.lastInsertRowid, username });
  } catch (err) {
    if (err.message.includes('UNIQUE') || err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'username already exists' });
    }
    return res.status(500).json({ error: 'internal server error' });
  }
});

app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({ error: 'password must be 8-64 characters' });
  }

  const normalizedUsername = username.normalize('NFKC');
  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(normalizedUsername);

  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const sessionId = generateSessionId();
  db.prepare('INSERT INTO sessions (id, user_id) VALUES (?, ?)').run(sessionId, user.id);

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieFlags = `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Strict${isProduction ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', cookieFlags);
  return res.json({ id: user.id, username: user.username });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const cookies = getCookies(req);
  const sessionId = cookies.sessionId;
  if (sessionId) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }
  res.setHeader('Set-Cookie', 'sessionId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC;');
  return res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.json(user);
});

// ===== Task Endpoints =====
app.get('/api/tasks', requireAuth, (req, res) => {
  const userId = req.user.id;

  // Get own tasks + shared tasks
  const ownTasks = db.prepare(`
    SELECT id, user_id, title, completed, due_date, version, created_at, updated_at
    FROM tasks WHERE user_id = ?
  `).all(userId);

  const sharedTasks = db.prepare(`
    SELECT t.id, t.user_id, t.title, t.completed, t.due_date, t.version,
           t.created_at, t.updated_at, ts.permission,
           u.username AS owner_username
    FROM tasks t
    JOIN task_shares ts ON t.id = ts.task_id
    JOIN users u ON t.user_id = u.id
    WHERE ts.shared_with_user_id = ?
  `).all(userId);

  const tasks = [
    ...ownTasks.map(t => ({ ...t, share_permission: 'owner' })),
    ...sharedTasks.map(t => ({
      id: t.id, user_id: t.user_id, title: t.title, completed: t.completed,
      due_date: t.due_date, version: t.version, created_at: t.created_at,
      updated_at: t.updated_at, share_permission: t.permission, owner_username: t.owner_username
    }))
  ];

  return res.json(tasks);
});

app.post('/api/tasks', requireAuth, (req, res) => {
  const { title, due_date } = req.body;
  const userId = req.user.id;

  if (!title) {
    return res.status(400).json({ error: 'title required' });
  }

  if (!validateTitle(title)) {
    return res.status(400).json({ error: `title must be 1-${MAX_TITLE_LENGTH} characters` });
  }

  const trimmedTitle = title.trim();
  const result = db.prepare(
    'INSERT INTO tasks (user_id, title, due_date) VALUES (?, ?, ?)'
  ).run(userId, trimmedTitle, due_date || null);

  const task = db.prepare(
    'SELECT * FROM tasks WHERE id = ?'
  ).get(result.lastInsertRowid);

  return res.status(201).json(task);
});

app.get('/api/tasks/:id', requireAuth, (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Check access
  if (task.user_id !== userId) {
    const share = db.prepare(
      'SELECT permission FROM task_shares WHERE task_id = ? AND shared_with_user_id = ?'
    ).get(taskId, userId);

    if (!share) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const owner = db.prepare('SELECT username FROM users WHERE id = ?').get(task.user_id);
    return res.json({
      ...task,
      share_permission: share.permission,
      owner_username: owner.username
    });
  }

  return res.json({ ...task, share_permission: 'owner' });
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;
  const { title, completed, due_date, version } = req.body;

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Check access - owner can always edit, shared users with 'edit' can edit
  let canEdit = false;
  if (task.user_id === userId) {
    canEdit = true;
  } else {
    const share = db.prepare(
      'SELECT permission FROM task_shares WHERE task_id = ? AND shared_with_user_id = ?'
    ).get(taskId, userId);
    if (share && share.permission === 'edit') {
      canEdit = true;
    }
  }

  if (!canEdit) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (title !== undefined && !validateTitle(title)) {
    return res.status(400).json({ error: `title must be 1-${MAX_TITLE_LENGTH} characters` });
  }

  // Check version for optimistic locking
  if (version !== undefined && version !== task.version) {
    return res.status(409).json({ error: 'Conflict: version mismatch' });
  }

  const newVersion = (version !== undefined) ? version + 1 : task.version;
  const newTitle = (title !== undefined) ? title.trim() : task.title;
  const newCompleted = (completed !== undefined) ? (completed ? 1 : 0) : task.completed;
  const newDueDate = (due_date !== undefined) ? due_date : task.due_date;

  db.prepare(`
    UPDATE tasks SET title = ?,
                     completed = ?,
                     due_date = ?,
                     version = ?,
                     updated_at = datetime('now')
    WHERE id = ?
  `).run(newTitle, newCompleted, newDueDate, newVersion, taskId);

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  return res.json(updated);
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;

  const task = db.prepare('SELECT user_id FROM tasks WHERE id = ?').get(taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Only owner can delete
  if (task.user_id !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.prepare('DELETE FROM task_shares WHERE task_id = ?').run(taskId);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);

  return res.status(204).send();
});

// ===== Bulk Operations =====
app.post('/api/tasks/bulk', requireAuth, (req, res) => {
  const { action, ids } = req.body;
  const userId = req.user.id;

  if (!action || !Array.isArray(ids)) {
    return res.status(400).json({ error: 'action and ids required' });
  }

  // Filter to only tasks the user can modify
  const accessibleIds = [];
  for (const id of ids) {
    const task = db.prepare('SELECT user_id FROM tasks WHERE id = ?').get(id);
    if (task && task.user_id === userId) {
      accessibleIds.push(id);
    }
  }

  if (action === 'complete') {
    for (const id of accessibleIds) {
      db.prepare('UPDATE tasks SET completed = 1, updated_at = datetime(\'now\') WHERE id = ?').run(id);
    }
  } else if (action === 'delete') {
    for (const id of accessibleIds) {
      db.prepare('DELETE FROM task_shares WHERE task_id = ?').run(id);
      db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    }
  } else {
    return res.status(400).json({ error: 'invalid action' });
  }

  return res.json({ ok: true, affected: accessibleIds.length });
});

// ===== Share Endpoints =====
app.post('/api/tasks/:id/share', requireAuth, (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;
  const { username, permission } = req.body;

  if (!username || !permission || !['view', 'edit'].includes(permission)) {
    return res.status(400).json({ error: 'username and permission required' });
  }

  const task = db.prepare('SELECT user_id FROM tasks WHERE id = ?').get(taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Only owner can share
  if (task.user_id !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const normalizedUsername = username.normalize('NFKC');
  const sharedWithUser = db.prepare('SELECT id FROM users WHERE username = ?').get(normalizedUsername);

  if (!sharedWithUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (sharedWithUser.id === userId) {
    return res.status(400).json({ error: 'Cannot share with yourself' });
  }

  try {
    db.prepare(
      'INSERT OR REPLACE INTO task_shares (task_id, shared_with_user_id, permission) VALUES (?, ?, ?)'
    ).run(taskId, sharedWithUser.id, permission);

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id/share', requireAuth, (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'username required' });
  }

  const task = db.prepare('SELECT user_id FROM tasks WHERE id = ?').get(taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Only owner can unshare
  if (task.user_id !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const normalizedUsername = username.normalize('NFKC');
  const sharedWithUser = db.prepare('SELECT id FROM users WHERE username = ?').get(normalizedUsername);

  if (!sharedWithUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  db.prepare(
    'DELETE FROM task_shares WHERE task_id = ? AND shared_with_user_id = ?'
  ).run(taskId, sharedWithUser.id);

  return res.json({ ok: true });
});

// Export for testing
module.exports = app;
module.exports.validateUsername = validateUsername;
module.exports.validatePassword = validatePassword;
module.exports.validateTitle = validateTitle;
module.exports.hashPassword = hashPassword;
module.exports.comparePassword = comparePassword;

// Only listen if not in test mode
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, 'localhost', () => {
    console.log(`Todo app listening on http://localhost:${PORT}`);
  });
}
