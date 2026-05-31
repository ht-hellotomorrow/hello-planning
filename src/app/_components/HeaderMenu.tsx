"use client";

import Link from "next/link";
import { Ellipsis, LayoutList, LogOut, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type HeaderMenuProps = {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
};

const menuItemClass =
  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-muted transition text-foreground";

export function HeaderMenu({ drawerOpen, onToggleDrawer }: HeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function onLogout() {
    setLogoutPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore: comunque vogliamo mandare l'utente al login
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu"
        className="p-2 rounded-md bg-muted hover:bg-muted-hover text-muted-foreground"
      >
        <Ellipsis size={18} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 min-w-40 py-1 px-1 rounded-md border border-border bg-background shadow-lg z-50"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onToggleDrawer();
              setOpen(false);
            }}
            className={`${menuItemClass} ${
              drawerOpen ? "bg-brand-soft text-brand" : ""
            }`}
            aria-pressed={drawerOpen}
          >
            <LayoutList size={16} aria-hidden />
            Backlog
          </button>
          <Link
            href="/people"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={menuItemClass}
          >
            <Users size={16} aria-hidden />
            People
          </Link>
          <div className="my-1 border-t border-border" role="separator" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void onLogout()}
            disabled={logoutPending}
            className={`${menuItemClass} disabled:opacity-50`}
          >
            <LogOut size={16} aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
