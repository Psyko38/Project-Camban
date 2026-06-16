import { useState, useCallback } from "react";
import { aiApi } from "../api/client";
import type { Story, Sprint, Member, AppState } from "../types";

const now = () => new Date().toISOString().split("T")[0];
const uid = (type: string, i = 0) => `ai-${type}-${Date.now()}-${i}`;

function parseJsonResponse<T>(content: string): T {
  let cleaned = content.trim();
  // Remove any markdown code fences (json, html, text, or empty)
  cleaned = cleaned.replace(/^```\w*\s*/i, "").replace(/\s*```$/i, "");

  // 1. Try direct parse
  try { return JSON.parse(cleaned) as T; } catch {}

  // 2. Extract by brace matching
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

// ── Build project context from AppState ──────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  po: "Product Owner",
  sm: "Scrum Master",
  dev: "Développeur",
  tester: "Testeur",
  designer: "Designer",
};

const STATUS_LABELS: Record<string, string> = {
  backlog: "BACKLOG",
  "todo": "À FAIRE",
  "in-progress": "EN COURS",
  review: "EN REVUE",
  done: "TERMINÉ",
};

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

  // ── BACKLOG (stories sans sprint) ──
  const backlogStories = state.stories.filter((st) => !st.sprintId);
  if (backlogStories.length > 0) {
    const backlogPoints = backlogStories.reduce((sum, st) => sum + st.points, 0);
    lines.push(`\n=== BACKLOG (${backlogStories.length} stories, ${backlogPoints}pts) ===`);
    for (const st of backlogStories) {
      lines.push(`  [${st.id}] ${st.title} (${st.points}pts, priorité: ${st.priority})`);
    }
  } else if (state.stories.length === 0) {
    lines.push(`\n=== BACKLOG ===`);
    lines.push(`  (vide - aucune story)`);
  }

  // ── HISTORIQUE (sprints terminés) ──
  const completedSprints = state.sprints.filter((s) => s.status === "completed");
  if (completedSprints.length > 0) {
    lines.push(`\n=== HISTORIQUE (${completedSprints.length} sprints terminés) ===`);
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

      const parsed = parseJsonResponse<GeneratedProject>(resp.content);
      return parsed;
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

      const parsed = parseJsonResponse<GeneratedSprint>(resp.content);
      return parsed;
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

      const parsed = parseJsonResponse<CompletedStory>(resp.content);
      return parsed;
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
