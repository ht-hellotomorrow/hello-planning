"use client";

import { X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { createPersonalProject } from "@/app/actions/projects";

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
  personal: "Personal",
};

const CATEGORY_BADGE: Record<Category, string> = {
  ht_internal: "bg-brand-soft text-brand",
  ht_client: "bg-red-100 text-red-700",
  personal: "bg-muted text-muted-foreground",
};

export const DRAWER_DRAG_TYPE = "application/x-hello-planning-project";

type Props = {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  segments: Array<{ projectId: string }>;
};

export function ProjectDrawer({
  open,
  onClose,
  projects,
  segments,
}: Props) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

  const usedProjectIds = useMemo(
    () => new Set(segments.map((s) => s.projectId)),
    [segments],
  );

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
    // Mai usati in alto, poi alfabetico
    return [...filtered].sort((a, b) => {
      const aUsed = usedProjectIds.has(a.id) ? 1 : 0;
      const bUsed = usedProjectIds.has(b.id) ? 1 : 0;
      if (aUsed !== bUsed) return aUsed - bUsed;
      return a.name.localeCompare(b.name);
    });
  }, [projects, query, usedProjectIds]);

  if (!open) return null;

  return (
    <aside className="shrink-0 border-l border-border bg-background w-80 flex flex-col">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">
            Backlog
          </h2>
          <p className="text-xs text-muted-foreground">
            Drag onto a person
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded bg-muted hover:bg-muted-hover text-muted-foreground"
          aria-label="Close backlog"
          title="Close"
        >
          <X size={16} aria-hidden />
        </button>
      </header>

      <div className="p-3 space-y-2 shrink-0 border-b border-border">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search project…"
          className="w-full px-3 py-1.5 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
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
      </div>

      <ul className="flex-1 overflow-y-auto p-2 space-y-1">
        {visible.length === 0 ? (
          <li className="text-sm text-muted-foreground text-center py-6">
            No projects.
          </li>
        ) : (
          visible.map((p) => {
            const used = usedProjectIds.has(p.id);
            return (
              <li
                key={p.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAWER_DRAG_TYPE, p.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="group flex items-center gap-2 px-3 py-2 rounded border border-border bg-background hover:border-brand hover:shadow-sm cursor-grab active:cursor-grabbing transition"
                title={`${p.name} · ${CATEGORY_LABEL[p.category]}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground flex gap-1.5 items-center mt-0.5">
                    <span className="font-mono truncate">{p.code ?? "—"}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold shrink-0 ${
                        CATEGORY_BADGE[p.category]
                      }`}
                    >
                      {CATEGORY_LABEL[p.category]}
                    </span>
                    {used && (
                      <span
                        className="text-[10px] text-muted-foreground shrink-0"
                        title="Already scheduled elsewhere"
                      >
                        · used
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition">
                  ⋮⋮
                </span>
              </li>
            );
          })
        )}
      </ul>
    </aside>
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
    <div className="p-3 border border-border rounded bg-muted/30 space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        autoFocus
        className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none"
      />
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Code (optional)"
        className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none font-mono"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !name.trim()}
          className="flex-1 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "..." : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-3 py-1.5 rounded text-sm text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
