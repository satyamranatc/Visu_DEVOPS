import type { EdgeDef, Lesson, NodeDef, NodeView, EdgeView, Projection, Scenario, Tone } from "@/engine/types";
import {
  CAPACITY_RPM,
  SLOTS,
  TARGET_CPU,
  apply,
  createState,
  derive,
  ec2Name,
  fmt,
  tick,
  type AsgEvent,
  type AsgState,
  type Phase,
} from "./sim";

const ec2Info = {
  purpose:
    "A virtual server that runs the application. The Auto Scaling Group launches and terminates these as demand changes.",
  inputs: ["HTTP requests forwarded by the load balancer", "Health check probes from the ALB"],
  outputs: ["HTTP responses", "CPU metrics sent to CloudWatch"],
  example: "An m6i.large running a Node.js API behind example.com.",
};

const instanceNodes: NodeDef[] = Array.from({ length: SLOTS }, (_, slot) => ({
  id: `ec2-${slot}`,
  kind: "server" as const,
  label: ec2Name(slot).replace(" ", " \u00b7 "),
  icon: "server" as const,
  position: { x: 664, y: 170 + slot * 92 },
  size: { w: 362, h: 80 },
  info: ec2Info,
}));

const nodes: NodeDef[] = [
  {
    id: "vpc",
    kind: "boundary",
    boundary: "region",
    label: "AWS Region \u00b7 VPC",
    position: { x: 230, y: 10 },
    size: { w: 860, h: 570 },
  },
  {
    id: "asg-bound",
    kind: "boundary",
    boundary: "group",
    label: "Auto Scaling Group \u00b7 web-asg",
    position: { x: 640, y: 56 },
    size: { w: 410, h: 500 },
  },
  {
    id: "users",
    kind: "service",
    label: "Users",
    sublabel: "HTTPS requests",
    icon: "users",
    position: { x: 0, y: 303 },
    size: { w: 160, h: 90 },
    info: {
      purpose: "Browsers and apps sending requests to your website. This is the demand your infrastructure has to absorb.",
      inputs: ["Nothing. Users generate the demand."],
      outputs: ["HTTPS requests to the load balancer's DNS name"],
      example: "Shoppers opening your store during a sale.",
    },
  },
  {
    id: "policy",
    kind: "service",
    label: "Target tracking policy",
    sublabel: `Keep average CPU near ${TARGET_CPU}%`,
    icon: "policy",
    position: { x: 290, y: 64 },
    size: { w: 280, h: 96 },
    info: {
      purpose:
        "Watches a CloudWatch metric (average CPU) and tells the Auto Scaling Group to change its desired capacity to keep it near a target. It scales out quickly, but scales in only after several consecutive low readings, and both respect a cooldown.",
      inputs: ["Average CPU utilisation of the group"],
      outputs: ["A new desired capacity for the Auto Scaling Group"],
      example: "A policy that keeps the fleet around 60% CPU.",
    },
  },
  {
    id: "alb",
    kind: "service",
    label: "Application Load Balancer",
    sublabel: "Routes to healthy targets",
    icon: "balancer",
    position: { x: 290, y: 293 },
    size: { w: 280, h: 110 },
    info: {
      purpose:
        "A managed AWS service (not a server you run). It accepts requests on a listener, spreads them across registered targets in the target group, and health-checks each one. It only routes to targets it considers healthy.",
      inputs: ["HTTPS requests from users", "Health check responses from targets"],
      outputs: ["Requests forwarded to healthy targets"],
      example: "A listener on :443 forwarding to a target group named web-tg.",
    },
  },
  {
    id: "asg",
    kind: "capacity",
    label: "Capacity",
    icon: "capacity",
    position: { x: 664, y: 92 },
    size: { w: 362, h: 60 },
    info: {
      purpose:
        "The Auto Scaling Group keeps the number of EC2 instances between a minimum and maximum and aims for a desired capacity. It launches instances, replaces unhealthy ones and terminates extras. It manages instances; it doesn't serve traffic itself.",
      inputs: ["Desired capacity from scaling policies", "Instance health status"],
      outputs: ["Launch and terminate actions", "New instances registered in the target group"],
      example: "min 2, max 4, desired 2 across two Availability Zones.",
    },
  },
  ...instanceNodes,
];

const edges: EdgeDef[] = [
  { id: "users-alb", source: "users", target: "alb" },
  { id: "policy-asg", source: "policy", target: "asg" },
  ...Array.from({ length: SLOTS }, (_, i) => ({ id: `alb-ec2-${i}`, source: "alb", target: `ec2-${i}` })),
];

const dotsFor = (rpm: number) => Math.max(1, Math.min(6, Math.round(rpm / 500)));
const TONE: Record<Phase, Tone> = {
  empty: "inactive",
  pending: "pending",
  initial: "pending",
  healthy: "healthy",
  unhealthy: "error",
  draining: "warning",
};

