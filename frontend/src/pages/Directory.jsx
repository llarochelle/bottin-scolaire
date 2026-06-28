import React, { useEffect, useState, useMemo } from "react";
import { api, API, formatApiErrorDetail } from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";
import NavBar from "../components/NavBar";
import EntryFormDialog from "../components/EntryFormDialog";
import { Search, Phone, Mail, Star, Users, Pencil, Trash2, GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Directory() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [entries, setEntries] = useState([]);
  const [classFilter, setClassFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const coverUrl = `${API}/cover?v=${user?.id || ""}`;

  const load = async () => {
    setLoading(true);
    try {
      const [cRes, eRes] = await Promise.all([api.get("/classes"), api.get("/entries")]);
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((e) => {
      const matchClass = classFilter === "all" || e.class_id === classFilter;
      const matchSearch = !term || (e.child_name || "").toLowerCase().includes(term);
      return matchClass && matchSearch;
    });
  }, [entries, classFilter, search]);

  const visibleClasses = useMemo(() => {
    return classes.filter((c) => classFilter === "all" || c.id === classFilter);
  }, [classes, classFilter]);

  return (
    <div className="min-h-screen bottin-bg" style={{ backgroundImage: `url(${coverUrl}), linear-gradient(135deg,#e0f2fe,#fef3c7)` }}>
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="bg-white/65 backdrop-blur-xl rounded-3xl p-5 sm:p-8 border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] mb-6 sm:mb-8 animate-fade-up">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-800">Bottin des familles</h1>
          <p className="text-sm sm:text-base font-medium text-slate-600 mt-2">
            Retrouvez les coordonnées des familles, classe par classe.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mt-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                data-testid="search-child-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Chercher par nom d'enfant…"
                className="w-full bg-white border-2 border-slate-200 rounded-full pl-12 pr-5 py-3 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 font-medium"
              />
            </div>
            <select
              data-testid="class-filter-dropdown"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-white border-2 border-slate-200 rounded-full px-5 py-3 focus:outline-none focus:border-primary font-bold text-slate-700 min-w-[200px]"
            >
              <option value="all">Toutes les classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>Groupe {c.group_number} — {c.teachers}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : classes.length === 0 ? (
          <Empty text="Aucune classe n'a encore été créée par l'administrateur." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {visibleClasses.map((c) => {
              const list = filtered.filter((e) => e.class_id === c.id);
              if (search.trim() && list.length === 0) return null;
              return <ClassCard key={c.id} cls={c} entries={list} user={user} onEdit={setEditing} onDelete={remove} />;
            })}
          </div>
        )}
      </main>

      {editing && (
        <EntryFormDialog classes={classes} initial={editing} onClose={() => setEditing(null)} onSaved={load} />
      )}
    </div>
  );
}

function ClassCard({ cls, entries, user, onEdit, onDelete }) {
  return (
    <div data-testid={`class-card-${cls.id}`} className="bg-white/72 backdrop-blur-xl border border-white/50 rounded-3xl p-5 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.07)] animate-fade-up">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
          <GraduationCap className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-800">Groupe {cls.group_number}</h2>
          <p className="text-sm font-semibold text-slate-500">{cls.teachers}</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
          <Users className="w-3.5 h-3.5" /> {entries.length}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm font-medium text-slate-400 py-4">Aucun élève inscrit dans cette classe.</p>
      ) : (
        <div className="divide-y divide-slate-200/60">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} user={user} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry, user, onEdit, onDelete }) {
  const canManage = user?.role === "admin" || entry.owner_email === user?.email;
  const parents = [
    { ...entry.parent1, key: "parent1" },
    ...(entry.parent2 ? [{ ...entry.parent2, key: "parent2" }] : []),
  ];

  return (
    <div className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3" data-testid={`entry-${entry.id}`}>
      <div className="flex-1">
        <p className="font-extrabold text-slate-800 text-lg">{entry.child_name}</p>
        <div className="mt-2 space-y-2">
          {parents.map((p) => (
            <div key={p.key} className="text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-700">{p.name || "—"}</span>
                {entry.call_first === p.key && entry.parent2 && (
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Appeler en premier
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-0.5 text-slate-500 font-medium">
                {p.phone && (
                  <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                    <Phone className="w-3.5 h-3.5" /> {p.phone}
                  </a>
                )}
                {p.email && (
                  <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 hover:text-primary break-all">
                    <Mail className="w-3.5 h-3.5" /> {p.email}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {canManage && (
        <div className="flex gap-1.5 shrink-0">
          <button data-testid={`edit-entry-${entry.id}`} onClick={() => onEdit(entry)} className="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-primary flex items-center justify-center">
            <Pencil className="w-4 h-4" />
          </button>
          <button data-testid={`delete-entry-${entry.id}`} onClick={() => onDelete(entry.id)} className="w-8 h-8 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/50">
      <p className="text-slate-500 font-semibold">{text}</p>
    </div>
  );
}
