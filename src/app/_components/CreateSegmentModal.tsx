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

type PersonOption = {
  id: string;
  firstName: string;
  lastName: string;
  propicUrl: string | null;
};

export type SegmentDraft = {
  personId?: string;
  personName?: string;
  startWeek: string;
  endWeek: string;
  defaultProjectId?: string;
  datesFromDrag?: boolean;
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
  personId?: string;
  daysPerWeek: number;
  startWeek: string;
  endWeek: string;
};

type Props = {
  draft: SegmentDraft;
  projects: Project[];
  people?: PersonOption[];
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

export function CreateSegmentModal({ draft, projects, people, onCancel, onConfirm }: Props) {
  const isEdit = draft.mode === "edit";

  // Resolve effective locked project
  const effectiveProject = useMemo(() => {
    if (draft.lockedProject) return draft.lockedProject;
    if (draft.defaultProjectId) {
      const p = projects.find((p) => p.id === draft.defaultProjectId);
      if (p) return { id: p.id, name: p.name, code: p.code, category: p.category };
    }
    return null;
  }, [draft.lockedProject, draft.defaultProjectId, projects]);

  const showProjectPicker = effectiveProject === null && !isEdit;
  const showPersonPicker = !draft.personId && !!people?.length;

  const [projectQuery, setProjectQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    effectiveProject?.id ?? null,
  );
  const [personQuery, setPersonQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const [days, setDays] = useState(
    draft.initialDays !== undefined ? String(draft.initialDays) : "1",
  );
  const [startWeek, setStartWeek] = useState(draft.startWeek);
  const [endWeek, setEndWeek] = useState(draft.endWeek);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const daysRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showPersonPicker || showProjectPicker) {
      firstInputRef.current?.focus();
    } else {
      daysRef.current?.select();
    }
  }, [showPersonPicker, showProjectPicker]);

  const durationWeeks = useMemo(() => {
    if (!startWeek || !endWeek) return 0;
    return weeksBetween(parseISO(startWeek), parseISO(endWeek)) + 1;
  }, [startWeek, endWeek]);

  const datesValid = !!startWeek && !!endWeek && endWeek >= startWeek;

  const filteredProjects = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    const visible = projects.filter((p) => p.visibility === "active");
    if (!q) return visible;
    return visible.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code?.toLowerCase().includes(q) ?? false),
    );
  }, [projects, projectQuery]);

  const filteredPeople = useMemo(() => {
    if (!people) return [];
    const q = personQuery.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q),
    );
  }, [people, personQuery]);

  function onStartInput(value: string) {
    const monday = snapToMondayISO(value);
    setStartWeek(monday);
    if (monday && endWeek && monday > endWeek) setEndWeek(monday);
  }
  function onEndInput(value: string) {
    setEndWeek(snapToMondayISO(value));
  }

  async function submit() {
    setError(null);
    const projectId = effectiveProject?.id ?? selectedProjectId;
    if (!projectId) { setError("Pick a project"); return; }

    const personId = draft.personId || selectedPersonId;
    if (showPersonPicker && !personId) { setError("Pick a person"); return; }

    if (!datesValid) { setError("Invalid dates"); return; }

    const d = Number.parseFloat(days);
    if (!Number.isFinite(d) || d <= 0 || d > 7) {
      setError("Days per week must be between 0 and 7");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm({
        projectId,
        personId: showPersonPicker ? (personId ?? undefined) : undefined,
        daysPerWeek: d,
        startWeek,
        endWeek,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setSubmitting(false);
    }
  }

  const projectLabel = effectiveProject?.code ?? effectiveProject?.name;
  const selectedPerson = people?.find((p) => p.id === selectedPersonId);
  const personLabel = draft.personName
    || (selectedPerson ? `${selectedPerson.firstName} ${selectedPerson.lastName}` : null);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">

        <header className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">
            {isEdit ? "Edit schedule" : "New schedule"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
            {personLabel && <span>{personLabel}</span>}
            {personLabel && projectLabel && <span className="text-muted-foreground/40">·</span>}
            {projectLabel && <span>{projectLabel}</span>}
            {durationWeeks > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{durationWeeks} {durationWeeks === 1 ? "week" : "weeks"}</span>
              </>
            )}
          </p>
        </header>

        <div className="p-5 flex-1 overflow-y-auto space-y-5">

          {/* Person picker — when project is known but person is not */}
          {showPersonPicker && (
            <div>
              <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                Person
              </label>
              <input
                ref={firstInputRef}
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
                placeholder="Search by name…"
                className="w-full px-3 py-2 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 mb-2"
              />
              <ul className="max-h-48 overflow-y-auto border border-border rounded">
                {filteredPeople.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-muted-foreground text-center">No people found</li>
                ) : (
                  filteredPeople.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPersonId(p.id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b border-border last:border-b-0 flex items-center gap-2 ${
                          selectedPersonId === p.id ? "bg-brand-soft" : ""
                        }`}
                      >
                        {p.propicUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.propicUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-muted border border-border text-[10px] font-semibold flex items-center justify-center shrink-0">
                            {p.firstName[0]}{p.lastName[0]}
                          </span>
                        )}
                        <span className="font-medium">{p.firstName} {p.lastName}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          {/* Project picker — when project is unknown */}
          {showProjectPicker && (
            <div>
              <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                Project
              </label>
              <input
                ref={showPersonPicker ? undefined : firstInputRef}
                value={projectQuery}
                onChange={(e) => setProjectQuery(e.target.value)}
                placeholder="Search by name or code…"
                className="w-full px-3 py-2 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 mb-2"
              />
              <ul className="max-h-48 overflow-y-auto border border-border rounded">
                {filteredProjects.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-muted-foreground text-center">No projects found</li>
                ) : (
                  filteredProjects.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedProjectId(p.id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b border-border last:border-b-0 ${
                          selectedProjectId === p.id ? "bg-brand-soft" : ""
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <CategoryBadge category={p.category} />
                        </div>
                        <div className="font-mono text-sm truncate mt-0.5">
                          {p.code ?? p.name}
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          {/* Period */}
          <div>
            <label className="block text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
              Period
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
            <p className="text-xs text-muted-foreground mt-1">Dates snap to the Monday of the chosen week.</p>
          </div>

          {/* Days per week */}
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
            disabled={
              submitting ||
              (!effectiveProject && !selectedProjectId) ||
              (showPersonPicker && !selectedPersonId) ||
              !datesValid
            }
            className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "..." : isEdit ? "Save" : "Create"}
          </button>
        </footer>
      </div>
    </div>
  );
}
