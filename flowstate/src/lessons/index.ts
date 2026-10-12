import type { Lesson } from "@/engine/types";
import { autoscalingLesson } from "./autoscaling/lesson";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLesson = Lesson<any, any>;

export const lessons: AnyLesson[] = [autoscalingLesson];

export const getLesson = (slug: string) => lessons.find((l) => l.slug === slug);

export interface Topic {
  name: string;
  blurb: string;
  lesson?: string;
}

/** Library entries. Only topics with a `lesson` are playable today. */
export const topics: Topic[] = [
  { name: "AWS \u00b7 Load balancing & Auto Scaling", blurb: "ALB, EC2, health checks, scale out and in, instance replacement.", lesson: "aws-auto-scaling" },
  { name: "Nginx \u00b7 Reverse proxy", blurb: "Browser \u2192 Nginx \u2192 app server, and what happens when the upstream fails." },
  { name: "Docker \u00b7 Image to container", blurb: "Code \u2192 image \u2192 registry \u2192 container, and how they differ." },
  { name: "Kubernetes / EKS", blurb: "Deployment \u2192 ReplicaSet \u2192 Pods \u2192 Nodes, scheduling and replacement." },
  { name: "Microservices", blurb: "Trace one request across gateway, services, databases and queues." },
  { name: "CI/CD \u00b7 GitHub Actions", blurb: "Commit to production, step by step." },
  { name: "Networking \u00b7 VPC & DNS", blurb: "Subnets, routing, and name resolution." },
];
