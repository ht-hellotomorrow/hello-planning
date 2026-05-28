"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Category = "ht_internal" | "ht_client" | "personal";
type Visibility = "active" | "archived" | "hidden";

type Project = {
  id: string;
  code: string | null;
  name: string;
  category: Category;
  visibility: Visibility;
};

const CATEGORY_LABEL: Record<Category, string> = {
  ht_internal: "HT Internal",
  ht_client: "HT Client",
  personal: "Personale",
};

export type CreateSegmentDraft = {
  personId: string;
  personName: string;
  startWeek: string;
  endWeek: string;
  durationWeeks: number;
};

type Props = {
  draft: CreateSegmentDraft;
  projects: Project[];
  onCancel: () => void;
  onConfirm: (projectId: string, daysPerWeek: number) => Promise<void>;
};

export function CreateSegmentModal({
  draft,
  projects,
  onCancel,
  onConfirm,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [days, setDays] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = projects.filter((p) => p.visibility === "active");
    if (!q) return visible;
    return visible.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code?.toLowerCase().includes(q) ?? false),
    );
  }, [projects, query]);

  async function submit() {
    setError(null);
    if (!selectedId) {
      setError("Scegli un progetto");
      return;
    }
    const d = Number.parseFloat(days);
    if (!Number.isFinite(d) || d <= 0 || d > 7) {
      setError("Giorni/sett tra 0 e 7");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(selectedId, d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <header className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Nuova allocazione</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {draft.personName} · {draft.startWeek} → {draft.endWeek} (
            {draft.durationWeeks} sett.)
          </p>
        </header>

        <div className="p-5 flex-1 overflow-y-auto">
          <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
            Progetto
          </label>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome o codice…"
            className="w-full px-3 py-2 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 mb-2"
          />
          <ul className="max-h-64 overflow-y-auto border border-border rounded">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground text-center">
                Nessun progetto trovato
              </li>
            ) : (
              filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b border-border last:border-b-0 ${
                      selectedId === p.id ? "bg-brand-soft" : ""
                    }`}
                  >
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground flex gap-2">
                      <span className="font-mono">{p.code ?? "—"}</span>
                      <span>·</span>
                      <span>{CATEGORY_LABEL[p.category]}</span>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>

          <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2 mt-5">
            Giorni a settimana
          </label>
          <div className="flex items-center gap-2">
            <input
              value={days}
              onChange={(e) => setDays(e.target.value)}
              type="number"
              step="0.5"
              min="0.5"
              max="7"
              className="w-24 px-3 py-2 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 tabular-nums"
            />
            <span className="text-sm text-muted-foreground">gg/sett</span>
            <div className="flex gap-1 ml-auto">
              {["0.5", "1", "2", "3", "5"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDays(v)}
                  className="px-2 py-1 text-xs rounded border border-border hover:border-brand hover:text-brand tabular-nums"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>

        <footer className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded text-sm text-muted-foreground hover:bg-muted"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !selectedId}
            className="px-4 py-2 rounded bg-brand text-brand-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "..." : "Crea"}
          </button>
        </footer>
      </div>
    </div>
  );
}
