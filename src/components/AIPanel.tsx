import { useState, useEffect } from "react";
import { aiApi, type AiModel } from "../api/client";
import {
  useGenerateProject,
  useGenerateStories,
  useGenerateSprint,
  useCompleteStory,
  useDecomposeStory,
  useGenerateAcceptanceCriteria,
  useGenerateRetrospective,
  useReviewStory,
  useEstimateStory,
  type GeneratedProject,
  type GeneratedStory,
  type GeneratedSprint,
  type CompletedStory,
} from "../hooks/useAI";
import { Button } from "./ui/Button";
import { Sparkles, Settings, Loader2, CheckCircle2, AlertCircle } from "./ui/icons";
import type { AppState, Story, Sprint, AcceptanceCriteria, Retrospective, StoryReview, Estimation } from "../types";

type AiTab = "project" | "stories" | "sprint" | "story" | "decompose" | "criteria" | "retro" | "review" | "estimate";

const PROVIDER_PRESETS = [
  { label: "OpenAI", url: "https://api.openai.com/v1" },
  { label: "Groq", url: "https://api.groq.com/openai/v1" },
  { label: "DeepSeek", url: "https://api.deepseek.com" },
  { label: "xAI (Grok)", url: "https://api.x.ai/v1" },
  { label: "Anthropic", url: "https://api.anthropic.com/v1" },
  { label: "Ollama (local)", url: "http://localhost:11434/v1" },
  { label: "LM Studio (local)", url: "http://localhost:1234/v1" },
  { label: "Together AI", url: "https://api.together.xyz/v1" },
  { label: "OpenRouter", url: "https://openrouter.ai/api/v1" },
  { label: "Autre", url: "__custom__" },
];

const REASONING_HELP: Record<string, string> = {
  openai: "o1, o3, o4, gpt-5 : low / medium / high",
  groq: "GPT-OSS : low / medium / high | Qwen3 : none / default",
  deepseek: "V4-Pro/Flash : high / max (low/medium → high)",
  xai: "Grok : none / low / medium / high",
  openrouter: "Dépend du modèle routé",
  anthropic: "Claude 4.6+ : adaptive thinking (low → max)",
  ollama: "Le reasoning est géré par le modèle, ignoré",
  lmstudio: "Le reasoning est géré par le modèle, ignoré",
  together: "Pas de support reasoning",
  unknown: "Modèles reasoning : o1, o3, o4, gpt-5, deepseek, grok",
};

function getProviderFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("api.openai.com"))      return "openai";
  if (u.includes("api.groq.com"))        return "groq";
  if (u.includes("api.deepseek.com"))    return "deepseek";
  if (u.includes("api.x.ai"))            return "xai";
  if (u.includes("openrouter.ai"))       return "openrouter";
  if (u.includes("api.anthropic.com"))   return "anthropic";
  if (u.includes("localhost:11434"))      return "ollama";
  if (u.includes("localhost:1234"))       return "lmstudio";
  if (u.includes("api.together.xyz"))     return "together";
  return "unknown";
}

interface AIPanelProps {
  state: AppState;
  createProject: (name: string, color: string, description: string) => string;
  setProjectState: React.Dispatch<React.SetStateAction<AppState>>;
}

