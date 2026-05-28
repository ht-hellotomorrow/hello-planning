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

export function SyncButton() {
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
          text: `${data.total} progetti sincronizzati (${data.added} nuovi, ${data.updated} aggiornati)`,
        });
        router.refresh();
      } else {
        setMsg({ kind: "err", text: data.error ?? "Sync fallito" });
      }
    } catch (err) {
      setMsg({
        kind: "err",
        text: err instanceof Error ? err.message : "Errore di rete",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="px-4 py-2 rounded-md bg-brand text-brand-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
      >
        {loading ? "Sincronizzo…" : "Sincronizza ora"}
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
