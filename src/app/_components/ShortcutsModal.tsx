"use client";

import {
  ArrowLeftRight,
  MousePointerClick,
  MoveHorizontal,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";

const SHORTCUTS: { action: string; shortcut: string; icon: LucideIcon }[] = [
  {
    action: "Edit schedule",
    shortcut: "Double-click on a bar",
    icon: MousePointerClick,
  },
  {
    action: "Move in time",
    shortcut: "Drag the bar body",
    icon: MoveHorizontal,
  },
  {
    action: "Resize period",
    shortcut: "Drag the left or right edge",
    icon: ArrowLeftRight,
  },
  {
    action: "Split segment",
    shortcut: "Shift + click",
    icon: Scissors,
  },
  {
    action: "Delete",
    shortcut: "Right-click (confirm)",
    icon: Trash2,
  },
];

const SESSION_KEY = "shortcuts_seen";

export function markShortcutsSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {}
}

export function shortcutsAlreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ShortcutsModal({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-labelledby="shortcuts-title"
        aria-modal="true"
        className="bg-background rounded-lg shadow-xl w-full max-w-sm"
      >
        <header className="px-5 py-4 border-b border-border flex items-center justify-between gap-2">
          <h2 id="shortcuts-title" className="text-base font-semibold">
            Keyboard & mouse shortcuts
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="p-1.5 rounded bg-muted hover:bg-muted-hover text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
            aria-label="Close"
          >
            <X size={16} aria-hidden />
          </button>
        </header>
        <ul className="p-5 space-y-3">
          {SHORTCUTS.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.action}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="flex items-center gap-2.5 text-foreground">
                  <Icon size={15} className="text-muted-foreground shrink-0" aria-hidden />
                  {item.action}
                </span>
                <span className="text-muted-foreground text-right shrink-0">
                  {item.shortcut}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
