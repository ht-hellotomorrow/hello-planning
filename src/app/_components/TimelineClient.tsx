"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "./AppHeader";
import { Timeline } from "./Timeline";
import { WEEK_WIDTH, WEEKS_BEFORE_TODAY } from "@/lib/timeline-layout";
import type { TimelineProps } from "./Timeline";

type TimelineDataProps = Omit<TimelineProps, "scrollRef">;

export function TimelineClient(props: TimelineDataProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const shiftWeeks = useCallback((n: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: n * WEEK_WIDTH, behavior: "smooth" });
  }, []);

  const scrollToToday = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      left: Math.max(0, WEEKS_BEFORE_TODAY - 1) * WEEK_WIDTH,
      behavior: "smooth",
    });
  }, []);

  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AppHeader onShiftWeeks={shiftWeeks} onScrollToToday={scrollToToday} />
      <Timeline scrollRef={scrollRef} {...props} />
    </div>
  );
}
