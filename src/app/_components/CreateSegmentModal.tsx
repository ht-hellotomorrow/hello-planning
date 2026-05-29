"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isoDate, parseISO, toMonday, weeksBetween } from "@/lib/weeks";

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
};

export type CreateSegmentConfirmInput = {
  projectId: string;
  daysPerWeek: number;
  startWeek: string;
  endWeek: string;
};

type Props = {
  draft: CreateSegmentDraft;
  projects: Project[];
  onCancel: () => void;
  onConfirm: (input: CreateSegmentConfirmInput) => Promise<void>;
};

function snapToMondayISO(yyyymmdd: string): string {
  if (!yyyymmdd) return "";
  try {
    return isoDate(toMonday(parseISO(yyyymmdd)));
  } catch {
    return yyyymmdd;
  }
}

export function CreateSegmentModal({
  draft,
  projects,
  onCancel,
  onConfirm,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [days, setDays] = useState("1");
  const [startWeek, setStartWeek] = useState(draft.startWeek);
  const [endWeek, setEndWeek] = useState(draft.endWeek);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const durationWeeks = useMemo(() => {
    if (!startWeek || !endWeek) return 0;
    return weeksBetween(parseISO(startWeek), parseISO(endWeek)) + 1;
  }, [startWeek, endWeek]);

  const datesValid = !!startWeek && !!endWeek && endWeek >= startWeek;

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

  function onStartInput(value: string) {
    const monday = snapToMondayISO(value);
    setStartWeek(monday);
    // Auto-aggiusta fine se ora viene prima dell'inizio
    if (monday && endWeek && monday > endWeek) setEndWeek(monday);
  }
  function onEndInput(value: string) {
    const monday = snapToMondayISO(value);
    setEndWeek(monday);
  }

  async function submit() {
    setError(null);
    if (!selectedId) {
      setError("Scegli un progetto");
      return;
    }
    if (!datesValid) {
      setError("Date non valide");
      return;
    }
    const d = Number.parseFloat(days);
    if (!Number.isFinite(d) || d <= 0 || d > 7) {
      setError("Giorni/sett tra 0 e 7");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm({
        projectId: selectedId,
        daysPerWeek: d,
        startWeek,
        endWeek,
      });
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
          <h2 className="text-base font-semibold">Nuova pianificazione</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {draft.personName}
            {durationWeeks > 0 && (
              <>
                {" · "}
                {durationWeeks} {durationWeeks === 1 ? "settimana" : "settimane"}
              </>
            )}
          </p>
        </header>

        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {/* Periodo */}
          <div>
            <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
              Periodo (lunedì → lunedì)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startWeek}
                onChange={(e) => onStartInput(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 tabular-nums"
              />
              <span className="text-muted-foreground">→</span>
              <input
                type="date"
                value={endWeek}
                min={startWeek}
                onChange={(e) => onEndInput(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 tabular-nums"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Le date vengono agganciate al lunedì della settimana scelta.
            </p>
          </div>

          {/* Progetto */}
          <div>
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
            <ul className="max-h-56 overflow-y-auto border border-border rounded">
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
          </div>

          {/* Giorni */}
          <div>
            <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
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
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
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
            disabled={submitting || !selectedId || !datesValid}
            className="px-4 py-2 rounded bg-brand text-brand-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "..." : "Crea"}
          </button>
        </footer>
      </div>
    </div>
  );
}
