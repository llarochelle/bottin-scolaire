import React, { useState } from "react";
import { api, formatApiErrorDetail } from "../lib/apiClient";
import { X, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

const emptyParent = { name: "", phone: "", email: "" };

export default function EntryFormDialog({ classes, initial, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [classId, setClassId] = useState(initial?.class_id || (classes[0]?.id || ""));
  const [childName, setChildName] = useState(initial?.child_name || "");
  const [p1, setP1] = useState(initial?.parent1 || { ...emptyParent });
  const [hasP2, setHasP2] = useState(!!initial?.parent2);
  const [p2, setP2] = useState(initial?.parent2 || { ...emptyParent });
  const [callFirst, setCallFirst] = useState(initial?.call_first || "parent1");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!classId) { toast.error("Veuillez choisir une classe"); return; }
    if (!childName.trim()) { toast.error("Le nom de l'enfant est requis"); return; }
    setLoading(true);
    const payload = {
      class_id: classId,
      child_name: childName,
      parent1: p1,
      parent2: hasP2 ? p2 : null,
      call_first: hasP2 ? callFirst : "parent1",
    };
    try {
      if (isEdit) await api.put(`/entries/${initial.id}`, payload);
      else await api.post("/entries", payload);
      toast.success(isEdit ? "Inscription modifiée" : "Enfant inscrit au bottin");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const field = (label, value, setter, type = "text", testid) => (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</label>
      <input
        data-testid={testid}
        type={type}
        value={value}
        onChange={(e) => setter(e.target.value)}
        className="w-full mt-1.5 bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 font-medium"
      />
    </div>
  );

  const parentBlock = (which, p, setP) => (
    <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-700">{which === "parent1" ? "Parent 1" : "Parent 2"}</span>
        {hasP2 && (
          <button
            type="button"
            data-testid={`call-first-${which}`}
            onClick={() => setCallFirst(which)}
            className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 transition-colors ${
              callFirst === which ? "bg-amber-400 text-white" : "bg-white text-slate-500 border border-slate-200"
            }`}
          >
            <Star className={`w-3 h-3 ${callFirst === which ? "fill-white" : ""}`} /> Appeler en premier
          </button>
        )}
      </div>
      {field("Nom complet", p.name, (v) => setP({ ...p, name: v }), "text", `${which}-name`)}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("Téléphone", p.phone, (v) => setP({ ...p, phone: v }), "tel", `${which}-phone`)}
        {field("Courriel", p.email, (v) => setP({ ...p, email: v }), "email", `${which}-email`)}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl animate-fade-up my-auto" data-testid="entry-form-dialog">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-2xl font-bold text-slate-800">{isEdit ? "Modifier l'inscription" : "Inscrire un enfant"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Classe / Groupe</label>
            <select
              data-testid="entry-class-select"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full mt-1.5 bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary font-medium"
            >
              <option value="">— Choisir une classe —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>Groupe {c.group_number} — {c.teachers}</option>
              ))}
            </select>
          </div>
          {field("Nom de l'enfant", childName, setChildName, "text", "entry-child-name")}

          {parentBlock("parent1", p1, setP1)}

          {hasP2 ? (
            <div>
              {parentBlock("parent2", p2, setP2)}
              <button type="button" onClick={() => { setHasP2(false); setCallFirst("parent1"); }} className="text-sm font-bold text-red-500 mt-2">Retirer le parent 2</button>
            </div>
          ) : (
            <button type="button" data-testid="add-parent2-button" onClick={() => setHasP2(true)} className="text-sm font-bold text-primary">+ Ajouter un deuxième parent</button>
          )}
        </div>

        <div className="flex gap-3 mt-7">
          <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-600 font-bold rounded-full py-3 hover:bg-slate-200 transition-colors">Annuler</button>
          <button data-testid="save-entry-button" onClick={save} disabled={loading} className="flex-1 bg-primary text-white font-bold rounded-full py-3 hover:bg-sky-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
