"use client";

import { useMemo, useState, useTransition } from "react";
import { createPersonalProject } from "@/app/actions/projects";
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
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Active projects synced from Airtable and personal projects created in
          app.
        </p>
        <SyncButton />
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
          className="w-full text-left px-3 py-2 rounded border border-dashed border-border hover:border-brand hover:text-brand text-sm text-muted-foreground transition"
        >
          + New personal project
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
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-background"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground flex gap-2 items-center mt-1 flex-wrap">
                    <span className="font-mono truncate">{p.code ?? "—"}</span>
                    <CategoryBadge category={p.category} />
                    {used && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        · scheduled
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
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
