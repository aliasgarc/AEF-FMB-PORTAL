const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'admin_token';

if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing tokens with "undefined".
  console.warn('WARNING: JWT_SECRET is not set. Set it in your environment before deploying.');
}

async function verifyAdminCredentials(username, password) {
  const result = await db.query('SELECT id, username, password_hash FROM admins WHERE username = $1', [username]);
  if (result.rows.length === 0) return null;

  const admin = result.rows[0];
  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) return null;

  return { id: admin.id, username: admin.username };
}

function issueToken(admin) {
  return jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '12h' });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

// Express middleware — protects /api/admin/* routes (except /login)
function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

module.exports = {
  verifyAdminCredentials,
  issueToken,
  setAuthCookie,
  clearAuthCookie,
  requireAdmin,
  COOKIE_NAME
};
