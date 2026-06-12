"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppLogo } from "./AppLogo";
import { LogoutButton } from "./LogoutButton";

type Props = {
  onShiftWeeks: (n: number) => void;
  onScrollToToday: () => void;
};

export function AppHeader({ onShiftWeeks, onScrollToToday }: Props) {
  return (
    <header className="px-6 py-3 border-b border-border flex items-center justify-between gap-4 bg-background z-30 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <AppLogo />
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onShiftWeeks(-4)}
          className="p-2 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
          aria-label="Back 4 weeks"
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onScrollToToday}
          className="px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => onShiftWeeks(4)}
          className="p-2 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
          aria-label="Forward 4 weeks"
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/projects"
          className="px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          Projects
        </Link>
        <Link
          href="/people"
          className="px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          People
        </Link>
        <LogoutButton />
      </div>
    </header>
  );
}
