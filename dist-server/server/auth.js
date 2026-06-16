import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getDb } from "./db.js";
const JWT_SECRET = process.env.JWT_SECRET || "scrumflow-secret-change-me";
const TOKEN_EXPIRY = "7d";
export function setPassword(password) {
    const db = getDb();
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run("password_hash", hash);
}
export function hasPassword() {
    const db = getDb();
    const row = db.prepare("SELECT value FROM config WHERE key = 'password_hash'").get();
    return !!row;
}
export function verifyPassword(password) {
    const db = getDb();
    const row = db.prepare("SELECT value FROM config WHERE key = 'password_hash'").get();
    if (!row)
        return false;
    return bcrypt.compareSync(password, row.value);
}
export function generateToken() {
    return jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}
export function verifyToken(token) {
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.authenticated)
            return payload;
        return null;
    }
    catch {
        return null;
    }
}
