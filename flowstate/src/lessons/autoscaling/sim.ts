/**
 * Deterministic ALB + Auto Scaling Group simulation.
 *
 * Key modelling choices (kept deliberately close to real AWS behaviour):
 *  - Desired capacity, running instances, registered targets and healthy
 *    targets are four different numbers.
 *  - New instances go pending -> initial (health checks) -> healthy over time;
 *    they receive no traffic until healthy.
 *  - The ALB needs two failed checks before it marks a target unhealthy, so a
 *    failing instance still receives (and fails) requests for a while.
 *  - Target tracking scales out immediately, but scales in only after several
 *    consecutive low readings, and both respect a cooldown.
 */

export const CAPACITY_RPM = 1500; // requests/min an instance handles at 100% CPU
export const TARGET_CPU = 60;
export const SLOTS = 4;
const SCALE_IN_READINGS = 3;
const COOLDOWN = 2;

export type Phase = "empty" | "pending" | "initial" | "healthy" | "unhealthy" | "draining";

export interface Instance {
  slot: number;
  phase: Phase;
  fault: boolean;
  failedChecks: number;
}

export interface Note {
  p: number; // lower = more important
  text: string;
}

export interface AsgState {
  tick: number;
  traffic: number;
  desired: number;
  min: number;
  max: number;
  cooldown: number;
  lowReadings: number;
  instances: Instance[];
  notes: Note[];
}

export type AsgEvent = { type: "traffic"; rpm: number } | { type: "fail"; slot: number };

export const ec2Name = (slot: number) => `EC2 0${slot + 1}`;
export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function createState(p: Record<string, number>): AsgState {
  return {
    tick: 0,
    traffic: p.traffic,
    desired: p.desired,
    min: p.min,
    max: p.max,
    cooldown: 0,
    lowReadings: 0,
    instances: Array.from({ length: SLOTS }, (_, slot) => ({
      slot,
      phase: slot < p.running ? ("healthy" as Phase) : ("empty" as Phase),
      fault: false,
      failedChecks: 0,
    })),
    notes: [],
  };
}

const clone = (s: AsgState): AsgState => ({
  ...s,
  instances: s.instances.map((i) => ({ ...i })),
  notes: [...s.notes],
});

export function derive(s: AsgState) {
  const by = (...p: Phase[]) => s.instances.filter((i) => p.includes(i.phase));
  const routable = by("healthy"); // what the ALB believes is healthy
  const working = routable.filter((i) => !i.fault);
  const share = routable.length ? s.traffic / routable.length : 0;
  const rawCpu = (share / CAPACITY_RPM) * 100;
  const saturated = rawCpu > 100;
  const dropped = saturated ? 1 - 100 / rawCpu : 0;
  const faultShare = routable.length ? (routable.length - working.length) / routable.length : 0;
  const errorRate = routable.length
    ? Math.min(1, faultShare + (1 - faultShare) * dropped)
    : s.traffic > 0
      ? 1
      : 0;
  return {
    routable,
    working,
    share,
    rawCpu,
    cpu: working.length ? Math.min(100, rawCpu) : 0,
    saturated,
    errorRate,
    pending: by("pending").length,
    running: by("initial", "healthy", "unhealthy").length,
    registered: by("initial", "healthy", "unhealthy").length,
    active: by("pending", "initial", "healthy").length,
  };
}

export function apply(s0: AsgState, events: AsgEvent[]): AsgState {
  const s = clone(s0);
  for (const e of events) {
    if (e.type === "traffic") {
      s.traffic = e.rpm;
      s.notes.push({ p: 6, text: `Traffic changes to ${fmt(e.rpm)} req/min.` });
    } else {
      const inst = s.instances[e.slot];
      if (inst && inst.phase === "healthy" && !inst.fault) {
        inst.fault = true;
        inst.failedChecks = 0;
        s.notes.push({
          p: 1,
          text: `${ec2Name(e.slot)} stops responding. The load balancer hasn't noticed yet.`,
        });
      }
    }
  }
  return s;
}

