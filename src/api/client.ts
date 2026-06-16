import type { AppStore } from "../types";

const API_BASE = "/api";

let authToken: string | null = localStorage.getItem("scrumflow-token");

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem("scrumflow-token", token);
  } else {
    localStorage.removeItem("scrumflow-token");
  }
}

export function getToken(): string | null {
  return authToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur ${res.status}`);
  }

  const text = await res.text();
  if (!text || text.trim().startsWith("<")) {
    throw new Error("Le serveur a retourné du HTML au lieu de JSON. Vérifiez que le backend est lancé.");
  }

  return JSON.parse(text);
}

// Auth API
export const authApi = {
  check: () => request<{ hasPassword: boolean }>("/auth/check"),
  setup: (password: string) => request<{ token: string }>("/auth/setup", { method: "POST", body: JSON.stringify({ password }) }),
  login: (password: string) => request<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
};

// Store API
export const storeApi = {
  load: () => request<AppStore>("/store"),
  save: (store: AppStore) => request<{ ok: boolean }>("/store", { method: "PUT", body: JSON.stringify(store) }),
};

// AI API
export interface AiConfigResponse {
  hasKey: boolean;
  apiBaseUrl: string;
  model: string;
  reasoningEffort: string | null;
}

export interface AiModel {
  id: string;
  name: string;
}

export const aiApi = {
  getConfig: () => request<AiConfigResponse>("/ai/config"),
  saveConfig: (config: { apiKey?: string; apiBaseUrl?: string; model?: string; reasoningEffort?: string | null }) =>
    request<{ ok: boolean }>("/ai/config", { method: "PUT", body: JSON.stringify(config) }),
  listModels: () => request<{ models: AiModel[] }>("/ai/models"),
  generate: (messages: { role: string; content: string }[], model?: string) =>
    request<{ content: string; model: string }>("/ai/generate", {
      method: "POST",
      body: JSON.stringify({ messages, model }),
    }),
};
