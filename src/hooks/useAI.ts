import { useState, useCallback } from "react";
import { aiApi } from "../api/client";
import type { Story, Sprint, Member, AppState, AcceptanceCriteria, Retrospective, StoryReview, Estimation } from "../types";

const now = () => new Date().toISOString().split("T")[0];

function parseJsonResponse<T>(content: string): T {
  let cleaned = content.trim();
  cleaned = cleaned.replace(/^```\w*\s*/i, "").replace(/\s*```$/i, "");

  try { return JSON.parse(cleaned) as T; } catch {}

  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{" || cleaned[i] === "[") {
      const open = cleaned[i];
      const close = open === "{" ? "}" : "]";
      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let j = i; j < cleaned.length; j++) {
        const ch = cleaned[j];
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === open) depth++;
        if (ch === close) depth--;
        if (depth === 0) {
          const candidate = cleaned.slice(i, j + 1);
          try { return JSON.parse(candidate) as T; } catch {}
          break;
        }
      }
    }
  }

  throw new Error("Impossible d'extraire un JSON valide de la réponse IA");
}

function systemPrompt(context: string) {
  return `Tu es un assistant Scrum expert pour l'application ScrumFlow.
${context}
Réponds TOUJOURS avec un objet JSON valide, sans texte avant ou après.
Ne utilises PAS de blocs de code markdown.
Les IDs doivent être au format "ai-{type}-{index}" (ex: ai-story-0, ai-sprint-0, ai-member-0).
Utilise les formats de date "YYYY-MM-DD".
Les story points utilisent la séquence: 1, 2, 3, 5, 8, 13, 21.`;
}

// ── Build project context from AppState (truncated for large projects) ──

const ROLE_LABELS: Record<string, string> = {
  po: "Product Owner",
  sm: "Scrum Master",
  dev: "Développeur",
  tester: "Testeur",
  designer: "Designer",
};

const PRIORITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function buildProjectContext(state: AppState, projectName?: string): string {
  const lines: string[] = [];

  if (projectName) {
    lines.push(`Projet : "${projectName}"`);
  }

  // ── ÉQUIPE ──
  if (state.members.length > 0) {
    lines.push(`\n=== ÉQUIPE (${state.members.length} membres) ===`);
    for (const m of state.members) {
      lines.push(`- ${m.name} (${ROLE_LABELS[m.role] || m.role})`);
    }
  }

  // ── SPRINTS ──
  if (state.sprints.length > 0) {
    lines.push(`\n=== SPRINTS (${state.sprints.length}) ===`);
    for (const s of state.sprints) {
      const duration = Math.round((new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 86400000);
      const sprintStories = state.stories.filter((st) => s.storyIds.includes(st.id));
      const sprintPoints = sprintStories.reduce((sum, st) => sum + st.points, 0);
      const statusLabel = s.status === "active" ? "🟢 ACTIF" : s.status === "completed" ? "✅ TERMINÉ" : "📋 PLANIFIÉ";
      lines.push(`${s.name} [${statusLabel}] — "${s.goal}"`);
      lines.push(`  ${s.startDate} → ${s.endDate} (${duration}j) | ${sprintStories.length} stories | ${sprintPoints}pts`);
    }
  }

  // ── KANBAN (stories du sprint actif) ──
  const activeSprint = state.sprints.find((s) => s.status === "active");
  if (activeSprint) {
    const kanbanStories = state.stories.filter((st) => activeSprint.storyIds.includes(st.id));
    lines.push(`\n=== KANBAN (${activeSprint.name} - "${activeSprint.goal}") ===`);

    const columns: Array<{ status: string; label: string }> = [
      { status: "todo", label: "À FAIRE" },
      { status: "in-progress", label: "EN COURS" },
      { status: "review", label: "EN REVUE" },
      { status: "done", label: "TERMINÉ" },
    ];

    for (const col of columns) {
      const colStories = kanbanStories.filter((st) => st.status === col.status);
      const colPoints = colStories.reduce((sum, st) => sum + st.points, 0);
      lines.push(`\n${col.label} (${colStories.length} stories, ${colPoints}pts) :`);
      if (colStories.length === 0) {
        lines.push(`  (vide)`);
      } else {
        for (const st of colStories) {
          const assignee = state.members.find((m) => m.id === st.assigneeId);
          const parts = [`  [${st.id}] ${st.title} (${st.points}pts, priorité: ${st.priority})`];
          if (assignee) parts.push(`→ ${assignee.name}`);
          lines.push(parts.join(" "));
        }
      }
    }
  }

  // ── BACKLOG (stories sans sprint) — top 20 by priority ──
  const backlogStories = state.stories
    .filter((st) => !st.sprintId)
    .sort((a, b) => (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0));

  if (backlogStories.length > 0) {
    const backlogPoints = backlogStories.reduce((sum, st) => sum + st.points, 0);
    const shown = backlogStories.slice(0, 20);
    lines.push(`\n=== BACKLOG (${backlogStories.length} stories, ${backlogPoints}pts) ===`);
    for (const st of shown) {
      lines.push(`  [${st.id}] ${st.title} (${st.points}pts, priorité: ${st.priority})`);
    }
    if (backlogStories.length > 20) {
      lines.push(`  ... et ${backlogStories.length - 20} autres stories`);
    }
  } else if (state.stories.length === 0) {
    lines.push(`\n=== BACKLOG ===`);
    lines.push(`  (vide - aucune story)`);
  }

  // ── HISTORIQUE (5 derniers sprints terminés) ──
  const completedSprints = state.sprints
    .filter((s) => s.status === "completed")
    .slice(-5);

  if (completedSprints.length > 0) {
    lines.push(`\n=== HISTORIQUE (${completedSprints.length} derniers sprints terminés) ===`);
    for (const s of completedSprints) {
      const sprintStories = state.stories.filter((st) => s.storyIds.includes(st.id));
      const doneStories = sprintStories.filter((st) => st.status === "done");
      const sprintPoints = sprintStories.reduce((sum, st) => sum + st.points, 0);
      const donePoints = doneStories.reduce((sum, st) => sum + st.points, 0);
      lines.push(`  ${s.name}: ${doneStories.length}/${sprintStories.length} stories terminées (${donePoints}/${sprintPoints}pts)`);
    }
  }

  return lines.join("\n");
}

// ── Generate a complete project ──────────────────────────────────────────
export interface GeneratedProject {
  name: string;
  description: string;
  color: string;
  members: { name: string; role: string }[];
  sprints: { name: string; goal: string; startDate: string; endDate: string; status: string }[];
  stories: { title: string; description: string; status: string; priority: string; points: number; sprintIndex: number }[];
}

export function useGenerateProject() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (description: string, existingState?: AppState): Promise<GeneratedProject | null> => {
    setLoading(true);
    setError(null);
    try {
      const colors = [
        "from-indigo-500 to-violet-600",
        "from-emerald-500 to-teal-600",
        "from-rose-500 to-pink-600",
        "from-amber-500 to-orange-600",
        "from-cyan-500 to-blue-600",
        "from-fuchsia-500 to-purple-600",
      ];
      const color = colors[Math.floor(Math.random() * colors.length)];

      const contextBlock = existingState && (existingState.members.length > 0 || existingState.sprints.length > 0 || existingState.stories.length > 0)
        ? `\nContexte existant dans le projet :\n${buildProjectContext(existingState)}\n`
        : "";

      const resp = await aiApi.generate([
        { role: "system", content: systemPrompt("Tu crées des projets Scrum complets.") },
        {
          role: "user",
          content: `Description du projet :
"${description}"
${contextBlock}
Réponds avec un JSON de cette forme exacte :
{
  "name": "nom du projet",
  "description": "description du projet",
  "members": [
    { "name": "Prénom Nom", "role": "po|sm|dev|tester|designer" }
  ],
  "sprints": [
    { "name": "Sprint 1", "goal": "objectif", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "status": "completed|active|planned" }
  ],
  "stories": [
    { "title": "En tant que... je veux...", "description": "description détaillée", "status": "backlog|todo|in-progress|review|done", "priority": "low|medium|high|critical", "points": 5, "sprintIndex": 0 }
  ]
}

Règles :
- Si un contexte existant est fourni, en tiens compte et complète-le
- Crée 3-6 membres avec des rôles variés
- Crée 2-4 sprints avec des dates réalistes (2 semaines chacun, séquentielles)
- Crée 8-15 user stories réalistes réparties dans les sprints
- Les stories des sprints completed ont status "done", active ont "in-progress", planned ont "backlog"
- Utilise la couleur "${color}" pour le projet`,
        },
      ]);

      return parseJsonResponse<GeneratedProject>(resp.content);
    } catch (err: any) {
      setError(err.message || "Erreur de génération");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading, error };
}

// ── Generate stories for a project ──────────────────────────────────────
export interface GeneratedStory {
  title: string;
  description: string;
  priority: string;
  points: number;
}

export function useGenerateStories() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (projectName: string, state: AppState, count: number, theme?: string): Promise<GeneratedStory[] | null> => {
    setLoading(true);
    setError(null);
    try {
      const projectContext = buildProjectContext(state, projectName);

      const themeBlock = theme?.trim()
        ? `\nThème / Contexte du projet :\n${theme.trim()}\n`
        : "";

      const resp = await aiApi.generate([
        { role: "system", content: systemPrompt("Tu crées des user stories pour un projet Scrum.") },
        {
          role: "user",
          content: `${projectContext}
${themeBlock}
Génère ${count} nouvelles user stories qui s'intègrent au contexte existant.
Réponds avec un JSON de cette forme exacte :
[
  { "title": "En tant que... je veux... afin de...", "description": "Description détaillée de la story", "priority": "low|medium|high|critical", "points": 1|2|3|5|8|13 }
]

Règles :
- Format standard : "En tant que [rôle], je veux [action] afin de [bénéfice]"
- Description détaillée et technique
- Points de story réalistes (séquence: 1,2,3,5,8,13)
- Priorités variées
- Contenu pertinent et utile
- Évite les doublons avec les stories existantes
- Respecte les rôles de l'équipe existante
- En cohérence avec les sprints et objectifs en cours`,
        },
      ]);

      const parsed = parseJsonResponse<GeneratedStory[]>(resp.content);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
      setError(err.message || "Erreur de génération");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading, error };
}

// ── Generate a sprint ───────────────────────────────────────────────────
export interface GeneratedSprint {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  storyIds: string[];
}

export function useGenerateSprint() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (
    projectName: string,
    state: AppState,
  ): Promise<GeneratedSprint | null> => {
    setLoading(true);
    setError(null);
    try {
      const backlogStories = state.stories.filter((s) => !s.sprintId);
      const projectContext = buildProjectContext(state, projectName);
      const sprintNum = state.sprints.length + 1;

      const resp = await aiApi.generate([
        { role: "system", content: systemPrompt("Tu planifies des sprints Scrum.") },
        {
          role: "user",
          content: `${projectContext}

Sprint numéro : ${sprintNum}
Stories dans le backlog : ${backlogStories.length}

Crée un sprint réaliste en tenant compte de l'historique des sprints précédents.
Réponds avec un JSON de cette forme exacte :
{
  "name": "Sprint ${sprintNum}",
  "goal": "objectif mesurable du sprint",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "storyIds": ["id1", "id2"]
}

Règles :
- Le sprint dure 2 semaines
- startDate = aujourd'hui (${now()})
- Sélectionne les stories pertinentes par leur ID parmi le backlog
- Capacité réaliste : ~30-40 points de story au total
- Priorise les stories à haute priorité
- Assure la cohérence des dépendances
- Tient compte de la vélocité des sprints précédents
- Les storyIds doivent correspondre à des IDs réelles du backlog`,
        },
      ]);

      return parseJsonResponse<GeneratedSprint>(resp.content);
    } catch (err: any) {
      setError(err.message || "Erreur de génération");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading, error };
}

// ── Complete a story ────────────────────────────────────────────────────
export interface CompletedStory {
  title: string;
  description: string;
  priority: string;
  points: number;
}

export function useCompleteStory() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (story: Partial<Story>, state: AppState): Promise<CompletedStory | null> => {
    setLoading(true);
    setError(null);
    try {
      const projectContext = buildProjectContext(state);

      const context = [
        story.title && `Titre : ${story.title}`,
        story.description && `Description : ${story.description}`,
        story.priority && `Priorité : ${story.priority}`,
        story.points && `Points : ${story.points}`,
      ].filter(Boolean).join("\n") || "Story vide";

      const resp = await aiApi.generate([
        { role: "system", content: systemPrompt("Tu complètes et améliores des user stories.") },
        {
          role: "user",
          content: `${projectContext}

Story à compléter :
${context}

Complète cette story avec des informations détaillées, en tenant compte du contexte du projet.
Réponds avec un JSON de cette forme exacte :
{
  "title": "Titre amélioré au format En tant que...",
  "description": "Description détaillée avec critères d'acceptation",
  "priority": "low|medium|high|critical",
  "points": 1|2|3|5|8|13
}

Règles :
- Améliore le titre si nécessaire (format "En tant que...")
- Ajoute des critères d'acceptation dans la description
- Ajuste les points si le scope le nécessite
- Sois précis et technique
- En cohérence avec les autres stories et le projet`,
        },
      ]);

      return parseJsonResponse<CompletedStory>(resp.content);
    } catch (err: any) {
      setError(err.message || "Erreur de génération");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading, error };
}

// ── Decompose a large story into smaller ones ───────────────────────────
export function useDecomposeStory() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (story: Story, state: AppState): Promise<GeneratedStory[] | null> => {
    setLoading(true);
    setError(null);
    try {
      const projectContext = buildProjectContext(state);

      const resp = await aiApi.generate([
        { role: "system", content: systemPrompt("Tu décomposes des user stories en sous-stories plus petites.") },
        {
          role: "user",
          content: `${projectContext}

Story à décomposer :
Titre : ${story.title}
Description : ${story.description}
Points : ${story.points}pts
Priorité : ${story.priority}

Décompose cette story en sous-stories plus petites et indépendantes.
Réponds avec un JSON de cette forme exacte :
[
  { "title": "En tant que... je veux... afin de...", "description": "Description détaillée", "priority": "low|medium|high|critical", "points": 1|2|3|5 }
]

Règles :
- Chaque sous-story doit faire entre 1 et 5 points
- Les sous-stories doivent couvrir TOUTE la story originale
- Respecter le format "En tant que... je veux... afin de..."
- Les sous-stories doivent être indépendantes autant que possible
- Total des points des sous-stories ≈ points de la story originale
- Priorités cohérentes avec la story originale`,
        },
      ]);

      const parsed = parseJsonResponse<GeneratedStory[]>(resp.content);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
      setError(err.message || "Erreur de génération");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading, error };
}

// ── Generate acceptance criteria ────────────────────────────────────────
export function useGenerateAcceptanceCriteria() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (story: Story, state: AppState): Promise<AcceptanceCriteria | null> => {
    setLoading(true);
    setError(null);
    try {
      const projectContext = buildProjectContext(state);

      const resp = await aiApi.generate([
        { role: "system", content: systemPrompt("Tu génères des critères d'acceptation au format Given/When/Then.") },
        {
          role: "user",
          content: `${projectContext}

Story :
Titre : ${story.title}
Description : ${story.description}
Points : ${story.points}pts

Génère des critères d'acceptation détaillés et testables pour cette story.
Réponds avec un JSON de cette forme exacte :
{
  "criteria": [
    { "given": "ETANT DONNE ...", "when": "QUAND ...", "then": "ALORS ...", "priority": "must|should|could" }
  ],
  "testSuggestions": [
    "Suggestion de test 1",
    "Suggestion de test 2"
  ]
}

Règles :
- Minimum 3 critères d'acceptation
- Format GIVEN/WHEN/THEN (ETANT DONNE/QUAND/ALORS) en français
- Chaque critère doit être testable et spécifique
- Priority : must (bloquant), should (important), could (nice-to-have)
- Inclure des suggestions de tests unitaires ou d'intégration
- Couvrir les cas nominal, d'erreur et limites`,
        },
      ]);

      return parseJsonResponse<AcceptanceCriteria>(resp.content);
    } catch (err: any) {
      setError(err.message || "Erreur de génération");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading, error };
}

// ── Generate retrospective ─────────────────────────────────────────────
export function useGenerateRetrospective() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (sprint: Sprint, state: AppState): Promise<Retrospective | null> => {
    setLoading(true);
    setError(null);
    try {
      const sprintStories = state.stories.filter((st) => sprint.storyIds.includes(st.id));
      const doneStories = sprintStories.filter((st) => st.status === "done");
      const totalPoints = sprintStories.reduce((sum, st) => sum + st.points, 0);
      const donePoints = doneStories.reduce((sum, st) => sum + st.points, 0);

      const completedSprints = state.sprints.filter((s) => s.status === "completed" && s.id !== sprint.id);
      const velocityHistory = completedSprints.map((s) => {
        const stories = state.stories.filter((st) => s.storyIds.includes(st.id));
        const done = stories.filter((st) => st.status === "done");
        return done.reduce((sum, st) => sum + st.points, 0);
      });

      const resp = await aiApi.generate([
        { role: "system", content: systemPrompt("Tu génères des rétrospectives d'équipe Scrum.") },
        {
          role: "user",
          content: `Rétrospective pour le sprint :
Sprint : ${sprint.name} — "${sprint.goal}"
Période : ${sprint.startDate} → ${sprint.endDate}
Stories réalisées : ${doneStories.length}/${sprintStories.length} (${donePoints}/${totalPoints}pts)
Vélocité(s) précédente(s) : ${velocityHistory.length > 0 ? velocityHistory.join(", ") : "Aucune"}
Équipe : ${state.members.map((m) => `${m.name} (${m.role})`).join(", ")}

Stories terminées :
${doneStories.map((st) => `- ${st.title} (${st.points}pts)`).join("\n") || "Aucune"}

Stories non terminées :
${sprintStories.filter((st) => st.status !== "done").map((st) => `- ${st.title} (${st.points}pts, ${st.status})`).join("\n") || "Aucune"}

Génère une rétrospective complète.
Réponds avec un JSON de cette forme exacte :
{
  "keepDoing": ["Ce qui a bien marché 1", "..."],
  "startDoing": ["À mettre en place 1", "..."],
  "stopDoing": ["À arrêter 1", "..."],
  "actions": [{ "action": "Action concrète", "owner": "Nom (optionnel)", "deadline": "YYYY-MM-DD (optionnel)" }],
  "metrics": [{ "label": "Métrique", "value": "Valeur", "trend": "improving|stable|declining" }]
}

Règles :
- 2-4 éléments par catégorie (keep/start/stop)
- Actions concrètes et assignables
- Métriques pertinentes ( vélocité, taux de complétion, etc.)
- Ton constructif et bienveillant
- Basé sur les données réelles du sprint`,
        },
      ]);

      return parseJsonResponse<Retrospective>(resp.content);
    } catch (err: any) {
      setError(err.message || "Erreur de génération");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading, error };
}

// ── Review / critique a story ──────────────────────────────────────────
export function useReviewStory() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (story: Story, state: AppState): Promise<StoryReview | null> => {
    setLoading(true);
    setError(null);
    try {
      const projectContext = buildProjectContext(state);

      const resp = await aiApi.generate([
        { role: "system", content: systemPrompt("Tu critiques et améliores des user stories Scrum.") },
        {
          role: "user",
          content: `${projectContext}

Story à reviewer :
Titre : ${story.title}
Description : ${story.description}
Points : ${story.points}pts
Priorité : ${story.priority}

Analyse la qualité de cette user story et donne un retour constructif.
Réponds avec un JSON de cette forme exacte :
{
  "score": 7,
  "issues": [
    { "severity": "critical|warning|info", "message": "Problème détecté", "suggestion": "Suggestion d'amélioration" }
  ],
  "improvedStory": {
    "title": "Titre amélioré",
    "description": "Description améliorée avec critères d'acceptation",
    "points": 5,
    "priority": "high"
  }
}

Règles :
- Score de 1 à 10 (10 = parfaite)
- Détecte : exigences vagues, critères manquants, scope trop large, ambiguités, doublons potentiels
- Severities : critical (bloquant), warning (à améliorer), info (suggestion)
- La story améliorée doit respecter le format "En tant que... je veux... afin de..."
- Sois spécifique et actionnable dans tes suggestions`,
        },
      ]);

      return parseJsonResponse<StoryReview>(resp.content);
    } catch (err: any) {
      setError(err.message || "Erreur de génération");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading, error };
}

// ── Estimate a story ───────────────────────────────────────────────────
export function useEstimateStory() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (story: Story, state: AppState): Promise<Estimation | null> => {
    setLoading(true);
    setError(null);
    try {
      const projectContext = buildProjectContext(state);

      const resp = await aiApi.generate([
        { role: "system", content: systemPrompt("Tu estimes des user stories Scrum avec justification.") },
        {
          role: "user",
          content: `${projectContext}

Story à estimer :
Titre : ${story.title}
Description : ${story.description}
Points actuels : ${story.points}pts
Priorité : ${story.priority}

Analyse cette story et recommande un nombre de story points avec justification.
Réponds avec un JSON de cette forme exacte :
{
  "recommendedPoints": 5,
  "minPoints": 3,
  "maxPoints": 8,
  "reasoning": "Justification détaillée de l'estimation...",
  "factors": [
    { "factor": "Complexité technique", "impact": "low|medium|high" },
    { "factor": "Dépendances", "impact": "low|medium|high" },
    { "factor": "Risques", "impact": "low|medium|high" },
    { "factor": "Effort de test", "impact": "low|medium|high" }
  ]
}

Règles :
- Utilise la séquence Fibonacci : 1, 2, 3, 5, 8, 13, 21
- Considère : complexité technique, effort, risques, dépendances, tests
- Le recommendedPoints doit être dans la séquence Fibonacci
- min/max doivent encadrer recommendedPoints
- Reasoning en français, clair et concis
- 4 facteurs minimum`,
        },
      ]);

      return parseJsonResponse<Estimation>(resp.content);
    } catch (err: any) {
      setError(err.message || "Erreur de génération");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading, error };
}

export { buildProjectContext };
