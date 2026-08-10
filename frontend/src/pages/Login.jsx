import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatApiErrorDetail } from "../lib/apiClient";
import { BookOpen, Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const getSchoolYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startYear = month >= 9 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
  };

  const schoolYear = getSchoolYear();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-sky-100 via-white to-amber-50">
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <img
            src="/children-school.svg"
            alt="Enfants courant vers l'école"
            className="mx-auto mb-6 w-full max-w-md rounded-3xl shadow-2xl"
          />
          <h1 className="text-4xl font-black tracking-tight text-slate-800">L'Envol</h1>
          <p className="text-base font-medium text-slate-500 mt-2">
            Connectez-vous pour accéder au bottin de l'école L'Envol
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Année scolaire {schoolYear}
          </p>
        </div>

        <form
          onSubmit={submit}
          data-testid="login-form"
          className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-[0_20px_40px_rgb(0,0,0,0.08)]"
        >
          <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Courriel</label>
          <input
            data-testid="login-email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="parent@exemple.ca"
            required
            className="w-full mt-2 mb-5 bg-white border-2 border-slate-200 rounded-full px-5 py-3 text-slate-800 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all font-medium"
          />
          <label className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Mot de passe</label>
          <input
            data-testid="login-password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Votre courriel par défaut"
            required
            className="w-full mt-2 bg-white border-2 border-slate-200 rounded-full px-5 py-3 text-slate-800 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all font-medium"
          />
          <p className="text-xs text-slate-400 mt-2 ml-1 font-medium">
            Astuce : par défaut, votre mot de passe est votre courriel.
          </p>

          {error && (
            <div data-testid="login-error" className="mt-4 text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            data-testid="login-submit-button"
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-primary text-white font-bold rounded-full px-6 py-3.5 hover:bg-sky-600 transition-colors shadow-sm active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}
