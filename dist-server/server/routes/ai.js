import { Router } from "express";
import { getDb } from "../db.js";
const router = Router();
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const REQUEST_TIMEOUT_MS = 60000;
function getAiConfig() {
    const db = getDb();
    const row = db.prepare("SELECT value FROM ai_config WHERE key = 'api_key'").get();
    const baseRow = db.prepare("SELECT value FROM ai_config WHERE key = 'api_base_url'").get();
    const modelRow = db.prepare("SELECT value FROM ai_config WHERE key = 'model'").get();
    const reasonRow = db.prepare("SELECT value FROM ai_config WHERE key = 'reasoning_effort'").get();
    return {
        apiKey: row?.value || "",
        apiBaseUrl: baseRow?.value || DEFAULT_BASE_URL,
        model: modelRow?.value || "",
        reasoningEffort: reasonRow?.value || null,
    };
}
function saveAiConfig(config) {
    const db = getDb();
    const upsert = db.prepare("INSERT OR REPLACE INTO ai_config (key, value) VALUES (?, ?)");
    if (config.apiKey !== undefined)
        upsert.run("api_key", config.apiKey);
    if (config.apiBaseUrl !== undefined)
        upsert.run("api_base_url", config.apiBaseUrl);
    if (config.model !== undefined)
        upsert.run("model", config.model);
    if (config.reasoningEffort !== undefined)
        upsert.run("reasoning_effort", config.reasoningEffort || "");
}
function detectProvider(baseUrl) {
    const url = baseUrl.toLowerCase();
    if (url.includes("api.openai.com"))
        return "openai";
    if (url.includes("api.groq.com"))
        return "groq";
    if (url.includes("api.deepseek.com"))
        return "deepseek";
    if (url.includes("api.x.ai"))
        return "xai";
    if (url.includes("openrouter.ai"))
        return "openrouter";
    if (url.includes("api.anthropic.com"))
        return "anthropic";
    if (url.includes("localhost:11434"))
        return "ollama";
    if (url.includes("localhost:1234"))
        return "lmstudio";
    if (url.includes("api.together.xyz"))
        return "together";
    return "unknown";
}
function isReasoningModel(model) {
    const m = model.toLowerCase().replace(/^[^/]+\//, "");
    return /\bo[134]\b/.test(m)
        || /\bgpt-5\b/.test(m)
        || /\bgpt-oss\b/.test(m)
        || /\bdeepseek\b/.test(m)
        || /\bgrok\b/.test(m)
        || /\bclaude\b/.test(m);
}
function buildReasoningBody(provider, model, effort, baseBody) {
    if (!effort || !isReasoningModel(model))
        return baseBody;
    switch (provider) {
        case "openai":
            return { ...baseBody, reasoning: { effort } };
        case "groq": {
            const isQwen = /qwen/i.test(model);
            const groqEffort = isQwen
                ? (effort === "off" ? "none" : "default")
                : effort;
            return { ...baseBody, reasoning_effort: groqEffort };
        }
        case "deepseek": {
            const dsEffort = effort === "high" || effort === "max" ? effort : "high";
            return { ...baseBody, reasoning_effort: dsEffort, thinking: { type: "enabled" } };
        }
        case "xai":
            return { ...baseBody, reasoning_effort: effort };
        case "openrouter":
            return { ...baseBody, reasoning_effort: effort };
        case "anthropic":
            return { ...baseBody, thinking: { type: "adaptive", effort } };
        case "ollama":
        case "lmstudio":
        case "together":
        default:
            return baseBody;
    }
}
// ── Fetch with timeout ─────────────────────────────────────────────────
async function fetchWithTimeout(url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    }
    finally {
        clearTimeout(timer);
    }
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
router.put("/config", async (req, res) => {
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
        saveAiConfig({ apiBaseUrl: apiBaseUrl.replace(/\/+$/, "") });
    }
    if (model !== undefined) {
        if (typeof model !== "string") {
            return res.status(400).json({ error: "Modèle invalide" });
        }
        saveAiConfig({ model });
    }
    if (reasoningEffort !== undefined) {
        const validEfforts = ["none", "low", "medium", "high", "max", "xhigh"];
        if (reasoningEffort !== null && reasoningEffort !== "" && !validEfforts.includes(reasoningEffort)) {
            return res.status(400).json({ error: `Niveau de réflexion invalide (${validEfforts.join(", ")}, ou null)` });
        }
        saveAiConfig({ reasoningEffort: reasoningEffort || null });
    }
    // Validate API key by testing a models fetch
    const config = getAiConfig();
    if (config.apiKey && config.apiBaseUrl) {
        try {
            const headers = { "Content-Type": "application/json" };
            headers["Authorization"] = `Bearer ${config.apiKey}`;
            const testResp = await fetchWithTimeout(`${config.apiBaseUrl}/models`, { method: "GET", headers }, 10000);
            if (!testResp.ok) {
                const err = await testResp.json().catch(() => ({}));
                const msg = err?.error?.message || `Erreur ${testResp.status}`;
                return res.status(400).json({ error: `Clé API invalide : ${msg}` });
            }
        }
        catch {
            // Timeout or network error — don't block save, just warn
        }
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
        const headers = { "Content-Type": "application/json" };
        if (config.apiKey) {
            headers["Authorization"] = `Bearer ${config.apiKey}`;
        }
        const response = await fetchWithTimeout(`${config.apiBaseUrl}/models`, { method: "GET", headers });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const msg = err?.error?.message || err?.message || `Erreur ${response.status}`;
            return res.status(502).json({ error: msg });
        }
        const data = await response.json();
        let models = [];
        if (Array.isArray(data)) {
            models = data.map((m) => ({ id: m.id || m.name || m, name: m.name || m.id || m }));
        }
        else if (Array.isArray(data?.data)) {
            models = data.data.map((m) => ({ id: m.id, name: m.name || m.id }));
        }
        else if (Array.isArray(data?.models)) {
            models = data.models.map((m) => ({ id: m.id || m.name || m, name: m.name || m.id || m }));
        }
        models.sort((a, b) => a.id.localeCompare(b.id));
        res.json({ models });
    }
    catch (err) {
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
    const provider = detectProvider(config.apiBaseUrl);
    const baseBody = {
        model,
        messages,
        temperature: 0.7,
        max_tokens: 4000,
    };
    const requestBody = buildReasoningBody(provider, model, config.reasoningEffort, baseBody);
    const useReasoning = requestBody !== baseBody;
    try {
        const headers = {
            "Content-Type": "application/json",
        };
        if (config.apiKey) {
            headers["Authorization"] = `Bearer ${config.apiKey}`;
        }
        let response = await fetchWithTimeout(`${config.apiBaseUrl}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
        });
        // Fallback: if reasoning is unsupported, retry without it
        if (!response.ok && useReasoning) {
            const errBody = await response.json().catch(() => ({}));
            const errMsg = errBody?.error?.message || "";
            if (errMsg.includes("reasoning") || errMsg.includes("unsupported") || errMsg.includes("thinking")) {
                console.log("Reasoning unsupported, retrying without it...");
                response = await fetchWithTimeout(`${config.apiBaseUrl}/chat/completions`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(baseBody),
                });
            }
        }
        // Retry once on transient errors (429, 500, 502, 503)
        if (!response.ok && [429, 500, 502, 503].includes(response.status)) {
            console.log(`Transient error ${response.status}, retrying once...`);
            await new Promise((r) => setTimeout(r, 1000));
            response = await fetchWithTimeout(`${config.apiBaseUrl}/chat/completions`, {
                method: "POST",
                headers,
                body: JSON.stringify(requestBody),
            });
        }
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const msg = err?.error?.message || `Erreur ${response.status}`;
            return res.status(502).json({ error: msg });
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            return res.status(502).json({ error: "Réponse IA vide" });
        }
        res.json({ content, model });
    }
    catch (err) {
        console.error("AI generation error:", err);
        if (err.name === "AbortError") {
            return res.status(504).json({ error: "Délai d'attente dépassé (60s)" });
        }
        res.status(500).json({ error: err.message || "Erreur interne" });
    }
});
export default router;
