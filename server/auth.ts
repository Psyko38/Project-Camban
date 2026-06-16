import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getDb } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "scrumflow-secret-change-me";
const TOKEN_EXPIRY = "7d";

export interface AuthPayload {
  authenticated: true;
}

export function setPassword(password: string): void {
  const db = getDb();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run("password_hash", hash);
}

export function hasPassword(): boolean {
  const db = getDb();
  const row = db.prepare("SELECT value FROM config WHERE key = 'password_hash'").get() as { value: string } | undefined;
  return !!row;
}

export function verifyPassword(password: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT value FROM config WHERE key = 'password_hash'").get() as { value: string } | undefined;
  if (!row) return false;
  return bcrypt.compareSync(password, row.value);
}

export function generateToken(): string {
  return jwt.sign({ authenticated: true } as AuthPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    if (payload.authenticated) return payload;
    return null;
  } catch {
    return null;
  }
}