export function tick(s0: AsgState, events: AsgEvent[] = []): AsgState {
  let s = clone({ ...s0, tick: s0.tick + 1, notes: [] });
  s = apply(s, events);
  const note = (p: number, text: string) => s.notes.push({ p, text });

  // 1. Instances progress through their lifecycle.
  const booted: string[] = [];
  const passed: string[] = [];
  const gone: string[] = [];
  for (const inst of s.instances) {
    const n = ec2Name(inst.slot);
    switch (inst.phase) {
      case "pending":
        inst.phase = "initial";
        booted.push(n);
        break;
      case "initial":
        inst.phase = "healthy";
        passed.push(n);
        break;
      case "healthy":
        if (inst.fault) {
          inst.failedChecks += 1;
          if (inst.failedChecks >= 2) {
            inst.phase = "unhealthy";
            note(1, `After 2 failed checks the ALB marks ${n} unhealthy and stops routing to it.`);
          } else {
            note(1, `${n} is failing but still gets its share of requests, so some return errors.`);
          }
        }
        break;
      case "unhealthy":
        inst.phase = "draining";
        inst.fault = false;
        note(1, `Auto Scaling terminates unhealthy ${n}.`);
        break;
      case "draining":
        inst.phase = "empty";
        inst.fault = false;
        inst.failedChecks = 0;
        gone.push(n);
        break;
    }
  }
  const join = (xs: string[]) => xs.join(" and ");
  if (passed.length) note(3, `${join(passed)} passed health checks, so the ALB starts sending ${passed.length > 1 ? "them" : "it"} requests.`);
  if (booted.length) note(4, `${join(booted)} booted and ${booted.length > 1 ? "are" : "is"} running first health checks. No traffic yet.`);
  if (gone.length) note(5, `${join(gone)} deregistered and terminated.`);

  // 2. Target tracking policy reads CPU and may change desired capacity.
  const d = derive(s);
  if (s.cooldown > 0) {
    s.cooldown -= 1;
  } else {
    const needed = Math.min(s.max, Math.max(s.min, Math.ceil(s.traffic / ((CAPACITY_RPM * TARGET_CPU) / 100))));
    if (d.cpu > TARGET_CPU && needed > s.desired) {
      note(
        2,
        `CPU is ${Math.round(d.cpu)}%, above the ${TARGET_CPU}% target. Desired capacity goes ${s.desired} \u2192 ${needed}.`,
      );
      s.desired = needed;
      s.cooldown = COOLDOWN;
      s.lowReadings = 0;
    } else if (d.cpu > 0 && d.cpu < TARGET_CPU / 2 && needed < s.desired) {
      s.lowReadings += 1;
      if (s.lowReadings >= SCALE_IN_READINGS) {
        note(
          2,
          `CPU stayed low (${Math.round(d.cpu)}%) for ${SCALE_IN_READINGS} readings. Desired capacity goes ${s.desired} \u2192 ${needed}.`,
        );
        s.desired = needed;
        s.cooldown = COOLDOWN;
        s.lowReadings = 0;
      } else {
        note(
          3,
          `CPU is only ${Math.round(d.cpu)}%, but scale-in waits for ${SCALE_IN_READINGS - s.lowReadings} more low reading${SCALE_IN_READINGS - s.lowReadings > 1 ? "s" : ""} to avoid flapping.`,
        );
      }
    } else {
      s.lowReadings = 0;
    }
  }

  // 3. The ASG reconciles running capacity with desired capacity.
  const active = s.instances.filter((i) => ["pending", "initial", "healthy"].includes(i.phase));
  if (active.length < s.desired) {
    const launched: number[] = [];
    for (const inst of s.instances) {
      if (launched.length >= s.desired - active.length) break;
      if (inst.phase === "empty") {
        inst.phase = "pending";
        launched.push(inst.slot);
      }
    }
    if (launched.length) {
      const names = launched.map(ec2Name).join(" and ");
      const replacing = !s.notes.some((x) => x.p === 2);
      note(
        replacing ? 2 : 3,
        replacing
          ? `Auto Scaling launches ${names} to get back to ${s.desired} instances.`
          : `Launching ${names}. New instances start pending and take no traffic until healthy.`,
      );
    }
  } else if (active.length > s.desired) {
    const victims = [...active].sort((a, b) => b.slot - a.slot).slice(0, active.length - s.desired);
    victims.forEach((v) => (v.phase = "draining"));
    note(
      2,
      `Auto Scaling drains ${victims.map((v) => ec2Name(v.slot)).join(" and ")}. In-flight requests finish before they terminate.`,
    );
  }

  // 4. Steady-state or overload commentary.
  const f = derive(s);
  if (f.saturated) {
    note(
      3,
      `Demand exceeds capacity: instances are at 100% CPU and about ${Math.round(f.errorRate * 100)}% of requests fail or time out.${s.desired >= s.max ? ` Desired capacity is already at its maximum (${s.max}).` : ""}`,
    );
  }
  note(
    9,
    f.routable.length
      ? `${f.routable.length} healthy target${f.routable.length > 1 ? "s" : ""} share ${fmt(s.traffic)} req/min evenly, about ${fmt(f.share)} each at ${Math.round(f.cpu)}% CPU.`
      : `No healthy targets: the ALB has nowhere to send requests.`,
  );
  return s;
}
