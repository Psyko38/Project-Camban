import { Router } from "express";
import { generateToken, verifyPassword, hasPassword, setPassword } from "../auth.js";

const router = Router();

// POST /api/auth/setup — First-time password setup
router.post("/setup", (req, res) => {
  if (hasPassword()) {
    return res.status(400).json({ error: "Un mot de passe est déjà configuré" });
  }
  const { password } = req.body;
  if (!password || typeof password !== "string" || password.length < 4) {
    return res.status(400).json({ error: "Le mot de passe doit faire au moins 4 caractères" });
  }
  setPassword(password);
  const token = generateToken();
  res.json({ token });
});

// POST /api/auth/login
router.post("/login", (req, res) => {
  if (!hasPassword()) {
    return res.status(400).json({ error: "Aucun mot de passe configuré. Utilisez /api/auth/setup" });
  }
  const { password } = req.body;
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Mot de passe requis" });
  }
  if (!verifyPassword(password)) {
    return res.status(401).json({ error: "Mot de passe incorrect" });
  }
  const token = generateToken();
  res.json({ token });
});

// GET /api/auth/check — Check if password is set
router.get("/check", (_req, res) => {
  res.json({ hasPassword: hasPassword() });
});

export default router;
