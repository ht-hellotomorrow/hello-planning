"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SyncResponse = {
  ok?: boolean;
  added?: number;
  updated?: number;
  total?: number;
  durationMs?: number;
  error?: string;
};

export function SyncButton({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const router = useRouter();

  async function onClick() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = (await res.json()) as SyncResponse;
      if (res.ok) {
        setMsg({
          kind: "ok",
          text: `${data.total} projects synced (${data.added} new, ${data.updated} updated)`,
        });
        router.refresh();
      } else {
        setMsg({ kind: "err", text: data.error ?? "Sync failed" });
      }
    } catch (err) {
      setMsg({
        kind: "err",
        text: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${compact ? "items-stretch" : "items-end"}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={`rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition focus:outline-none focus:ring-2 focus:ring-brand/30 ${
          compact
            ? "px-3 py-1.5 text-xs whitespace-nowrap"
            : "px-4 py-2 text-sm"
        }`}
      >
        {loading ? "Syncing…" : "Sync Airtable"}
      </button>
      {msg && (
        <p
          className={`text-xs ${
            msg.kind === "ok" ? "text-muted-foreground" : "text-red-600"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
