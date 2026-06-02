"use client";

import { GripVertical } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { reorderPeople } from "@/app/actions/people";
import { PersonCard } from "./PersonCard";

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  propicUrl: string | null;
  capacityDaysPerWeek: number;
  archived: boolean;
};

const DRAG_TYPE = "application/x-hp-person";

export function PeopleReorderList({ initial }: { initial: Person[] }) {
  const [items, setItems] = useState(initial);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Keep local order in sync if the server data changes (e.g., add/delete).
  useEffect(() => {
    setItems(initial);
  }, [initial]);

  function reorder(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const next = [...items];
    const srcIdx = next.findIndex((p) => p.id === sourceId);
    const tgtIdx = next.findIndex((p) => p.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const [moved] = next.splice(srcIdx, 1);
    next.splice(tgtIdx, 0, moved);
    setItems(next);
    startTransition(() => {
      reorderPeople(next.map((p) => p.id));
    });
  }

  return (
    <ul className="space-y-2">
      {items.map((p) => {
        const isOver = overId === p.id && draggingId !== p.id;
        const isDragging = draggingId === p.id;
        return (
          <li
            key={p.id}
            id={p.id}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overId !== p.id) setOverId(p.id);
            }}
            onDragLeave={() => {
              if (overId === p.id) setOverId(null);
            }}
            onDrop={(e) => {
              const sourceId = e.dataTransfer.getData(DRAG_TYPE);
              if (sourceId) {
                e.preventDefault();
                reorder(sourceId, p.id);
              }
              setDraggingId(null);
              setOverId(null);
            }}
            className={`flex items-stretch gap-1 rounded-lg transition ${
              isOver ? "ring-2 ring-brand" : ""
            } ${isDragging ? "opacity-40" : ""}`}
          >
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, p.id);
                e.dataTransfer.effectAllowed = "move";
                setDraggingId(p.id);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setOverId(null);
              }}
              title="Drag to reorder"
              aria-label="Drag to reorder"
              className="flex items-center px-1 rounded cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <GripVertical size={16} aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <PersonCard person={p} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
