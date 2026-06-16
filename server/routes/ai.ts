import { Router } from "express";
import { getDb } from "../db.js";

const router = Router();

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

interface AiConfig {
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  reasoningEffort: string | null;
}

function getAiConfig(): AiConfig {
  const db = getDb();
  const row = db.prepare("SELECT value FROM ai_config WHERE key = 'api_key'").get() as { value: string } | undefined;
  const baseRow = db.prepare("SELECT value FROM ai_config WHERE key = 'api_base_url'").get() as { value: string } | undefined;
  const modelRow = db.prepare("SELECT value FROM ai_config WHERE key = 'model'").get() as { value: string } | undefined;
  const reasonRow = db.prepare("SELECT value FROM ai_config WHERE key = 'reasoning_effort'").get() as { value: string } | undefined;
  return {
    apiKey: row?.value || "",
    apiBaseUrl: baseRow?.value || DEFAULT_BASE_URL,
    model: modelRow?.value || "",
    reasoningEffort: reasonRow?.value || null,
  };
}

function saveAiConfig(config: Partial<AiConfig>): void {
  const db = getDb();
  const upsert = db.prepare("INSERT OR REPLACE INTO ai_config (key, value) VALUES (?, ?)");
  if (config.apiKey !== undefined) upsert.run("api_key", config.apiKey);
  if (config.apiBaseUrl !== undefined) upsert.run("api_base_url", config.apiBaseUrl);
  if (config.model !== undefined) upsert.run("model", config.model);
  if (config.reasoningEffort !== undefined) upsert.run("reasoning_effort", config.reasoningEffort || "");
}

// GET /api/ai/config — never expose the real API key
router.get("/config", (_req, res) => {
  const config = getAiConfig();
  res.json({
    hasKey: !!config.apiKey,
    apiBaseUrl: config.apiBaseUrl,
    model: config.model,
    reasoningEffort: config.reasoningEffort,
  });
});

// PUT /api/ai/config
router.put("/config", (req, res) => {
  const { apiKey, apiBaseUrl, model, reasoningEffort } = req.body;
  if (apiKey !== undefined) {
    if (typeof apiKey !== "string" || apiKey.length < 4) {
      return res.status(400).json({ error: "Clé API invalide (minimum 4 caractères)" });
    }
    saveAiConfig({ apiKey });
  }
  if (apiBaseUrl !== undefined) {
    if (typeof apiBaseUrl !== "string" || !apiBaseUrl.startsWith("http")) {
      return res.status(400).json({ error: "URL invalide" });
    }
    // Normalize: remove trailing slash
    saveAiConfig({ apiBaseUrl: apiBaseUrl.replace(/\/+$/, "") });
  }
  if (model !== undefined) {
    if (typeof model !== "string") {
      return res.status(400).json({ error: "Modèle invalide" });
    }
    saveAiConfig({ model });
  }
  if (reasoningEffort !== undefined) {
    if (reasoningEffort !== null && reasoningEffort !== "" && !["low", "medium", "high"].includes(reasoningEffort)) {
      return res.status(400).json({ error: "Niveau de réflexion invalide (low, medium, high, ou null)" });
    }
    saveAiConfig({ reasoningEffort: reasoningEffort || null });
  }
  res.json({ ok: true });
});

// GET /api/ai/models — list available models from the provider
router.get("/models", async (_req, res) => {
  const config = getAiConfig();
  if (!config.apiBaseUrl) {
    return res.status(400).json({ error: "URL du serveur IA non configurée" });
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(`${config.apiBaseUrl}/models`, { method: "GET", headers });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err?.error?.message || err?.message || `Erreur ${response.status}`;
      return res.status(502).json({ error: msg });
    }

    const data = await response.json() as any;

    // OpenAI format: { data: [{ id: "model-name", ... }] }
    // Some providers return { models: [...] } or a plain array
    let models: { id: string; name?: string }[] = [];

    if (Array.isArray(data)) {
      models = data.map((m: any) => ({ id: m.id || m.name || m, name: m.name || m.id || m }));
    } else if (Array.isArray(data?.data)) {
      models = data.data.map((m: any) => ({ id: m.id, name: m.name || m.id }));
    } else if (Array.isArray(data?.models)) {
      models = data.models.map((m: any) => ({ id: m.id || m.name || m, name: m.name || m.id || m }));
    }

    // Sort alphabetically
    models.sort((a, b) => a.id.localeCompare(b.id));

    res.json({ models });
  } catch (err: any) {
    console.error("AI models fetch error:", err);
    res.status(500).json({ error: err.message || "Erreur de connexion au serveur IA" });
  }
});

// POST /api/ai/generate
router.post("/generate", async (req, res) => {
  const { messages, model: reqModel } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages requis" });
  }

  const config = getAiConfig();
  if (!config.apiBaseUrl) {
    return res.status(400).json({ error: "URL du serveur IA non configurée" });
  }

  const model = reqModel || config.model;
  if (!model) {
    return res.status(400).json({ error: "Aucun modèle sélectionné" });
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(`${config.apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        ...(config.reasoningEffort ? { reasoning: { effort: config.reasoningEffort } } : {}),
        messages: [
          {
            role: "system",
            content: `Tu es un assistant Scrum expert. Tu génères des données de projet Scrum au format JSON.
Réponds TOUJOURS avec un objet JSON valide, sans texte avant ou après.
Ne utilise pas de blocs de code markdown (pas de \`\`\`json).
Les champs requis sont stricts : n'ajoute pas de champs supplémentaires.
Utilise des IDs au format "ai-{type}-{timestamp}-{index}" (ex: ai-story-1718000000-0).`,
          },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err?.error?.message || `Erreur ${response.status}`;
      return res.status(502).json({ error: msg });
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(502).json({ error: "Réponse IA vide" });
    }

    res.json({ content, model });
  } catch (err: any) {
    console.error("AI generation error:", err);
    res.status(500).json({ error: err.message || "Erreur interne" });
  }
});

export default router;
