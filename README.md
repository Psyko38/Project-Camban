# ScrumFlow

Application de gestion de projet Scrum avec backend SQLite et assistant IA intégré.

## Stack

- **Frontend** : React 19, Tailwind CSS 4, Vite (single-file build)
- **Backend** : Express 5, better-sqlite3, JWT auth, dotenv
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
npm run build:all
npm start
```

Le serveur tourne sur `http://localhost:3000` (API + frontend).

## Déploiement

### Alwaysdata

1. Créer un compte sur [alwaysdata.com](https://www.alwaysdata.com/en/register/) (plan gratuit 100 MB)
2. Se connecter en SSH et cloner le repo :
   ```bash
   ssh <user>@ssh-<user>.alwaysdata.net
   mkdir -p ~/www/Project/Project-Camban
   cd ~/www/Project/Project-Camban
   git clone <url_du_repo> .
   npm install --production
   ```
3. Dans l'admin alwaysdata (**Web > Sites > Ajouter un site**) :
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
rm -f dist-server/server/scrumflow.db*
git pull
npm install --production
```

### Tout serveur Node.js

```bash
git clone <url_du_repo>
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
│   ├── index.ts          # Express + routes + BASE_PATH + static serving
│   ├── db.ts             # SQLite schema
│   ├── auth.ts           # JWT + bcrypt
│   └── routes/
│       ├── auth.ts       # POST /api/auth/setup, /login
│       ├── store.ts      # GET/PUT /api/store
│       └── ai.ts         # GET/PUT /api/ai/config, /models, POST /generate
├── src/
│   ├── main.tsx          # Point d'entrée React
│   ├── App.tsx           # Composant principal
│   ├── index.css         # Styles Tailwind
│   ├── types.ts          # TypeScript types
│   ├── data.ts           # Données par défaut
│   ├── api/
│   │   └── client.ts     # Client API (auth, store, AI) - auto-détection BASE_PATH
│   ├── components/
│   │   ├── AIPanel.tsx   # Panel d'assistant IA
│   │   ├── Backlog.tsx   # Vue backlog
│   │   ├── Board.tsx     # Vue kanban
│   │   ├── Dashboard.tsx # Tableau de bord
│   │   ├── Login.tsx     # Écran d'authentification
│   │   ├── Members.tsx   # Gestion des membres
│   │   ├── ProjectManager.tsx  # Gestion de projets
│   │   ├── ProjectSwitcher.tsx # Sélecteur de projet
│   │   ├── Sprints.tsx   # Gestion des sprints
│   │   └── ui/           # Composants UI réutilisables
│   ├── hooks/
│   │   ├── useStore.ts   # Hook principal (state + API)
│   │   ├── useAI.ts      # Hook IA
│   │   ├── useResponsive.ts # Détection responsive
│   │   └── storage.ts    # Persistance localStorage
│   └── utils/
│       └── cn.ts         # Utilitaire de classes CSS
├── dist/                 # Frontend buildé (single HTML file)
├── dist-server/          # Backend compilé (JS)
├── .env                  # Variables d'environnement locales
├── vite.config.ts        # Config Vite + proxy dev
├── tsconfig.server.json  # Config TypeScript serveur
└── package.json
```
