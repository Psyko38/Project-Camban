# ScrumFlow

Application de gestion de projet Scrum avec backend SQLite et assistant IA intégré.

## Stack

- **Frontend** : React 19, Tailwind CSS 4, Vite (single-file build)
- **Backend** : Express 5, better-sqlite3, JWT auth
- **IA** : OpenAI-compatible (Groq, Ollama, LM Studio, Together AI, OpenRouter)

## Démarrage

```bash
npm install
npm run build
npm start
```

Le serveur démarre sur `http://localhost:3001`.

## Développement

```bash
npm run dev        # Frontend (Vite, port 5173)
npm run dev:server # Backend (port 3001)
npm run dev:all    # Les deux en parallèle
```

## Déploiement

Un seul binaire Node.js suffit :

```bash
git clone <repo>
cd camban
npm install
npm run build
PORT=80 npm start
```

La base SQLite (`server/scrumflow.db`) est créée automatiquement au premier lancement.

## Fonctionnalités

- Gestion de projets, sprints, stories, membres
- Kanban, backlog, sprint board
- Auth par mot de passe (pas de comptes utilisateur)
- Panel IA : génération de projets, stories, sprints, complétion de stories
- Config IA multi-fournisseurs (OpenAI, Groq, Ollama, etc.)
- Toggle de raisonnement IA (off/low/medium/high)
- Import/export JSON

## Structure

```
├── server/
│   ├── index.ts          # Express + routes + static serving
│   ├── db.ts             # SQLite schema
│   ├── auth.ts           # JWT + bcrypt
│   └── routes/
│       ├── auth.ts       # POST /api/auth/setup, /login
│       ├── store.ts      # GET/PUT /api/store
│       └── ai.ts         # GET/PUT /api/ai/config, /models, POST /generate
├── src/
│   ├── components/       # React UI
│   ├── hooks/            # useStore, useAI, storage
│   ├── api/              # client.ts (auth, store, AI)
│   └── types.ts          # TypeScript types
├── dist/                 # Frontend buildé (single HTML file)
└── package.json
```

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3001` | Port du serveur |
| `JWT_SECRET` | `scrumflow-secret-change-me` | Secret JWT (à changer en prod) |
