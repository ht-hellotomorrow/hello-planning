"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle } from "lucide-react";
import { deleteSegmentsByIds } from "@/app/actions/allocations";

type FutureScheduleProject = {
  projectId: string;
  projectName: string;
  projectCode: string | null;
  futureSegmentCount: number;
  segmentIds: string[];
};

type SyncResponse = {
  ok?: boolean;
  added?: number;
  updated?: number;
  total?: number;
  durationMs?: number;
  error?: string;
  projectsWithFutureSchedules?: FutureScheduleProject[];
};

type OverlayState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; added: number; updated: number; total: number; future: FutureScheduleProject[] }
  | { kind: "error"; message: string }
  | { kind: "future"; projects: FutureScheduleProject[] };

export function SyncButton({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<OverlayState>({ kind: "idle" });
  const [deletingFuture, setDeletingFuture] = useState(false);
  const router = useRouter();

  async function onClick() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = (await res.json()) as SyncResponse;
      if (res.ok) {
        const future = data.projectsWithFutureSchedules ?? [];
        setState({
          kind: "result",
          added: data.added ?? 0,
          updated: data.updated ?? 0,
          total: data.total ?? 0,
          future,
        });
      } else {
        setState({ kind: "error", message: data.error ?? "Sync failed" });
      }
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Network error" });
    }
  }

  function onDismissResult() {
    if (state.kind !== "result") return;
    if (state.future.length > 0) {
      setState({ kind: "future", projects: state.future });
    } else {
      setState({ kind: "idle" });
      router.refresh();
    }
  }

  async function onDeleteFuture() {
    if (state.kind !== "future") return;
    setDeletingFuture(true);
    try {
      const allIds = state.projects.flatMap((p) => p.segmentIds);
      await deleteSegmentsByIds(allIds);
      setState({ kind: "idle" });
      router.refresh();
    } finally {
      setDeletingFuture(false);
    }
  }

  function onKeepFuture() {
    setState({ kind: "idle" });
    router.refresh();
  }

  const showOverlay = state.kind !== "idle";

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={showOverlay}
        className={`rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition focus:outline-none focus:ring-2 focus:ring-brand/30 ${
          compact ? "px-3 py-1.5 text-xs whitespace-nowrap" : "px-4 py-2 text-sm"
        }`}
      >
        Sync Airtable
      </button>

      {/* Loading overlay */}
      {state.kind === "loading" && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl px-8 py-8 flex flex-col items-center gap-4 min-w-[220px]">
            <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            <p className="text-sm font-medium">Sincronizzazione in corso…</p>
          </div>
        </div>
      )}

      {/* Result overlay */}
      {state.kind === "result" && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-sm flex flex-col">
            <div className="px-6 py-6 flex flex-col items-center gap-3 text-center">
              <CheckCircle size={32} className="text-green-500" aria-hidden />
              <div>
                <p className="text-base font-semibold">Sync completato</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {state.total} progetti · {state.added} nuovi · {state.updated} aggiornati
                </p>
                {state.future.length > 0 && (
                  <p className="text-sm text-amber-600 mt-2">
                    {state.future.length} progetto completato con schedule futuri
                  </p>
                )}
              </div>
            </div>
            <footer className="px-6 pb-5 flex justify-center">
              <button
                type="button"
                onClick={onDismissResult}
                className="px-6 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
              >
                {state.future.length > 0 ? "Continua →" : "OK"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {state.kind === "error" && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-sm flex flex-col">
            <div className="px-6 py-6 flex flex-col items-center gap-3 text-center">
              <XCircle size={32} className="text-red-500" aria-hidden />
              <div>
                <p className="text-base font-semibold">Sync fallito</p>
                <p className="text-sm text-muted-foreground mt-1">{state.message}</p>
              </div>
            </div>
            <footer className="px-6 pb-5 flex justify-center">
              <button
                type="button"
                onClick={() => setState({ kind: "idle" })}
                className="px-6 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
              >
                Chiudi
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Future schedules overlay */}
      {state.kind === "future" && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md flex flex-col">
            <header className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold">Schedule futuri su progetti completati</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Questi progetti sono stati completati su Airtable ma hanno ancora schedule pianificati nel futuro.
              </p>
            </header>
            <ul className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
              {state.projects.map((p) => (
                <li key={p.projectId} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-medium truncate">
                      {p.projectCode ?? p.projectName}
                    </p>
                    {p.projectCode && (
                      <p className="text-xs text-muted-foreground truncate">{p.projectName}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                    {p.futureSegmentCount} schedule
                  </span>
                </li>
              ))}
            </ul>
            <footer className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                onClick={onKeepFuture}
                disabled={deletingFuture}
                className="px-4 py-2 rounded text-sm text-muted-foreground hover:bg-muted"
              >
                Mantieni
              </button>
              <button
                type="button"
                onClick={onDeleteFuture}
                disabled={deletingFuture}
                className="px-4 py-2 rounded bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deletingFuture ? "Eliminando…" : "Elimina schedule futuri"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
