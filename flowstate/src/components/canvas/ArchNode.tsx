"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { motion } from "motion/react";
import type { NodeDef, NodeView } from "@/engine/types";
import { Icon, toneColor } from "./shared";

export type ArchNodeData = { def: NodeDef; view: NodeView } & Record<string, unknown>;
export type ArchNodeType = Node<ArchNodeData, "arch">;

const hidden = "!pointer-events-none !h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0";

function Badge({ view }: { view: NodeView }) {
  if (!view.badge) return null;
  const c = toneColor[view.tone];
  return (
    <motion.span
      key={view.badge}
      initial={{ opacity: 0, y: -3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="shrink-0 whitespace-nowrap rounded-full px-2 py-[3px] font-mono text-[10.5px] font-medium leading-none"
      style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 35%, transparent)` }}
    >
      {view.badge}
    </motion.span>
  );
}

function Meter({ view }: { view: NodeView }) {
  if (!view.meter) return null;
  const c = view.meter.pct > 85 ? toneColor.error : view.meter.pct > 60 ? toneColor.warning : toneColor[view.tone];
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="w-7 font-mono text-[10px] text-dim">{view.meter.label}</span>
      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-stroke">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(100, view.meter.pct))}%`, background: c }} />
      </div>
      <span className="w-14 text-right font-mono text-[10px] text-dim">{view.meter.text}</span>
    </div>
  );
}

export function ArchNode({ data, selected }: NodeProps<ArchNodeType>) {
  const { def, view } = data;

  if (def.kind === "boundary") {
    const region = def.boundary === "region";
    return (
      <div
        className="relative h-full w-full rounded-2xl"
        style={{
          border: region ? "1px solid var(--stroke)" : "1px dashed color-mix(in srgb, var(--tone-healthy) 40%, transparent)",
          background: region ? "rgba(255,255,255,0.012)" : "color-mix(in srgb, var(--tone-healthy) 3%, transparent)",
        }}
      >
        <span className="absolute left-4 top-3 font-mono text-[10.5px] uppercase tracking-[0.12em]" style={{ color: region ? "var(--text-dim)" : "color-mix(in srgb, var(--tone-healthy) 80%, white)" }}>
          {def.label}
        </span>
      </div>
    );
  }

  const c = toneColor[view.tone];
  const ghost = view.ghost;
  const isServer = def.kind === "server";

  return (
    <motion.div
      initial={false}
      animate={{ opacity: ghost ? 0.5 : 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative h-full w-full rounded-xl px-3.5 py-3 text-text transition-colors duration-500"
      style={{
        background: ghost ? "transparent" : "var(--surface)",
        border: `1px ${ghost ? "dashed" : "solid"} ${selected ? "var(--teal-soft)" : ghost ? "var(--stroke)" : `color-mix(in srgb, ${c} ${view.tone === "idle" ? 28 : 55}%, var(--stroke))`}`,
        boxShadow: selected ? "0 0 0 3px color-mix(in srgb, var(--teal) 25%, transparent)" : "none",
      }}
    >
      <Handle type="target" position={Position.Left} className={hidden} isConnectable={false} />
      <Handle type="source" position={Position.Right} className={hidden} isConnectable={false} />

      <div className="flex items-center gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors duration-500"
          style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: ghost ? "var(--text-dim)" : c }}
        >
          <Icon name={def.icon ?? "server"} size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[13px] font-medium leading-tight">
              {def.kind === "capacity" ? view.headline : def.label}
            </p>
            <Badge view={view} />
          </div>
          <p className="mt-0.5 truncate text-[11.5px] leading-tight text-dim">{view.subtitle ?? def.sublabel}</p>
        </div>
      </div>

      {def.kind === "capacity" && view.pips && (
        <div className="absolute right-3.5 top-[34px] flex gap-1" aria-hidden>
          {view.pips.map((t, i) => (
            <span key={i} className="h-[5px] w-5 rounded-full transition-colors duration-500" style={{ background: t === "inactive" ? "var(--stroke)" : toneColor[t] }} />
          ))}
        </div>
      )}
      {(isServer || def.id === "policy") && <Meter view={view} />}
    </motion.div>
  );
}
