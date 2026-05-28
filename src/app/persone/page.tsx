import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { people } from "@/db/schema";
import { AddPersonForm } from "../_components/AddPersonForm";
import { LogoutButton } from "../_components/LogoutButton";
import { PersonCard } from "../_components/PersonCard";

export const dynamic = "force-dynamic";

export default async function PersonePage() {
  const rows = await db
    .select({
      id: people.id,
      firstName: people.firstName,
      lastName: people.lastName,
      propicUrl: people.propicUrl,
      capacityDaysPerWeek: people.capacityDaysPerWeek,
      archived: people.archived,
    })
    .from(people)
    .orderBy(desc(people.archived), asc(people.firstName));

  const active = rows.filter((p) => !p.archived);
  const archived = rows.filter((p) => p.archived);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="px-6 py-3 border-b border-border flex items-center justify-between gap-4 bg-background shrink-0">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand text-accent text-base font-extrabold">
            H!
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-tight">
              Persone
            </h1>
            <p className="text-xs text-muted-foreground leading-tight">
              Gestisci il team e la capacity
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="px-3 py-1.5 rounded text-sm font-medium hover:bg-muted text-muted-foreground"
          >
            ← Torna alla timeline
          </Link>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        <section className="mb-8">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Aggiungi persona
          </h2>
          <AddPersonForm />
        </section>

        <section className="mb-8">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Attive ({active.length})
          </h2>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
              Nessuna persona attiva.
            </p>
          ) : (
            <ul className="space-y-2">
              {active.map((p) => (
                <li key={p.id} id={p.id}>
                  <PersonCard person={p} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {archived.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              Archiviate ({archived.length})
            </h2>
            <ul className="space-y-2 opacity-60">
              {archived.map((p) => (
                <li key={p.id} id={p.id}>
                  <PersonCard person={p} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
