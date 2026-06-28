import React, { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "../lib/apiClient";
import NavBar from "../components/NavBar";
import EntryFormDialog from "../components/EntryFormDialog";
import { Plus, Pencil, Trash2, Loader2, UserPlus, GraduationCap } from "lucide-react";
import { toast } from "sonner";

export default function MyEntries() {
  const [classes, setClasses] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null); // null | {} | entry

  const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));

  const load = async () => {
    setLoading(true);
    try {
      const [cRes, eRes] = await Promise.all([api.get("/classes"), api.get("/entries/mine")]);
      setClasses(cRes.data);
      setEntries(eRes.data);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!window.confirm("Supprimer cette inscription ?")) return;
    try {
      await api.delete(`/entries/${id}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("Inscription supprimée");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-amber-50">
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="flex items-center justify-between gap-4 mb-8 animate-fade-up">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-800">Mes inscriptions</h1>
            <p className="text-base font-medium text-slate-500 mt-2">Inscrivez vos enfants dans leur classe.</p>
          </div>
          <button
            data-testid="add-entry-button"
            onClick={() => {
              if (classes.length === 0) { toast.error("Aucune classe disponible pour le moment."); return; }
              setDialog({});
            }}
            className="bg-primary text-white font-bold rounded-full px-5 py-3 hover:bg-sky-600 transition-colors shadow-sm active:scale-95 flex items-center gap-2 shrink-0"
          >
            <Plus className="w-5 h-5" /> <span className="hidden sm:inline">Inscrire un enfant</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
            <UserPlus className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">Vous n'avez encore inscrit aucun enfant.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((e) => {
              const cls = classMap[e.class_id];
              return (
                <div key={e.id} data-testid={`my-entry-${e.id}`} className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm flex items-center justify-between gap-4 animate-fade-up">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-800 text-lg">{e.child_name}</p>
                      <p className="text-sm font-semibold text-slate-500">
                        {cls ? `Groupe ${cls.group_number} — ${cls.teachers}` : "Classe supprimée"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button data-testid={`edit-my-entry-${e.id}`} onClick={() => setDialog(e)} className="w-9 h-9 rounded-full text-slate-400 hover:bg-slate-100 hover:text-primary flex items-center justify-center">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button data-testid={`delete-my-entry-${e.id}`} onClick={() => remove(e.id)} className="w-9 h-9 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {dialog && (
        <EntryFormDialog classes={classes} initial={dialog.id ? dialog : null} onClose={() => setDialog(null)} onSaved={load} />
      )}
    </div>
  );
}
