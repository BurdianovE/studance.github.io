import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { getDb } from './db';

type DbUser = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const known = Buffer.from(hash, 'hex');
  if (candidate.length !== known.length) return false;
  return timingSafeEqual(candidate, known);
}

function toPublicUser(user: DbUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.created_at,
  };
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function registerUser(input: { email: string; password: string; name?: string }): PublicUser {
  const db = getDb();
  const email = normalizeEmail(input.email);
  const password = input.password.trim();
  const name = (input.name ?? '').trim() || email.split('@')[0] || 'Пользователь';

  if (!email || !email.includes('@')) {
    throw new Error('Некорректный email');
  }
  if (password.length < 6) {
    throw new Error('Пароль должен быть не короче 6 символов');
  }

  const now = new Date().toISOString();
  const user: DbUser = {
    id: randomUUID(),
    email,
    name,
    password_hash: hashPassword(password),
    created_at: now,
  };

  try {
    db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(user.id, user.email, user.name, user.password_hash, user.created_at);
  } catch {
    throw new Error('Пользователь с таким email уже существует');
  }

  return toPublicUser(user);
}

export function loginUser(input: { email: string; password: string }): PublicUser | null {
  const db = getDb();
  const email = normalizeEmail(input.email);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as DbUser | undefined;
  if (!user) return null;
  if (!verifyPassword(input.password, user.password_hash)) return null;
  return toPublicUser(user);
}

export function createSession(userId: string): { token: string; expiresAt: string } {
  const db = getDb();
  const token = randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(randomUUID(), userId, tokenHash(token), expiresAt, now.toISOString());
  return { token, expiresAt };
}

export function getUserBySessionToken(token: string): PublicUser | null {
  if (!token) return null;
  const db = getDb();
  const now = new Date().toISOString();
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?
       LIMIT 1`
    )
    .get(tokenHash(token), now) as DbUser | undefined;
  return row ? toPublicUser(row) : null;
}

export function deleteSession(token: string): void {
  if (!token) return;
  getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
}

export function deleteExpiredSessions(): void {
  getDb().prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
}
