"use client";

import { useRef, useState, useTransition } from "react";
import { addPerson } from "@/app/actions/people";

export function AddPersonForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addPerson(formData);
        formRef.current?.reset();
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left px-3 py-2 rounded-md border border-dashed border-border hover:border-brand hover:text-brand text-sm text-muted-foreground transition"
      >
        + Add person
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="space-y-2 p-3 border border-border rounded-md bg-muted/30"
    >
      <div className="grid grid-cols-2 gap-2">
        <input
          name="firstName"
          placeholder="First name"
          required
          autoFocus
          className="px-2 py-1.5 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none"
        />
        <input
          name="lastName"
          placeholder="Last name"
          className="px-2 py-1.5 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none"
        />
      </div>
      <input
        name="propicUrl"
        type="url"
        placeholder="Profile photo URL (optional)"
        className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Capacity
          <input
            name="capacity"
            type="number"
            step="0.5"
            min="0"
            max="7"
            defaultValue="5"
            className="w-16 px-2 py-1 text-sm rounded border border-border bg-background focus:border-brand focus:outline-none tabular-nums"
          />
          d/wk
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "..." : "Add"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="px-3 py-1.5 rounded text-sm text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
