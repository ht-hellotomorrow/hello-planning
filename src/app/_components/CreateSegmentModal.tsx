"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Category } from "@/lib/categories";
import { isoDate, parseISO, toMonday, weeksBetween } from "@/lib/weeks";
import { CategoryBadge } from "./CategoryBadge";

type Visibility = "active" | "archived" | "hidden";

type Project = {
  id: string;
  code: string | null;
  name: string;
  category: Category;
  visibility: Visibility;
};

export type SegmentDraft = {
  personId: string;
  personName: string;
  startWeek: string;
  endWeek: string;
  defaultProjectId?: string;
  mode?: "create" | "edit";
  segmentId?: string;
  lockedProject?: {
    id: string;
    name: string;
    code: string | null;
    category: Category;
  };
  initialDays?: number;
};

export type CreateSegmentDraft = SegmentDraft;

export type CreateSegmentConfirmInput = {
  projectId: string;
  daysPerWeek: number;
  startWeek: string;
  endWeek: string;
};

type Props = {
  draft: SegmentDraft;
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
  const isEdit = draft.mode === "edit";
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    draft.lockedProject?.id ?? draft.defaultProjectId ?? null,
  );
  const [days, setDays] = useState(
    draft.initialDays !== undefined ? String(draft.initialDays) : "1",
  );
  const [startWeek, setStartWeek] = useState(draft.startWeek);
  const [endWeek, setEndWeek] = useState(draft.endWeek);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const daysRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEdit) daysRef.current?.select();
    else searchRef.current?.focus();
  }, [isEdit]);

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
    if (monday && endWeek && monday > endWeek) setEndWeek(monday);
  }
  function onEndInput(value: string) {
    const monday = snapToMondayISO(value);
    setEndWeek(monday);
  }

  async function submit() {
    setError(null);
    if (!selectedId) {
      setError("Pick a project");
      return;
    }
    if (!datesValid) {
      setError("Invalid dates");
      return;
    }
    const d = Number.parseFloat(days);
    if (!Number.isFinite(d) || d <= 0 || d > 7) {
      setError("Days per week must be between 0 and 7");
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
      setError(err instanceof Error ? err.message : "Error");
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
          <h2 className="text-base font-semibold">
            {isEdit ? "Edit schedule" : "New schedule"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {draft.personName}
            {durationWeeks > 0 && (
              <>
                {" · "}
                {durationWeeks} {durationWeeks === 1 ? "week" : "weeks"}
              </>
            )}
          </p>
        </header>

        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          <div>
            <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
              Period (Monday → Monday)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startWeek}
                onChange={(e) => onStartInput(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 tabular-nums"
              />
              <ArrowRight size={16} className="text-muted-foreground shrink-0" aria-hidden />
              <input
                type="date"
                value={endWeek}
                min={startWeek}
                onChange={(e) => onEndInput(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 tabular-nums"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dates snap to the Monday of the chosen week.
            </p>
          </div>

          {isEdit && draft.lockedProject ? (
            <div>
              <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                Project
              </label>
              <div className="px-3 py-2 border border-border rounded bg-muted/30 space-y-1.5">
                <CategoryBadge category={draft.lockedProject.category} />
                <div className="font-medium truncate text-sm">
                  {draft.lockedProject.name}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {draft.lockedProject.code ?? "—"}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                Project
              </label>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or code…"
                className="w-full px-3 py-2 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 mb-2"
              />
              <ul className="max-h-56 overflow-y-auto border border-border rounded">
                {filtered.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-muted-foreground text-center">
                    No projects found
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
                        <div className="text-xs text-muted-foreground flex gap-2 items-center mt-0.5 flex-wrap">
                          <span className="font-mono">{p.code ?? "—"}</span>
                          <CategoryBadge category={p.category} />
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
              Days per week
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={daysRef}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                type="number"
                step="0.5"
                min="0.5"
                max="7"
                className="w-24 px-3 py-2 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 tabular-nums"
              />
              <span className="text-sm text-muted-foreground">d/wk</span>
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
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !selectedId || !datesValid}
            className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "..." : isEdit ? "Save" : "Create"}
          </button>
        </footer>
      </div>
    </div>
  );
}
