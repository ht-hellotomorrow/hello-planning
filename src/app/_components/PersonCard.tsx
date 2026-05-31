"use client";

import { useState, useTransition } from "react";
import {
  archivePerson,
  deletePerson,
  unarchivePerson,
  updatePerson,
} from "@/app/actions/people";

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  propicUrl: string | null;
  capacityDaysPerWeek: number;
  archived: boolean;
};

export function PersonCard({ person }: { person: Person }) {
  const [firstName, setFirstName] = useState(person.firstName);
  const [lastName, setLastName] = useState(person.lastName);
  const [propicUrl, setPropicUrl] = useState(person.propicUrl ?? "");
  const [capacity, setCapacity] = useState(
    String(person.capacityDaysPerWeek),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    firstName !== person.firstName ||
    lastName !== person.lastName ||
    propicUrl !== (person.propicUrl ?? "") ||
    Number.parseFloat(capacity) !== person.capacityDaysPerWeek;

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.append("id", person.id);
    fd.append("firstName", firstName);
    fd.append("lastName", lastName);
    fd.append("propicUrl", propicUrl);
    fd.append("capacity", capacity);
    startTransition(async () => {
      try {
        await updatePerson(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function onReset() {
    setFirstName(person.firstName);
    setLastName(person.lastName);
    setPropicUrl(person.propicUrl ?? "");
    setCapacity(String(person.capacityDaysPerWeek));
    setError(null);
  }

  function onArchiveToggle() {
    setError(null);
    startTransition(async () => {
      try {
        if (person.archived) await unarchivePerson(person.id);
        else await archivePerson(person.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function onDelete() {
    const ok = window.confirm(
      `Permanently delete ${person.firstName} ${person.lastName}? All their schedules will be removed. This action cannot be undone.`,
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      try {
        await deletePerson(person.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  return (
    <div className="p-4 border border-border rounded-lg bg-background flex items-start gap-4">
      <div className="w-14 h-14 shrink-0 rounded-full bg-muted overflow-hidden flex items-center justify-center text-base font-semibold text-muted-foreground">
        {propicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={propicUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
        )}
      </div>

      <div className="flex-1 grid grid-cols-2 gap-2">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className="px-2 py-1.5 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none"
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          className="px-2 py-1.5 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none"
        />
        <input
          value={propicUrl}
          onChange={(e) => setPropicUrl(e.target.value)}
          type="url"
          placeholder="Profile photo URL"
          className="col-span-2 px-2 py-1.5 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none"
        />
        <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
          Capacity
          <input
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            type="number"
            step="0.5"
            min="0"
            max="7"
            className="w-20 px-2 py-1 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none tabular-nums"
          />
          d/wk
        </label>
        {error && (
          <p className="col-span-2 text-xs text-red-600">{error}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 shrink-0">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || pending}
          className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-30"
        >
          Save
        </button>
        {dirty && (
          <button
            type="button"
            onClick={onReset}
            disabled={pending}
            className="px-3 py-1.5 rounded text-xs text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={onArchiveToggle}
          disabled={pending}
          className="px-3 py-1.5 rounded text-xs text-muted-foreground hover:bg-muted"
        >
          {person.archived ? "Restore" : "Archive"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="px-3 py-1.5 rounded text-xs text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