export function AIPanel({ state, createProject, setProjectState }: AIPanelProps) {
  const [activeAiTab, setActiveAiTab] = useState<AiTab>("project");
  const [showConfig, setShowConfig] = useState(false);

  // Config state
  const [apiBaseUrl, setApiBaseUrl] = useState(PROVIDER_PRESETS[0].url);
  const [customUrl, setCustomUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiModel, setApiModel] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState<string | null>(null);

  // Models state
  const [models, setModels] = useState<AiModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Load current config on mount
  useEffect(() => {
    aiApi.getConfig().then((c) => {
      setHasKey(c.hasKey);
      setApiModel(c.model);
      setApiBaseUrl(c.apiBaseUrl);
      setReasoningEffort(c.reasoningEffort);
      // Check if it matches a preset
      const isPreset = PROVIDER_PRESETS.some((p) => p.url === c.apiBaseUrl && p.url !== "__custom__");
      if (!isPreset) {
        setCustomUrl(c.apiBaseUrl);
      }
    }).catch(() => {});
  }, []);

  const effectiveUrl = apiBaseUrl === "__custom__" ? customUrl : apiBaseUrl;
  const isLocal = effectiveUrl.includes("localhost") || effectiveUrl.includes("127.0.0.1");

  async function fetchModels() {
    setModelsLoading(true);
    setModelsError(null);
    try {
      // Save URL + API key so the backend can fetch models with auth
      const toSave: { apiBaseUrl?: string; apiKey?: string } = { apiBaseUrl: effectiveUrl };
      if (apiKey && apiKey.length > 0 && !apiKey.includes("•")) {
        toSave.apiKey = apiKey;
      }
      await aiApi.saveConfig(toSave);
      const { models: list } = await aiApi.listModels();
      setModels(list);
      // If no model selected and models available, select first
      if (!apiModel && list.length > 0) {
        setApiModel(list[0].id);
      }
    } catch (err: any) {
      setModelsError(err.message || "Erreur de connexion");
    } finally {
      setModelsLoading(false);
    }
  }

  async function saveConfig() {
    try {
      const toSave: { apiKey?: string; apiBaseUrl?: string; model?: string; reasoningEffort?: string | null } = {};
      // Only save API key if user typed something new (not the masked placeholder)
      if (apiKey && apiKey.length > 0 && !apiKey.includes("•")) {
        toSave.apiKey = apiKey;
      }
      toSave.apiBaseUrl = effectiveUrl;
      if (apiModel) {
        toSave.model = apiModel;
      }
      toSave.reasoningEffort = reasoningEffort;
      await aiApi.saveConfig(toSave);
      setHasKey(true);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
    } catch (err: any) {
      alert(err.message);
    }
  }

  const isConfigured = hasKey || isLocal;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assistant IA</h2>
            <p className="text-xs text-slate-500">Générez des projets, stories et sprints avec l'IA</p>
          </div>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Configuration"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Config panel */}
      {showConfig && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Configuration du serveur IA</h3>

          {/* Provider presets */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Fournisseur</label>
            <div className="flex flex-wrap gap-2">
              {PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setApiBaseUrl(preset.url);
                    if (preset.url !== "__custom__") {
                      setCustomUrl("");
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    apiBaseUrl === preset.url
                      ? "bg-violet-50 border-violet-300 text-violet-700"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom URL */}
          {apiBaseUrl === "__custom__" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">URL de base</label>
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://mon-provider.com/v1"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
              />
            </div>
          )}

          {/* Show selected URL */}
          {apiBaseUrl !== "__custom__" && (
            <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              {effectiveUrl}
            </div>
          )}

          {/* API Key — never displayed, never pre-filled */}
          {!isLocal && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Clé API</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasKey ? "•••••••• (déjà enregistrée)" : "Entrez votre clé API"}
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
              />
            </div>
          )}

          {isLocal && (
            <div className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
              Serveur local détecté — pas de clé API requise
            </div>
          )}

          {/* Fetch models button */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchModels}
              disabled={modelsLoading || !effectiveUrl}
              icon={modelsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {modelsLoading ? "Chargement..." : "Charger les modèles"}
            </Button>
            {models.length > 0 && (
              <span className="text-xs text-slate-500">{models.length} modèle(s) disponible(s)</span>
            )}
          </div>

          {modelsError && (
            <p className="text-xs text-red-600">{modelsError}</p>
          )}

          {/* Model selector */}
          {models.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Modèle</label>
              <select
                value={apiModel}
                onChange={(e) => setApiModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.id}</option>
                ))}
              </select>
            </div>
          )}

          {/* Manual model input if no models fetched */}
          {models.length === 0 && !modelsLoading && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Modèle (manuel)</label>
              <input
                type="text"
                value={apiModel}
                onChange={(e) => setApiModel(e.target.value)}
                placeholder="ex: gpt-4o-mini, llama3, mistral..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none"
              />
            </div>
          )}

          {/* Reasoning effort */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Réflexion IA (reasoning)</label>
            <div className="flex gap-1.5">
              {([
                { value: null, label: "Off" },
                { value: "low", label: "Low" },
                { value: "medium", label: "Med" },
                { value: "high", label: "High" },
                { value: "max", label: "Max" },
              ]).map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setReasoningEffort(opt.value)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    reasoningEffort === opt.value
                      ? "bg-violet-50 border-violet-300 text-violet-700"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {REASONING_HELP[getProviderFromUrl(effectiveUrl)] || REASONING_HELP.unknown}
            </p>
          </div>

          {/* Save */}
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={saveConfig}>
              {configSaved ? <><CheckCircle2 className="h-4 w-4" /> Sauvegardé</> : "Sauvegarder"}
            </Button>
          </div>
        </div>
      )}

      {!isConfigured && !showConfig && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Serveur IA non configuré</p>
            <p className="text-xs text-amber-600 mt-1">
              Cliquez sur l'icône ⚙️ pour configurer un fournisseur IA (OpenAI, Groq, Ollama...).
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {([
          { id: "project" as AiTab, label: "Projet" },
          { id: "stories" as AiTab, label: "Stories" },
          { id: "sprint" as AiTab, label: "Sprint" },
          { id: "story" as AiTab, label: "Story" },
          { id: "decompose" as AiTab, label: "Décomposer" },
          { id: "criteria" as AiTab, label: "Critères" },
          { id: "retro" as AiTab, label: "Rétro" },
          { id: "review" as AiTab, label: "Review" },
          { id: "estimate" as AiTab, label: "Estimer" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveAiTab(tab.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeAiTab === tab.id
                ? "bg-white text-violet-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeAiTab === "project" && <ProjectGenerator state={state} createProject={createProject} setProjectState={setProjectState} />}
      {activeAiTab === "stories" && <StoriesGenerator state={state} setProjectState={setProjectState} />}
      {activeAiTab === "sprint" && <SprintGenerator state={state} setProjectState={setProjectState} />}
      {activeAiTab === "story" && <StoryCompleter state={state} setProjectState={setProjectState} />}
      {activeAiTab === "decompose" && <StoryDecomposer state={state} setProjectState={setProjectState} />}
      {activeAiTab === "criteria" && <AcceptanceCriteriaGenerator state={state} setProjectState={setProjectState} />}
      {activeAiTab === "retro" && <RetrospectiveGenerator state={state} />}
      {activeAiTab === "review" && <StoryReviewer state={state} />}
      {activeAiTab === "estimate" && <StoryEstimator state={state} />}
    </div>
  );
}

// ── Project Generator ───────────────────────────────────────────────────
function ProjectGenerator({ state, createProject, setProjectState }: { state: AppState; createProject: (name: string, color: string, desc: string) => string; setProjectState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<GeneratedProject | null>(null);
  const gen = useGenerateProject();

  async function handleGenerate() {
    if (!prompt.trim()) return;
    const result = await gen.generate(prompt, state);
    if (result) setPreview(result);
  }

  function handleApply() {
    if (!preview) return;
    const projectId = createProject(preview.name, preview.color || "from-indigo-500 to-violet-600", preview.description);
    setProjectState((prev) => ({
      ...prev,
      members: preview.members.map((m, i) => ({
        id: uid("member", i),
        name: m.name,
        role: m.role as any,
      })),
      sprints: preview.sprints.map((s, i) => ({
        id: uid("sprint", i),
        name: s.name,
        goal: s.goal,
        startDate: s.startDate,
        endDate: s.endDate,
        status: s.status as any,
        storyIds: [],
      })),
      stories: preview.stories.map((s, i) => ({
        id: uid("story", i),
        title: s.title,
        description: s.description,
        status: s.status as any,
        priority: s.priority as any,
        points: s.points,
        createdAt: now(),
        sprintId: undefined as string | undefined,
      })),
    }));
    // Link stories to sprints after setting
    setProjectState((prev) => {
      const storyIds = prev.stories.map((s) => s.id);
      return {
        ...prev,
        sprints: prev.sprints.map((sp, si) => ({
          ...sp,
          storyIds: preview.stories
            .map((s, i) => ({ sprintIndex: s.sprintIndex, storyId: storyIds[i] }))
            .filter((x) => x.sprintIndex === si)
            .map((x) => x.storyId),
        })),
      };
    });
    setPreview(null);
    setPrompt("");
  }

  return (
    <div className="space-y-4">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Décrivez votre projet... ex: 'Application e-commerce pour vendre des produits artisanaux avec un panier, des paiements et un suivi de commandes'"
        className="w-full h-32 px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
      />
      <Button variant="primary" onClick={handleGenerate} disabled={gen.loading || !prompt.trim()} icon={gen.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}>
        {gen.loading ? "Génération en cours..." : "Générer le projet"}
      </Button>
      {gen.error && <p className="text-sm text-red-600">{gen.error}</p>}

      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-bold text-slate-900">{preview.name}</h3>
          <p className="text-sm text-slate-600">{preview.description}</p>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span>{preview.members.length} membres</span>
            <span>{preview.sprints.length} sprints</span>
            <span>{preview.stories.length} stories</span>
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <p><strong>Membres :</strong> {preview.members.map((m) => `${m.name} (${m.role})`).join(", ")}</p>
            <p><strong>Sprints :</strong> {preview.sprints.map((s) => s.name).join(", ")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleApply} icon={<CheckCircle2 className="h-4 w-4" />}>
              Appliquer au projet actif
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPreview(null)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stories Generator ───────────────────────────────────────────────────
function StoriesGenerator({ state, setProjectState }: { state: AppState; setProjectState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [count, setCount] = useState(5);
  const [theme, setTheme] = useState("");
  const [preview, setPreview] = useState<GeneratedStory[] | null>(null);
  const gen = useGenerateStories();

  async function handleGenerate() {
    const result = await gen.generate("Projet", state, count, theme);
    if (result) setPreview(result);
  }

  function handleApply() {
    if (!preview) return;
    const newStories: Story[] = preview.map((s, i) => ({
      id: uid("story", i),
      title: s.title,
      description: s.description,
      status: "backlog" as const,
      priority: s.priority as any,
      points: s.points,
      createdAt: now(),
    }));
    setProjectState((prev) => ({ ...prev, stories: [...prev.stories, ...newStories] }));
    setPreview(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Thème du projet (optionnel)</label>
        <textarea
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="ex: Application de réservation de restaurants, avec gestion des tables, des commandes et des avis clients..."
          className="w-full h-24 px-3 py-2 rounded-lg border border-slate-200 text-sm resize-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600">Nombre de stories :</label>
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
        >
          {[3, 5, 8, 10, 15].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <Button variant="primary" onClick={handleGenerate} disabled={gen.loading} icon={gen.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}>
        {gen.loading ? "Génération en cours..." : `Générer ${count} stories`}
      </Button>
      {gen.error && <p className="text-sm text-red-600">{gen.error}</p>}

      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-bold text-slate-900">{preview.length} stories générées</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {preview.map((s, i) => (
              <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-sm font-medium text-slate-800">{s.title}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.description}</p>
                <div className="flex gap-2 mt-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${s.priority === "critical" ? "bg-red-100 text-red-700" : s.priority === "high" ? "bg-orange-100 text-orange-700" : s.priority === "medium" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{s.priority}</span>
                  <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">{s.points}pts</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleApply} icon={<CheckCircle2 className="h-4 w-4" />}>
              Ajouter au backlog
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPreview(null)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sprint Generator ────────────────────────────────────────────────────
function SprintGenerator({ state, setProjectState }: { state: AppState; setProjectState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [preview, setPreview] = useState<GeneratedSprint | null>(null);
  const gen = useGenerateSprint();
  const backlogStories = state.stories.filter((s) => {
    const activeSprint = state.sprints.find((sp) => sp.status === "active");
    return activeSprint ? !activeSprint.storyIds.includes(s.id) : !s.sprintId;
  });

  async function handleGenerate() {
    const result = await gen.generate("Projet", state);
    if (result) setPreview(result);
  }

  function handleApply() {
    if (!preview) return;
    const newSprint: Sprint = {
      id: uid("sprint"),
      name: preview.name,
      goal: preview.goal,
      startDate: preview.startDate,
      endDate: preview.endDate,
      status: "planned",
      storyIds: preview.storyIds.filter((id) => state.stories.some((s) => s.id === id)),
    };
    setProjectState((prev) => ({
      ...prev,
      sprints: [...prev.sprints, newSprint],
    }));
    setPreview(null);
  }

  return (
    <div className="space-y-4">
      {backlogStories.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
          {state.stories.length === 0
            ? "Aucune story dans le projet. Générez des stories d'abord."
            : "Toutes les stories sont dans le sprint actif. L'IA pourra réorganiser les stories existantes."}
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            {backlogStories.length} stories hors du sprint actif
          </p>
          <Button variant="primary" onClick={handleGenerate} disabled={gen.loading} icon={gen.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}>
            {gen.loading ? "Génération en cours..." : "Générer un sprint"}
          </Button>
        </>
      )}
      {gen.error && <p className="text-sm text-red-600">{gen.error}</p>}

      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-bold text-slate-900">{preview.name}</h3>
          <p className="text-sm text-slate-600">{preview.goal}</p>
          <div className="text-xs text-slate-500">
            {preview.startDate} → {preview.endDate} ({Math.round((new Date(preview.endDate).getTime() - new Date(preview.startDate).getTime()) / 86400000)} jours)
          </div>
          <p className="text-xs text-slate-500">{preview.storyIds.length} stories sélectionnées</p>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleApply} icon={<CheckCircle2 className="h-4 w-4" />}>
              Créer le sprint
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPreview(null)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Story Completer ─────────────────────────────────────────────────────
function StoryCompleter({ state, setProjectState }: { state: AppState; setProjectState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [preview, setPreview] = useState<CompletedStory | null>(null);
  const gen = useCompleteStory();

  const selectedStory = state.stories.find((s) => s.id === selectedId);

  async function handleGenerate() {
    if (!selectedStory) return;
    const result = await gen.generate(selectedStory, state);
    if (result) setPreview(result);
  }

  function handleApply() {
    if (!preview || !selectedId) return;
    setProjectState((prev) => ({
      ...prev,
      stories: prev.stories.map((s) =>
        s.id === selectedId
          ? { ...s, title: preview.title, description: preview.description, priority: preview.priority as any, points: preview.points }
          : s
      ),
    }));
    setPreview(null);
    setSelectedId("");
  }

  return (
    <div className="space-y-4">
      {state.stories.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
          Aucune story disponible. Créez-en d'abord.
        </p>
      ) : (
        <>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
          >
            <option value="">Sélectionnez une story...</option>
            {state.stories.map((s) => (
              <option key={s.id} value={s.id}>{s.title || "(sans titre)"} — {s.points}pts</option>
            ))}
          </select>
          <Button variant="primary" onClick={handleGenerate} disabled={gen.loading || !selectedStory} icon={gen.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}>
            {gen.loading ? "Analyse en cours..." : "Compléter cette story"}
          </Button>
        </>
      )}
      {gen.error && <p className="text-sm text-red-600">{gen.error}</p>}

      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">{preview.title}</h3>
          <p className="text-xs text-slate-600 whitespace-pre-wrap">{preview.description}</p>
          <div className="flex gap-2 text-xs">
            <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">{preview.points}pts</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{preview.priority}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleApply} icon={<CheckCircle2 className="h-4 w-4" />}>
              Appliquer les changements
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPreview(null)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function now() {
  return new Date().toISOString().split("T")[0];
}

function uid(type: string, i = 0) {
  return `ai-${type}-${Date.now()}-${i}`;
}

// ── Story Decomposer ──────────────────────────────────────────────────
function StoryDecomposer({ state, setProjectState }: { state: AppState; setProjectState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [preview, setPreview] = useState<GeneratedStory[] | null>(null);
  const gen = useDecomposeStory();
  const selectedStory = state.stories.find((s) => s.id === selectedId);

  async function handleGenerate() {
    if (!selectedStory) return;
    const result = await gen.generate(selectedStory, state);
    if (result) setPreview(result);
  }

  function handleApply() {
    if (!preview || !selectedId) return;
    const newStories: Story[] = preview.map((s, i) => ({
      id: uid("story", i),
      title: s.title,
      description: s.description,
      status: "backlog" as const,
      priority: s.priority as any,
      points: s.points,
      createdAt: now(),
    }));
    setProjectState((prev) => ({
      ...prev,
      stories: prev.stories.filter((s) => s.id !== selectedId).concat(newStories),
    }));
    setPreview(null);
    setSelectedId("");
  }

  return (
    <div className="space-y-4">
      {state.stories.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">Aucune story disponible.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">Sélectionnez une story de 8+ points à décomposer en sous-stories plus petites.</p>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
            <option value="">Sélectionnez une story...</option>
            {state.stories.filter((s) => s.points >= 5).map((s) => (
              <option key={s.id} value={s.id}>{s.title} — {s.points}pts</option>
            ))}
          </select>
          <Button variant="primary" onClick={handleGenerate} disabled={gen.loading || !selectedStory} icon={gen.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}>
            {gen.loading ? "Décomposition en cours..." : "Décomposer cette story"}
          </Button>
        </>
      )}
      {gen.error && <p className="text-sm text-red-600">{gen.error}</p>}
      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">{preview.length} sous-stories générées</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {preview.map((s, i) => (
              <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-sm font-medium text-slate-800">{s.title}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.description}</p>
                <div className="flex gap-2 mt-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${s.priority === "critical" ? "bg-red-100 text-red-700" : s.priority === "high" ? "bg-orange-100 text-orange-700" : s.priority === "medium" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{s.priority}</span>
                  <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">{s.points}pts</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleApply} icon={<CheckCircle2 className="h-4 w-4" />}>Remplacer par les sous-stories</Button>
            <Button variant="secondary" size="sm" onClick={() => setPreview(null)}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Acceptance Criteria Generator ─────────────────────────────────────
function AcceptanceCriteriaGenerator({ state, setProjectState }: { state: AppState; setProjectState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [preview, setPreview] = useState<AcceptanceCriteria | null>(null);
  const gen = useGenerateAcceptanceCriteria();
  const selectedStory = state.stories.find((s) => s.id === selectedId);

  async function handleGenerate() {
    if (!selectedStory) return;
    const result = await gen.generate(selectedStory, state);
    if (result) setPreview(result);
  }

  function handleInsert() {
    if (!preview || !selectedId) return;
    const criteriaText = "\n\n## Critères d'acceptation\n" + preview.criteria.map((c, i) =>
      `${i + 1}. **ETANT DONNE** ${c.given}\n   **QUAND** ${c.when}\n   **ALORS** ${c.then}\n   _Priorité : ${c.priority}_`
    ).join("\n\n");
    const testsText = "\n\n## Suggestions de tests\n" + preview.testSuggestions.map((t) => `- ${t}`).join("\n");

    setProjectState((prev) => ({
      ...prev,
      stories: prev.stories.map((s) =>
        s.id === selectedId ? { ...s, description: s.description + criteriaText + testsText } : s
      ),
    }));
    setPreview(null);
    setSelectedId("");
  }

  return (
    <div className="space-y-4">
      {state.stories.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">Aucune story disponible.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">Générez des critères d'acceptation GIVEN/WHEN/THEN pour une story.</p>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
            <option value="">Sélectionnez une story...</option>
            {state.stories.map((s) => (
              <option key={s.id} value={s.id}>{s.title} — {s.points}pts</option>
            ))}
          </select>
          <Button variant="primary" onClick={handleGenerate} disabled={gen.loading || !selectedStory} icon={gen.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}>
            {gen.loading ? "Génération en cours..." : "Générer les critères"}
          </Button>
        </>
      )}
      {gen.error && <p className="text-sm text-red-600">{gen.error}</p>}
      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Critères d'acceptation</h3>
          <div className="space-y-3">
            {preview.criteria.map((c, i) => (
              <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1">
                <p><strong className="text-blue-700">ETANT DONNE</strong> {c.given}</p>
                <p><strong className="text-amber-700">QUAND</strong> {c.when}</p>
                <p><strong className="text-green-700">ALORS</strong> {c.then}</p>
                <span className={`px-1.5 py-0.5 rounded ${c.priority === "must" ? "bg-red-100 text-red-700" : c.priority === "should" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>{c.priority}</span>
              </div>
            ))}
          </div>
          {preview.testSuggestions.length > 0 && (
            <div className="text-xs">
              <p className="font-medium text-slate-700 mb-1">Suggestions de tests :</p>
              <ul className="list-disc list-inside text-slate-500 space-y-0.5">
                {preview.testSuggestions.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleInsert} icon={<CheckCircle2 className="h-4 w-4" />}>Insérer dans la story</Button>
            <Button variant="secondary" size="sm" onClick={() => setPreview(null)}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Retrospective Generator ──────────────────────────────────────────
function RetrospectiveGenerator({ state }: { state: AppState }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [preview, setPreview] = useState<Retrospective | null>(null);
  const gen = useGenerateRetrospective();
  const completedSprints = state.sprints.filter((s) => s.status === "completed");
  const selectedSprint = state.sprints.find((s) => s.id === selectedId);

  async function handleGenerate() {
    if (!selectedSprint) return;
    const result = await gen.generate(selectedSprint, state);
    if (result) setPreview(result);
  }

  return (
    <div className="space-y-4">
      {completedSprints.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">Aucun sprint terminé. Terminez un sprint d'abord.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">Générez une rétrospective pour un sprint terminé.</p>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
            <option value="">Sélectionnez un sprint terminé...</option>
            {completedSprints.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.goal}</option>
            ))}
          </select>
          <Button variant="primary" onClick={handleGenerate} disabled={gen.loading || !selectedSprint} icon={gen.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}>
            {gen.loading ? "Génération en cours..." : "Générer la rétrospective"}
          </Button>
        </>
      )}
      {gen.error && <p className="text-sm text-red-600">{gen.error}</p>}
      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Rétrospective — {selectedSprint?.name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <p className="font-semibold text-emerald-700 mb-2">Continuer</p>
              <ul className="space-y-1 text-emerald-600">{preview.keepDoing.map((item, i) => <li key={i}>✓ {item}</li>)}</ul>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
              <p className="font-semibold text-blue-700 mb-2">Commencer</p>
              <ul className="space-y-1 text-blue-600">{preview.startDoing.map((item, i) => <li key={i}>+ {item}</li>)}</ul>
            </div>
            <div className="p-3 rounded-lg bg-red-50 border border-red-100">
              <p className="font-semibold text-red-700 mb-2">Arrêter</p>
              <ul className="space-y-1 text-red-600">{preview.stopDoing.map((item, i) => <li key={i}>✗ {item}</li>)}</ul>
            </div>
          </div>
          {preview.actions.length > 0 && (
            <div className="text-xs">
              <p className="font-semibold text-slate-700 mb-2">Actions concrètes :</p>
              <div className="space-y-1">
                {preview.actions.map((a, i) => (
                  <p key={i} className="text-slate-600">• {a.action}{a.owner ? ` → ${a.owner}` : ""}{a.deadline ? ` (${a.deadline})` : ""}</p>
                ))}
              </div>
            </div>
          )}
          {preview.metrics.length > 0 && (
            <div className="text-xs">
              <p className="font-semibold text-slate-700 mb-2">Métriques :</p>
              <div className="flex flex-wrap gap-2">
                {preview.metrics.map((m, i) => (
                  <span key={i} className={`px-2 py-1 rounded ${m.trend === "improving" ? "bg-emerald-100 text-emerald-700" : m.trend === "declining" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                    {m.label}: {m.value} {m.trend === "improving" ? "↑" : m.trend === "declining" ? "↓" : "→"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Story Reviewer ───────────────────────────────────────────────────
function StoryReviewer({ state }: { state: AppState }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [preview, setPreview] = useState<StoryReview | null>(null);
  const gen = useReviewStory();
  const selectedStory = state.stories.find((s) => s.id === selectedId);

  async function handleGenerate() {
    if (!selectedStory) return;
    const result = await gen.generate(selectedStory, state);
    if (result) setPreview(result);
  }

  return (
    <div className="space-y-4">
      {state.stories.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">Aucune story disponible.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">Reviewez la qualité d'une story et obtenez des suggestions d'amélioration.</p>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
            <option value="">Sélectionnez une story...</option>
            {state.stories.map((s) => (
              <option key={s.id} value={s.id}>{s.title} — {s.points}pts</option>
            ))}
          </select>
          <Button variant="primary" onClick={handleGenerate} disabled={gen.loading || !selectedStory} icon={gen.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}>
            {gen.loading ? "Analyse en cours..." : "Reviewer cette story"}
          </Button>
        </>
      )}
      {gen.error && <p className="text-sm text-red-600">{gen.error}</p>}
      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-900 text-sm">Review</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${preview.score >= 7 ? "bg-emerald-100 text-emerald-700" : preview.score >= 4 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
              {preview.score}/10
            </span>
          </div>
          {preview.issues.length > 0 && (
            <div className="space-y-2">
              {preview.issues.map((issue, i) => (
                <div key={i} className={`p-3 rounded-lg text-xs border ${issue.severity === "critical" ? "bg-red-50 border-red-100" : issue.severity === "warning" ? "bg-amber-50 border-amber-100" : "bg-blue-50 border-blue-100"}`}>
                  <p className={`font-medium ${issue.severity === "critical" ? "text-red-700" : issue.severity === "warning" ? "text-amber-700" : "text-blue-700"}`}>
                    {issue.severity === "critical" ? "⚠" : issue.severity === "warning" ? "⚡" : "ℹ"} {issue.message}
                  </p>
                  <p className="text-slate-600 mt-1">{issue.suggestion}</p>
                </div>
              ))}
            </div>
          )}
          {preview.improvedStory && (
            <div className="p-3 rounded-lg bg-violet-50 border border-violet-100 text-xs">
              <p className="font-semibold text-violet-700 mb-2">Story améliorée :</p>
              <p className="font-medium text-slate-800">{preview.improvedStory.title}</p>
              <p className="text-slate-600 mt-1 whitespace-pre-wrap">{preview.improvedStory.description}</p>
              <div className="flex gap-2 mt-2">
                <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">{preview.improvedStory.points}pts</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{preview.improvedStory.priority}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Story Estimator ──────────────────────────────────────────────────
function StoryEstimator({ state }: { state: AppState }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [preview, setPreview] = useState<Estimation | null>(null);
  const gen = useEstimateStory();
  const selectedStory = state.stories.find((s) => s.id === selectedId);

  async function handleGenerate() {
    if (!selectedStory) return;
    const result = await gen.generate(selectedStory, state);
    if (result) setPreview(result);
  }

  return (
    <div className="space-y-4">
      {state.stories.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4">Aucune story disponible.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">Obtenez une estimation IA avec justification pour une story.</p>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
            <option value="">Sélectionnez une story...</option>
            {state.stories.map((s) => (
              <option key={s.id} value={s.id}>{s.title} — {s.points}pts</option>
            ))}
          </select>
          <Button variant="primary" onClick={handleGenerate} disabled={gen.loading || !selectedStory} icon={gen.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}>
            {gen.loading ? "Analyse en cours..." : "Estimer cette story"}
          </Button>
        </>
      )}
      {gen.error && <p className="text-sm text-red-600">{gen.error}</p>}
      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-900 text-sm">Estimation</h3>
            <span className="px-3 py-1 rounded-full text-sm font-bold bg-violet-100 text-violet-700">
              {preview.recommendedPoints}pts
            </span>
            <span className="text-xs text-slate-500">(min {preview.minPoints} — max {preview.maxPoints})</span>
          </div>
          <p className="text-xs text-slate-600 whitespace-pre-wrap">{preview.reasoning}</p>
          {preview.factors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {preview.factors.map((f, i) => (
                <span key={i} className={`px-2 py-1 rounded text-xs ${f.impact === "high" ? "bg-red-100 text-red-700" : f.impact === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                  {f.factor}: {f.impact}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
