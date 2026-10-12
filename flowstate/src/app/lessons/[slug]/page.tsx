import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonClient } from "@/components/LessonClient";
import { getLesson, lessons } from "@/lessons";

export function generateStaticParams() {
  return lessons.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: PageProps<"/lessons/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const lesson = getLesson(slug);
  return lesson
    ? { title: `${lesson.title} \u2014 Flowstate`, description: `Interactive simulation: ${lesson.topic} ${lesson.title}.` }
    : {};
}

export default async function LessonPage({ params }: PageProps<"/lessons/[slug]">) {
  const { slug } = await params;
  if (!getLesson(slug)) notFound();
  return <LessonClient slug={slug} />;
}
