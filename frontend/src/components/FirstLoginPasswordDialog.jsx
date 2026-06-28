import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, formatApiErrorDetail } from "../lib/apiClient";
import { KeyRound, Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";

export default function FirstLoginPasswordDialog() {
  const { user, refreshUser } = useAuth();
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const show =
    user && user.role === "parent" && user.password_changed === false && user.pw_prompted === false;

  if (!show) return null;

  const save = async () => {
    setLoading(true);
    try {
      await api.post("/auth/change-password", { new_password: pwd });
      toast.success("Mot de passe mis à jour");
      await refreshUser();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
      setLoading(false);
    }
  };

  const later = async () => {
    setLoading(true);
    try {
      await api.post("/auth/dismiss-password-prompt");
      await refreshUser();
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl p-7 sm:p-8 w-full max-w-md shadow-2xl animate-fade-up" data-testid="first-login-password-dialog">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
          <PartyPopper className="w-7 h-7" />
        </div>
        <h3 className="text-2xl font-black text-slate-800">Bienvenue{user.name ? `, ${user.name}` : ""} !</h3>
        <p className="text-sm text-slate-500 font-medium mt-2">
          Pour le moment, votre mot de passe est votre courriel. Vous pouvez le personnaliser
          maintenant (optionnel) ou le faire plus tard via l'icône <KeyRound className="inline w-4 h-4 -mt-0.5" /> en haut.
        </p>

        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mt-5 mb-1.5">
          Nouveau mot de passe
        </label>
        <input
          data-testid="first-login-new-password-input"
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Choisissez un mot de passe"
          className="w-full bg-white border-2 border-slate-200 rounded-full px-5 py-3 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 font-medium"
        />

        <div className="flex gap-2 mt-6">
          <button
            data-testid="first-login-later-button"
            onClick={later}
            disabled={loading}
            className="flex-1 bg-slate-100 text-slate-600 font-bold rounded-full py-3 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Plus tard
          </button>
          <button
            data-testid="first-login-save-button"
            onClick={save}
            disabled={loading || pwd.length < 4}
            className="flex-1 bg-primary text-white font-bold rounded-full py-3 hover:bg-sky-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
