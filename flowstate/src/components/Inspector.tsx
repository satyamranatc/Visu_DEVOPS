"use client";

import { AnimatePresence, motion } from "motion/react";
import type { NodeDef, NodeView } from "@/engine/types";
import { Icon, toneColor } from "./canvas/shared";

export function Inspector({ def, view, onClose }: { def: NodeDef | null; view?: NodeView; onClose: () => void }) {
  return (
    <AnimatePresence>
      {def && (
        <motion.aside
          key={def.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          aria-label={`${def.label} details`}
          className="absolute right-4 top-4 z-10 max-h-[calc(100%-2rem)] w-[320px] overflow-y-auto rounded-2xl border border-stroke bg-surface/95 p-5 text-text shadow-2xl backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2" style={{ color: toneColor[view?.tone ?? "idle"] }}>
              <Icon name={def.icon ?? "server"} size={21} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-medium leading-tight">{def.id.startsWith("ec2") ? def.label : def.label}</h2>
              {view?.badge && (
                <p className="mt-1 font-mono text-[11px]" style={{ color: toneColor[view.tone] }}>
                  {view.badge}
                </p>
              )}
            </div>
            <button onClick={onClose} aria-label="Close details" className="rounded-md p-1 text-dim hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-teal">
              <svg width="16" height="16" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="m4 4 8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {def.info && <p className="mt-4 text-[13px] leading-relaxed text-[#c3cbce]">{def.info.purpose}</p>}

          {view?.details && (
            <section className="mt-5">
              <h3 className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dim">Live state</h3>
              <dl className="mt-2 divide-y divide-stroke rounded-lg border border-stroke">
                {view.details.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 px-3 py-2 text-[12.5px]">
                    <dt className="text-dim">{k}</dt>
                    <dd className="text-right font-mono text-text">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {def.info && (
            <>
              <List title="Inputs" items={def.info.inputs} />
              <List title="Outputs" items={def.info.outputs} />
              <section className="mt-5">
                <h3 className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dim">In the real world</h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-[#c3cbce]">{def.info.example}</p>
              </section>
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-5">
      <h3 className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dim">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((i) => (
          <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-[#c3cbce]">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-teal" />
            {i}
          </li>
        ))}
      </ul>
    </section>
  );
}
