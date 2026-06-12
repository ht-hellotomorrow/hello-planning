"use client";

import type { ViewMode } from "@/lib/timeline-types";

type Props = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
};

const TABS: { id: ViewMode; label: string }[] = [
  { id: "people", label: "People" },
  { id: "projects", label: "Projects" },
];

export function SidebarTabs({ value, onChange }: Props) {
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = e.key === "ArrowRight" ? 1 : -1;
      const newIndex = (index + next + TABS.length) % TABS.length;
      onChange(TABS[newIndex].id);
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Timeline view"
      className="flex gap-1 p-1 rounded-md bg-muted"
    >
      {TABS.map((tab, index) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded transition focus:outline-none focus:ring-2 focus:ring-brand/30 ${
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
