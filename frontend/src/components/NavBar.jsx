import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, formatApiErrorDetail } from "../lib/apiClient";
import { BookOpen, LogOut, KeyRound, Users2, Settings, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export default function NavBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);

  const navItem = (to, label, testid) => {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        data-testid={testid}
        className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
          active ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-white/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-2xl bg-primary text-white flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="font-black text-lg text-slate-800 hidden sm:block">Bottin scolaire</span>
          </Link>

          <nav className="flex items-center gap-1.5">
            {navItem("/", "Bottin", "nav-bottin")}
            {navItem("/mes-inscriptions", "Mes inscriptions", "nav-mes-inscriptions")}
            {user?.role === "admin" && (
              <Link
                to="/admin"
                data-testid="nav-admin"
                className={`px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-1.5 ${
                  location.pathname === "/admin" ? "bg-secondary text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Settings className="w-4 h-4" /> Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              data-testid="open-change-password"
              onClick={() => setShowPwd(true)}
              title="Changer mon mot de passe"
              className="w-9 h-9 rounded-full text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <KeyRound className="w-4.5 h-4.5" />
            </button>
            <button
              data-testid="logout-button"
              onClick={() => { logout(); navigate("/login"); }}
              title="Se déconnecter"
              className="w-9 h-9 rounded-full text-slate-500 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>
      {showPwd && <ChangePasswordDialog onClose={() => setShowPwd(false)} />}
    </>
  );
}

function ChangePasswordDialog({ onClose }) {
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await api.post("/auth/change-password", { new_password: pwd });
      toast.success("Mot de passe mis à jour");
      onClose();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl p-7 w-full max-w-sm shadow-2xl animate-fade-up" data-testid="change-password-dialog">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xl font-bold text-slate-800">Changer le mot de passe</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-500 font-medium mb-4">C'est optionnel, mais recommandé.</p>
        <input
          data-testid="new-password-input"
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Nouveau mot de passe"
          className="w-full bg-white border-2 border-slate-200 rounded-full px-5 py-3 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 font-medium"
        />
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-600 font-bold rounded-full py-2.5 hover:bg-slate-200 transition-colors">Annuler</button>
          <button data-testid="save-password-button" onClick={save} disabled={loading || pwd.length < 4} className="flex-1 bg-primary text-white font-bold rounded-full py-2.5 hover:bg-sky-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
