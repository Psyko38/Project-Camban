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

Le serveur démarre sur `http://localhost:3000`.

## Développement

```bash
npm run dev        # Frontend (Vite, port 5173)
npm run dev:server # Backend (port 3000)
npm run dev:all    # Les deux en parallèle
```

## Déploiement

### Alwaysdata

1. Créer un compte sur [alwaysdata.com](https://www.alwaysdata.com/en/register/) (plan gratuit 100 MB)
2. Cloner le repo via SSH :
   ```bash
   ssh <user>@ssh-<user>.alwaysdata.net
   mkdir -p ~/www/Project/Project-Camban
   cd ~/www/Project/Project-Camban
   git clone <repo> .
   npm install --production
   ```
3. Dans l'admin alwaysdata, créer un site Node.js :
   - **Type** : Node.js
   - **Commande** : `node dist-server/server/index.js`
   - **Working directory** : `www/Project/Project-Camban`
   - **Node.js** : 20 ou 22
   - **Hot restart** : SIGHUP
   - **Variable d'environnement** : `BASE_PATH=/Projet`

4. L'app sera accessible sur `https://<user>.alwaysdata.net/Projet`

### Mise à jour

```bash
ssh <user>@ssh-<user>.alwaysdata.net
cd ~/www/Project/Project-Camban
git pull
npm install --production
```

### Tout serveur Node.js

```bash
git clone <repo>
cd Project-Camban
npm install --production
npm run build:all
PORT=80 npm start
```

La base SQLite est créée automatiquement au premier lancement.

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port du serveur |
| `BASE_PATH` | *(vide)* | Préfixe de chemin (ex: `/Projet` pour alwaysdata) |
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