function project(s: AsgState): Projection {
  const d = derive(s);
  const nv: Record<string, NodeView> = {};
  const ev: Record<string, EdgeView> = {};

  nv.vpc = { tone: "idle" };
  nv["asg-bound"] = { tone: "idle" };
  nv.users = { tone: "idle", badge: `${fmt(s.traffic)} req/min`, subtitle: "HTTPS requests" };
  nv.policy = {
    tone: d.cpu > TARGET_CPU ? "warning" : "healthy",
    badge: s.cooldown > 0 ? "Cooldown" : undefined,
    subtitle: `Keep average CPU near ${TARGET_CPU}%`,
    meter: { label: "Avg CPU", pct: d.cpu, text: `${Math.round(d.cpu)}%` },
    details: [
      ["Target", `${TARGET_CPU}% CPU`],
      ["Average CPU", `${Math.round(d.cpu)}%`],
      ["Cooldown", s.cooldown > 0 ? `${s.cooldown} step(s) left` : "None"],
      ["Low readings", `${s.lowReadings} / 3`],
    ],
  };
  nv.alb = {
    tone: !d.routable.length && s.traffic > 0 ? "error" : "healthy",
    badge: `${d.routable.length} / ${d.registered} healthy`,
    subtitle: "Routes to healthy targets",
    details: [
      ["Registered targets", String(d.registered)],
      ["Healthy targets", String(d.routable.length)],
      ["Requests per target", `${fmt(d.share)} /min`],
      ["Failed requests", `${Math.round(d.errorRate * 100)}%`],
    ],
  };
  nv.asg = {
    tone: "healthy",
    headline: `Desired ${s.desired}`,
    subtitle: `Min ${s.min} \u00b7 Max ${s.max}`,
    badge: `${d.active} / ${s.max}`,
    pips: s.instances.map((i) => TONE[i.phase]),
    details: [
      ["Desired capacity", String(s.desired)],
      ["Minimum / maximum", `${s.min} / ${s.max}`],
      ["Running instances", String(d.running)],
      ["Pending launch", String(d.pending)],
    ],
  };

  ev["users-alb"] = { tone: "flow", dots: dotsFor(s.traffic) };
  ev["policy-asg"] = { tone: "control", dots: s.cooldown >= 2 ? 2 : 0 };

  for (const i of s.instances) {
    const id = `ec2-${i.slot}`;
    const n = ec2Name(i.slot);
    const eid = `alb-${id}`;
    const cpu = i.phase === "healthy" && !i.fault ? Math.min(100, (d.share / CAPACITY_RPM) * 100) : 0;
    const base: NodeView = { tone: TONE[i.phase] };
    switch (i.phase) {
      case "empty":
        nv[id] = { tone: "inactive", ghost: true, badge: "Not launched", subtitle: "Empty slot" };
        ev[eid] = { tone: "idle", dots: 0, hidden: true };
        break;
      case "pending":
        nv[id] = { ...base, badge: "Pending", subtitle: "Booting \u00b7 no traffic yet", details: [["EC2 state", "pending"], ["Target health", "not registered"]] };
        ev[eid] = { tone: "idle", dots: 0, hidden: true };
        break;
      case "initial":
        nv[id] = { ...base, badge: "Health checks", subtitle: "Registered \u00b7 not in rotation", details: [["EC2 state", "running"], ["Target health", "initial"], ["Requests", "none yet"]] };
        ev[eid] = { tone: "probe", dots: 1 };
        break;
      case "healthy":
        if (i.fault) {
          nv[id] = {
            tone: "error",
            badge: "Failing",
            subtitle: "ALB hasn't noticed yet",
            meter: { label: "CPU", pct: 0, text: "no response" },
            details: [["EC2 state", "running"], ["Target health", `healthy (${i.failedChecks} failed check${i.failedChecks === 1 ? "" : "s"})`], ["Requests", `${fmt(d.share)} /min, all failing`]],
          };
          ev[eid] = { tone: "error", dots: dotsFor(d.share) };
        } else {
          nv[id] = {
            tone: "healthy",
            badge: "Healthy",
            subtitle: `${fmt(d.share)} req/min`,
            meter: { label: "CPU", pct: cpu, text: `${Math.round(cpu)}%` },
            details: [["EC2 state", "running"], ["Target health", "healthy"], ["Requests", `${fmt(d.share)} /min`], ["CPU", `${Math.round(cpu)}%`]],
          };
          ev[eid] = { tone: "flow", dots: dotsFor(d.share) };
        }
        break;
      case "unhealthy":
        nv[id] = { ...base, badge: "Unhealthy", subtitle: "Removed from rotation", details: [["EC2 state", "running"], ["Target health", "unhealthy"], ["Next", "Auto Scaling replaces it"]] };
        ev[eid] = { tone: "blocked", dots: 0 };
        break;
      case "draining":
        nv[id] = { ...base, badge: "Terminating", subtitle: "Draining connections", details: [["EC2 state", "shutting-down"], ["Target health", "draining"]] };
        ev[eid] = { tone: "draining", dots: 0 };
        break;
    }
    void n;
  }

  const metrics = [
    { label: "Desired", value: String(s.desired) },
    { label: "Running", value: String(d.running) },
    { label: "Healthy targets", value: `${d.routable.length}/${d.registered}`, tone: (d.routable.length < d.registered ? "warning" : "healthy") as Tone },
    { label: "Avg CPU", value: `${Math.round(d.cpu)}%`, tone: (d.cpu > TARGET_CPU ? "warning" : "healthy") as Tone },
    { label: "Errors", value: `${Math.round(d.errorRate * 100)}%`, tone: (d.errorRate > 0.01 ? "error" : "healthy") as Tone },
  ];

  const sorted = [...s.notes].sort((a, b) => a.p - b.p);
  let explanation = sorted[0]?.text ?? "";
  if (sorted[1] && sorted[1].p < 9 && (explanation + sorted[1].text).length < 190) explanation += " " + sorted[1].text;
  if (!explanation) explanation = `${d.routable.length} healthy targets share ${fmt(s.traffic)} req/min evenly.`;

  return { nodes: nv, edges: ev, metrics, explanation };
}

