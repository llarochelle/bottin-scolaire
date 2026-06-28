import React, { useEffect, useState } from "react";
import { api, API, formatApiErrorDetail } from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";
import NavBar from "../components/NavBar";
import {
  GraduationCap, Mail, Users2, Image as ImageIcon, FileSpreadsheet,
  Plus, Pencil, Trash2, Loader2, Upload, ShieldCheck, ShieldOff, X, Download, Trash,
} from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { id: "classes", label: "Classes", icon: GraduationCap },
  { id: "emails", label: "Courriels autorisés", icon: Mail },
  { id: "users", label: "Utilisateurs", icon: Users2 },
  { id: "cover", label: "Couverture", icon: ImageIcon },
  { id: "export", label: "Export Excel", icon: FileSpreadsheet },
];

export default function Admin() {
  const [tab, setTab] = useState("classes");
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-800 animate-fade-up">Administration</h1>
        <p className="text-sm sm:text-base font-medium text-slate-500 mt-2 mb-8">Gérez le bottin scolaire pour cette année.</p>

        <div className="flex gap-2 flex-wrap mb-8">
          {TABS.map((t) => (
            <button
              key={t.id}
              data-testid={`admin-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-colors ${
                tab === t.id ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "classes" && <ClassesTab />}
        {tab === "emails" && <EmailsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "cover" && <CoverTab />}
        {tab === "export" && <ExportTab />}
      </main>
    </div>
  );
}

function Panel({ children }) {
  return <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm animate-fade-up">{children}</div>;
}

// ---------------- Classes ----------------
function ClassesTab() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null); // {} new | class edit

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/classes");
    setClasses(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!window.confirm("Supprimer cette classe et toutes ses inscriptions ?")) return;
    try {
      await api.delete(`/classes/${id}`);
      toast.success("Classe supprimée");
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  return (
    <Panel>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Classes</h2>
        <button data-testid="add-class-button" onClick={() => setEdit({})} className="bg-primary text-white font-bold rounded-full px-4 py-2.5 hover:bg-sky-600 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>
      {loading ? <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /> : classes.length === 0 ? (
        <p className="text-slate-400 font-medium">Aucune classe. Cliquez sur « Ajouter ».</p>
      ) : (
        <div className="space-y-3">
          {classes.map((c) => (
            <div key={c.id} data-testid={`admin-class-${c.id}`} className="flex items-center justify-between bg-slate-50 rounded-2xl px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center"><GraduationCap className="w-5 h-5" /></div>
                <div>
                  <p className="font-bold text-slate-800">Groupe {c.group_number}</p>
                  <p className="text-sm text-slate-500 font-medium">{c.teachers}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button data-testid={`edit-class-${c.id}`} onClick={() => setEdit(c)} className="w-9 h-9 rounded-full text-slate-400 hover:bg-white hover:text-primary flex items-center justify-center"><Pencil className="w-4 h-4" /></button>
                <button data-testid={`delete-class-${c.id}`} onClick={() => remove(c.id)} className="w-9 h-9 rounded-full text-slate-400 hover:bg-white hover:text-red-500 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && <ClassDialog initial={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={load} />}
    </Panel>
  );
}

function ClassDialog({ initial, onClose, onSaved }) {
  const [group, setGroup] = useState(initial?.group_number || "");
  const [teachers, setTeachers] = useState(initial?.teachers || "");
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (!group.trim()) { toast.error("Le numéro de groupe est requis"); return; }
    setLoading(true);
    try {
      const payload = { group_number: group, teachers };
      if (initial?.id) await api.put(`/classes/${initial.id}`, payload);
      else await api.post("/classes", payload);
      toast.success("Classe enregistrée");
      onSaved(); onClose();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl p-7 w-full max-w-md shadow-2xl animate-fade-up" data-testid="class-dialog">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-slate-800">{initial ? "Modifier la classe" : "Nouvelle classe"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500"># de groupe</label>
        <input data-testid="class-group-input" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Ex : 101" className="w-full mt-1.5 mb-4 bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary font-medium" />
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Enseignant(e)s</label>
        <input data-testid="class-teachers-input" value={teachers} onChange={(e) => setTeachers(e.target.value)} placeholder="Ex : Mme Tremblay et M. Roy" className="w-full mt-1.5 bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary font-medium" />
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-600 font-bold rounded-full py-2.5 hover:bg-slate-200">Annuler</button>
          <button data-testid="save-class-button" onClick={save} disabled={loading} className="flex-1 bg-primary text-white font-bold rounded-full py-2.5 hover:bg-sky-600 disabled:opacity-50 flex items-center justify-center gap-2">{loading && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Emails ----------------
function EmailsTab() {
  const [emails, setEmails] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/admin/allowed-emails");
    setEmails(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const list = input.split(/[\s,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return;
    try {
      const { data } = await api.post("/admin/allowed-emails", { emails: list });
      toast.success(`${data.added} courriel(s) ajouté(s)`);
      setInput("");
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const importCsv = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post("/admin/allowed-emails/csv", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${data.added} ajouté(s), ${data.skipped} ignoré(s)`);
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setImporting(false); e.target.value = ""; }
  };

  const remove = async (email) => {
    await api.delete(`/admin/allowed-emails/${encodeURIComponent(email)}`);
    load();
  };

  const purge = async () => {
    if (!window.confirm("Purger TOUS les courriels autorisés ? Cette action est irréversible.")) return;
    const { data } = await api.delete("/admin/allowed-emails");
    toast.success(`${data.deleted} courriel(s) supprimé(s)`);
    load();
  };

  return (
    <Panel>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Courriels autorisés</h2>
      <p className="text-sm text-slate-500 font-medium mb-5">Seuls ces courriels peuvent se connecter. Mot de passe par défaut = le courriel.</p>

      <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 mb-5">
        <p className="text-sm font-bold text-slate-700 mb-1">Importer un fichier CSV</p>
        <p className="text-xs text-slate-500 font-medium mb-3">Deux colonnes : <span className="font-semibold">nom complet</span>, <span className="font-semibold">courriel</span>. Séparateur virgule ou point-virgule. Une ligne d'en-tête est ignorée automatiquement.</p>
        <label className="inline-flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-full px-5 py-2.5 cursor-pointer hover:border-primary transition-colors">
          <input data-testid="emails-csv-input" type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Choisir un fichier CSV
        </label>
      </div>

      <textarea
        data-testid="emails-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={3}
        placeholder="Collez des courriels séparés par des virgules, espaces ou retours de ligne…"
        className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-primary font-medium"
      />
      <div className="flex gap-2 mt-3 mb-6">
        <button data-testid="add-emails-button" onClick={add} className="bg-primary text-white font-bold rounded-full px-5 py-2.5 hover:bg-sky-600 flex items-center gap-2"><Plus className="w-4 h-4" /> Ajouter</button>
        <button data-testid="purge-emails-button" onClick={purge} className="bg-red-50 text-red-600 font-bold rounded-full px-5 py-2.5 hover:bg-red-100 flex items-center gap-2"><Trash className="w-4 h-4" /> Tout purger</button>
      </div>

      {loading ? <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /> : emails.length === 0 ? (
        <p className="text-slate-400 font-medium">Aucun courriel autorisé.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {emails.map((e) => (
            <span key={e.id} data-testid={`email-chip-${e.email}`} className="inline-flex items-center gap-2 bg-slate-100 rounded-full pl-4 pr-2 py-1.5 text-sm font-semibold text-slate-700">
              {e.name ? <span>{e.name} <span className="text-slate-400 font-medium">· {e.email}</span></span> : e.email}
              <button onClick={() => remove(e.email)} className="w-5 h-5 rounded-full hover:bg-red-100 hover:text-red-500 flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
            </span>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ---------------- Users ----------------
function UsersTab() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/admin/users");
    setUsers(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setRole = async (id, role) => {
    try {
      await api.put(`/admin/users/${id}/role`, { role });
      toast.success("Rôle mis à jour");
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const removeUser = async (id, email) => {
    if (!window.confirm(`Retirer l'utilisateur ${email} ? Son compte sera supprimé (il pourra se reconnecter si son courriel reste autorisé).`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success("Utilisateur retiré");
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const purge = async () => {
    if (!window.confirm("Purger TOUS les utilisateurs (sauf vous et l'administrateur principal) ? Cette action est irréversible.")) return;
    try {
      const { data } = await api.delete("/admin/users");
      toast.success(`${data.deleted} utilisateur(s) supprimé(s)`);
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  return (
    <Panel>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-bold text-slate-800">Utilisateurs</h2>
        <button data-testid="purge-users-button" onClick={purge} className="bg-red-50 text-red-600 font-bold rounded-full px-4 py-2.5 hover:bg-red-100 flex items-center gap-2">
          <Trash className="w-4 h-4" /> Tout purger
        </button>
      </div>
      {loading ? <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /> : (
        <div className="space-y-3">
          {users.map((u) => {
            const isMainAdmin = u.email === "admin@bottin.ca";
            const isSelf = me?.id === u.id;
            return (
              <div key={u.id} data-testid={`user-row-${u.email}`} className="flex items-center justify-between bg-slate-50 rounded-2xl px-5 py-4 gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{u.email}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>
                    {u.role === "admin" ? "Administrateur" : "Parent"}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {u.role === "admin" ? (
                    <button data-testid={`demote-${u.email}`} onClick={() => setRole(u.id, "parent")} className="bg-white border border-slate-200 text-slate-600 font-bold rounded-full px-4 py-2 hover:bg-slate-100 flex items-center gap-2">
                      <ShieldOff className="w-4 h-4" /> <span className="hidden sm:inline">Rétrograder</span>
                    </button>
                  ) : (
                    <button data-testid={`promote-${u.email}`} onClick={() => setRole(u.id, "admin")} className="bg-amber-400 text-white font-bold rounded-full px-4 py-2 hover:bg-amber-500 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> <span className="hidden sm:inline">Promouvoir</span>
                    </button>
                  )}
                  {!isMainAdmin && !isSelf && (
                    <button data-testid={`delete-user-${u.email}`} onClick={() => removeUser(u.id, u.email)} title="Retirer l'utilisateur" className="w-9 h-9 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ---------------- Cover ----------------
function CoverTab() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(Date.now());

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post("/admin/cover", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Image de couverture mise à jour !");
      setVersion(Date.now());
      setFile(null);
      setPreview(null);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <Panel>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Image de couverture</h2>
      <p className="text-sm text-slate-500 font-medium mb-6">Le dessin des enfants utilisé comme arrière-plan du bottin. Vous pouvez le changer chaque année.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Couverture actuelle</p>
          <img
            key={version}
            src={`${API}/cover?v=${version}`}
            alt="Couverture actuelle"
            onError={(e) => { e.target.style.display = "none"; }}
            className="w-full rounded-2xl border border-slate-200 object-cover aspect-video bg-slate-100"
          />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nouvelle image</p>
          <label className="block border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center cursor-pointer hover:border-primary transition-colors">
            <input data-testid="cover-file-input" type="file" accept="image/*" onChange={onPick} className="hidden" />
            {preview ? (
              <img src={preview} alt="Aperçu" className="w-full rounded-xl object-cover aspect-video" />
            ) : (
              <div className="py-6 text-slate-400">
                <Upload className="w-8 h-8 mx-auto mb-2" />
                <span className="font-semibold text-sm">Cliquez pour choisir une image</span>
              </div>
            )}
          </label>
          <button data-testid="upload-cover-button" onClick={upload} disabled={!file || loading} className="w-full mt-3 bg-primary text-white font-bold rounded-full py-3 hover:bg-sky-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Téléverser
          </button>
        </div>
      </div>
    </Panel>
  );
}

// ---------------- Export ----------------
function ExportTab() {
  const [loading, setLoading] = useState(false);
  const download = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bottin_scolaire.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export téléchargé");
    } catch (err) { toast.error("Échec de l'export"); }
    finally { setLoading(false); }
  };
  return (
    <Panel>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Export Excel</h2>
      <p className="text-sm text-slate-500 font-medium mb-6">Téléchargez toutes les données du bottin (organisées par classe) au format Excel, pour reproduire le bottin papier.</p>
      <button data-testid="export-excel-button" onClick={download} disabled={loading} className="bg-green-500 text-white font-bold rounded-full px-6 py-3.5 hover:bg-green-600 disabled:opacity-50 flex items-center gap-2">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} Télécharger le fichier Excel
      </button>
    </Panel>
  );
}
