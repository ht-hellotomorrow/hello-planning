import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { allocationSegments, projects } from "@/db/schema";
import { AllProjectsList } from "../_components/AllProjectsList";
import { AppLogo } from "../_components/AppLogo";
import { LogoutButton } from "../_components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projectRows, segmentRows] = await Promise.all([
    db
      .select({
        id: projects.id,
        code: projects.code,
        name: projects.name,
        category: projects.category,
        visibility: projects.visibility,
      })
      .from(projects)
      .orderBy(asc(projects.name)),
    db
      .select({ projectId: allocationSegments.projectId })
      .from(allocationSegments),
  ]);

  const usedProjectIds = new Set(segmentRows.map((s) => s.projectId));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="px-6 py-3 border-b border-border flex items-center justify-between gap-4 bg-background shrink-0">
        <div className="flex items-center gap-3">
          <AppLogo size={36} showWordmark={false} />
          <div>
            <h1 className="text-base font-bold tracking-tight leading-tight">
              All Projects
            </h1>
            <p className="text-xs text-muted-foreground leading-tight">
              Browse and sync projects
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium hover:bg-muted text-muted-foreground"
          >
            <ArrowLeft size={16} aria-hidden />
            Back to timeline
          </Link>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        <AllProjectsList
          projects={projectRows}
          usedProjectIds={usedProjectIds}
        />
      </main>
    </div>
  );
}
