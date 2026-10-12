"use client";

import dynamic from "next/dynamic";
import { getLesson } from "@/lessons";

const Workspace = dynamic(() => import("@/components/Workspace").then((m) => m.Workspace), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center bg-canvas font-mono text-xs text-dim">Loading simulation…</div>,
});

export function LessonClient({ slug }: { slug: string }) {
  const lesson = getLesson(slug);
  if (!lesson) return null;
  return <Workspace lesson={lesson} />;
}