const base = { min: 2, max: 4 };

const scenarios: Scenario<AsgEvent>[] = [
  {
    id: "normal",
    title: "Normal traffic",
    summary: "How a load balancer shares requests",
    problem: "Two EC2 instances sit behind an Application Load Balancer. How do incoming requests get shared out?",
    learned:
      "The ALB spreads requests across every healthy registered target. While demand fits within capacity, nothing needs to scale.",
    length: 8,
    initial: { ...base, traffic: 1200, desired: 2, running: 2 },
    script: { 3: [{ type: "traffic", rpm: 1600 }], 5: [{ type: "traffic", rpm: 1000 }], 7: [{ type: "traffic", rpm: 1300 }] },
  },
  {
    id: "scale-out",
    title: "Traffic surge",
    summary: "Scale out as demand grows",
    problem: "A campaign goes live and demand more than doubles. Two instances are about to run out of headroom.",
    learned:
      "Scaling isn't instant. Auto Scaling sees high CPU, raises desired capacity, and new instances must boot and pass health checks before they take traffic. The maximum caps how far it can go.",
    length: 10,
    initial: { ...base, traffic: 1200, desired: 2, running: 2 },
    script: { 2: [{ type: "traffic", rpm: 2800 }] },
  },
  {
    id: "scale-in",
    title: "Traffic drops",
    summary: "Scale in when demand falls",
    problem: "The sale is over and traffic falls away, but four instances are still running and costing money.",
    learned:
      "Scale-in is deliberately cautious: it waits for several low readings, then drains instances so in-flight requests finish. It never goes below the minimum.",
    length: 10,
    initial: { ...base, traffic: 3300, desired: 4, running: 4 },
    script: { 2: [{ type: "traffic", rpm: 800 }] },
  },
  {
    id: "unhealthy",
    title: "Unhealthy instance",
    summary: "Health checks and replacement",
    problem: "One of three instances is about to crash. What happens to the requests it was serving?",
    learned:
      "The ALB needs repeated failed checks before it removes a target, so a few requests fail first. Then it stops routing to it and Auto Scaling replaces it to restore desired capacity. The replacement takes no traffic until it passes health checks.",
    length: 9,
    initial: { ...base, traffic: 2000, desired: 3, running: 3 },
    script: { 2: [{ type: "fail", slot: 1 }] },
  },
  {
    id: "sandbox",
    title: "Sandbox",
    summary: "Change traffic, break things",
    problem: "Your turn. Drag the traffic slider or fail an instance and watch how the system responds.",
    learned: "",
    length: null,
    initial: { ...base, traffic: 1200, desired: 2, running: 2 },
    script: {},
  },
];

export const autoscalingLesson: Lesson<AsgState, AsgEvent> = {
  slug: "aws-auto-scaling",
  topic: "AWS",
  title: "Load Balancing & Auto Scaling",
  nodes,
  edges,
  scenarios,
  interventions: [
    {
      type: "slider",
      id: "traffic",
      label: "Traffic",
      min: 400,
      max: 6000,
      step: 100,
      read: (s) => s.traffic,
      format: (v) => `${fmt(v)} req/min`,
      toEvents: (v) => [{ type: "traffic", rpm: v }],
    },
    {
      type: "button",
      id: "fail",
      label: "Fail an instance",
      disabled: (s) => !s.instances.some((i) => i.phase === "healthy" && !i.fault),
      toEvents: (s) => {
        const target = [...s.instances].reverse().find((i) => i.phase === "healthy" && !i.fault);
        return target ? [{ type: "fail", slot: target.slot }] : [];
      },
    },
  ],
  init: createState,
  apply,
  tick,
  project,
};
