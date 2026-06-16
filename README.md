# ScrumFlow

Application de gestion de projet Scrum avec backend SQLite et assistant IA intégré.

## Stack

- **Frontend** : React 19, Tailwind CSS 4, Vite (single-file build)
- **Backend** : Express 5, better-sqlite3, JWT auth
- **IA** : OpenAI-compatible (Groq, Ollama, LM Studio, Together AI, OpenRouter)

## Démarrage

```bash
npm install
npm run build:all
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

### Alwaysdata (recommandé)

1. Créer un compte sur [alwaysdata.com](https://www.alwaysdata.com/en/register/) (Free ou Plus)
2. Uploader le projet via SFTP/FTP :
   ```bash
   ssh <user>@ssh-<user>.alwaysdata.net
   cd www
   git clone <repo> scrumflow
   cd scrumflow
   npm install --production
   npm run build:all
   ```
3. Dans l'admin alwaysdata, créer un site Node.js :
   - **Type** : Node.js
   - **Commande** : `node $HOME/www/scrumflow/dist-server/server/index.js`
   - **Version Node.js** : 20 ou 22
   - **Hot restart** : SIGHUP

### Tout serveur Node.js

```bash
git clone <repo>
cd camban
npm install --production
npm run build:all
PORT=80 npm start
```

La base SQLite est créée automatiquement au premier lancement.

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3001` | Port du serveur |
| `JWT_SECRET` | `scrumflow-secret-change-me` | Secret JWT (à changer en prod) |
| `DB_PATH` | `./scrumflow.db` | Chemin vers la base SQLite |

## Fonctionnalités

- Gestion de projets, sprints, stories, membres
- Kanban, backlog, sprint board
- Auth par mot de passe (pas de comptes utilisateur)
- Panel IA : génération de projets, stories, sprints, complétion de stories
- Décomposition de stories, critères d'acceptation, rétrospectives, reviews, estimations
- Config IA multi-fournisseurs (OpenAI, Groq, Ollama, etc.)
- Toggle de raisonnement IA (off/low/medium/high/max)
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
├── dist-server/          # Backend compilé (JS)
└── package.json
```
