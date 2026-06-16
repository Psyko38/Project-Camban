import { useState, useEffect } from "react";
import { authApi, setToken } from "../api/client";
import { Kanban, Lock, Eye, EyeOff } from "./ui/icons";
import { Button } from "./ui/Button";

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSetup, setIsSetup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    authApi.check().then(({ hasPassword }) => {
      setIsSetup(!hasPassword);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSetup) {
        const { token } = await authApi.setup(password);
        setToken(token);
      } else {
        const { token } = await authApi.login(password);
        setToken(token);
      }
      onLogin();
    } catch (err: any) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  if (loading && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="animate-pulse text-slate-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Kanban className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">ScrumFlow</h1>
          <p className="text-slate-500 mt-1">
            {isSetup ? "Configurez votre mot de passe" : "Connectez-vous pour continuer"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <Lock className="h-4 w-4 inline mr-1.5" />
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                placeholder={isSetup ? "Choisissez un mot de passe" : "Entrez votre mot de passe"}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading || !password}>
            {loading ? "Chargement..." : isSetup ? "Créer le mot de passe" : "Se connecter"}
          </Button>
        </form>
      </div>
    </div>
  );
}
