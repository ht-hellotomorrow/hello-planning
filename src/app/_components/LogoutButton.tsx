"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function onClick() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore: comunque vogliamo mandare l'utente al login
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title="Sign out"
      aria-label="Sign out"
      className="p-2 rounded bg-muted hover:bg-muted-hover text-muted-foreground disabled:opacity-50"
    >
      <LogOut size={18} aria-hidden />
    </button>
  );
}
