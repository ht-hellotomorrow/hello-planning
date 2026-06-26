"use client";

import { useMemo, useState, useTransition } from "react";
import { Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { createPersonalProject, deletePersonalProject } from "@/app/actions/projects";
import { CategoryBadge } from "./CategoryBadge";
import { SyncButton } from "./SyncButton";
import type { Project } from "@/lib/timeline-types";

type Props = {
  projects: Project[];
  usedProjectIds: Set<string>;
};

export function AllProjectsList({ projects, usedProjectIds }: Props) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const visible = useMemo(() => {
    const list = projects.filter((p) => p.visibility === "active");
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.code?.toLowerCase().includes(q) ?? false),
        )
      : list;
    return [...filtered].sort((a, b) => {
      const aUsed = usedProjectIds.has(a.id) ? 1 : 0;
      const bUsed = usedProjectIds.has(b.id) ? 1 : 0;
      if (aUsed !== bUsed) return aUsed - bUsed;
      return a.name.localeCompare(b.name);
    });
  }, [projects, query, usedProjectIds]);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Active projects synced from Airtable and personal projects created in app.
        </p>
        <SyncButton />
      </div>

      {/* Legend */}
      <div className="rounded-lg border border-border bg-muted/30">
        <button
          type="button"
          onClick={() => setLegendOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-left"
        >
          <span>Come funziona questa pagina</span>
          {legendOpen
            ? <ChevronDown size={15} className="text-muted-foreground shrink-0" />
            : <ChevronRight size={15} className="text-muted-foreground shrink-0" />
          }
        </button>
        {legendOpen && (
          <div className="border-t border-border divide-y divide-border text-sm text-muted-foreground">
            {/* Badge legend */}
            <div className="px-4 py-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
              <span className="inline-flex self-start px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold bg-brand-soft text-brand shrink-0">internal</span>
              <p>Progetti interni di Hello Tomorrow.</p>
              <span className="inline-flex self-start px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold bg-red-100 text-red-700 shrink-0">external</span>
              <p>Progetti clienti esterni.</p>
              <span className="inline-flex self-start px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold bg-yellow-100 text-yellow-700 shrink-0">personal</span>
              <p>Progetti personali o freelance delle singole risorse — non sincronizzati da Airtable. Puoi crearli e cancellarli direttamente da questa pagina.</p>
              <span className="inline-flex self-start px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold bg-muted text-muted-foreground shrink-0">scheduled</span>
              <p>Il progetto ha almeno uno schedule assegnato nella timeline.</p>
            </div>
            {/* Sync */}
            <div className="px-4 py-3">
              <p className="font-medium text-foreground mb-0.5">Sync Airtable</p>
              <p>Aggiorna la lista dei progetti dal database Airtable. Vengono importati solo i progetti con status diverso da <em>Completed</em> e <em>Awaiting final payment</em>.</p>
            </div>
            {/* Completed */}
            <div className="px-4 py-3">
              <p className="font-medium text-foreground mb-0.5">Progetti completati</p>
              <p>Quando un progetto viene marcato come completato su Airtable, al prossimo sync gli schedule passati vengono eliminati automaticamente. Se il progetto ha ancora schedule futuri pianificati, viene chiesto cosa fare prima di procedere.</p>
            </div>
          </div>
        )}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search project…"
        className="w-full px-3 py-2 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />

      {showForm ? (
        <PersonalProjectForm
          onDone={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full text-left px-4 py-2.5 rounded border border-dashed border-border hover:border-brand hover:bg-brand/5 hover:text-brand text-sm font-medium text-foreground transition flex items-center gap-2"
        >
          <span className="text-brand text-base leading-none">+</span>
          New personal project
        </button>
      )}

      <ul className="space-y-2">
        {visible.length === 0 ? (
          <li className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-md">
            No projects found.
          </li>
        ) : (
          visible.map((p) => {
            const used = usedProjectIds.has(p.id);
            const isPersonal = p.category === "personal";
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-background"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <CategoryBadge category={p.category} />
                    {used && (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold bg-muted text-muted-foreground shrink-0">
                        scheduled
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-sm truncate mt-1">
                    {p.code ?? p.name}
                  </div>
                </div>
                {isPersonal && (
                  <DeleteProjectButton projectId={p.id} />
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirm) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setConfirm(false)}
          disabled={pending}
          className="px-2 py-1 text-xs rounded text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await deletePersonalProject(projectId);
            })
          }
          className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "…" : "Delete"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
      aria-label="Delete project"
    >
      <Trash2 size={14} aria-hidden />
    </button>
  );
}

function PersonalProjectForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name required");
      return;
    }
    startTransition(async () => {
      try {
        await createPersonalProject({ name: trimmed, code: code.trim() });
        setName("");
        setCode("");
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  return (
    <div className="p-4 border border-border rounded-lg bg-muted/30 space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        autoFocus
        className="w-full px-3 py-2 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none"
      />
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Code (optional)"
        className="w-full px-3 py-2 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none font-mono"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !name.trim()}
          className="flex-1 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "..." : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-4 py-2 rounded text-sm text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
