/**
 * Generic lesson model. A lesson is pure data + two pure functions
 * (`tick`, `project`). The canvas, controls, inspector and explanation bar
 * only ever read from the projection of one shared simulation state.
 */

export type Tone = "healthy" | "warning" | "error" | "pending" | "idle" | "inactive";
export type IconName = "users" | "balancer" | "server" | "policy" | "capacity" | "container" | "database" | "queue";
export type NodeKind = "actor" | "service" | "server" | "capacity" | "boundary";

export interface NodeInfo {
  purpose: string;
  inputs: string[];
  outputs: string[];
  example: string;
}

export interface NodeDef {
  id: string;
  kind: NodeKind;
  label: string;
  sublabel?: string;
  icon?: IconName;
  position: { x: number; y: number };
  size: { w: number; h: number };
  info?: NodeInfo;
  /** For boundaries: "region" is a solid cloud boundary, "group" a dashed logical group. */
  boundary?: "region" | "group";
}

export interface EdgeDef {
  id: string;
  source: string;
  target: string;
}

/** What a node looks like right now. Derived from simulation state only. */
export interface NodeView {
  tone: Tone;
  badge?: string;
  subtitle?: string;
  headline?: string;
  meter?: { label: string; pct: number; text: string };
  pips?: Tone[];
  details?: [string, string][];
  ghost?: boolean;
}

export type EdgeTone = "flow" | "error" | "probe" | "blocked" | "draining" | "control" | "idle";

export interface EdgeView {
  tone: EdgeTone;
  /** Number of request markers travelling along the path. */
  dots: number;
  hidden?: boolean;
  caption?: string;
}

export interface Metric {
  label: string;
  value: string;
  tone?: Tone;
}

export interface Projection {
  nodes: Record<string, NodeView>;
  edges: Record<string, EdgeView>;
  metrics: Metric[];
  /** Plain-English, one-line description of what is happening right now. */
  explanation: string;
}

export interface Scenario<E> {
  id: string;
  title: string;
  summary: string;
  problem: string;
  learned: string;
  /** Number of ticks until the lesson ends; null = open-ended sandbox. */
  length: number | null;
  /** Initial parameters handed to `init`. */
  initial: Record<string, number>;
  /** External events that fire when the simulation reaches a tick. */
  script: Record<number, E[]>;
}

export type Intervention<S, E> =
  | {
      type: "slider";
      id: string;
      label: string;
      min: number;
      max: number;
      step: number;
      read: (s: S) => number;
      format: (v: number) => string;
      toEvents: (v: number) => E[];
    }
  | {
      type: "button";
      id: string;
      label: string;
      disabled: (s: S) => boolean;
      toEvents: (s: S) => E[];
    };

export interface Lesson<S extends { tick: number; notes: unknown[] }, E> {
  slug: string;
  topic: string;
  title: string;
  nodes: NodeDef[];
  edges: EdgeDef[];
  scenarios: Scenario<E>[];
  interventions: Intervention<S, E>[];
  init: (initial: Record<string, number>) => S;
  /** Apply events instantly (user interventions) without advancing time. */
  apply: (s: S, events: E[]) => S;
  /** Advance simulated time by one step. Pure and deterministic. */
  tick: (s: S, events: E[]) => S;
  project: (s: S) => Projection;
}
