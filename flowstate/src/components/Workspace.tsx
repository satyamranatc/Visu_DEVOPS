"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ReactFlowProvider } from "@xyflow/react";
import type { AnyLesson } from "@/lessons";
import { useSimulation } from "@/engine/useSimulation";
import { ArchCanvas } from "./canvas/ArchCanvas";
import { PlaybackContext, toneColor } from "./canvas/shared";
import { Inspector } from "./Inspector";

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

const btn =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-stroke bg-surface px-3 text-[12.5px] font-medium text-text transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-40";

export function Workspace({ lesson }: { lesson: AnyLesson }) {
  const reduced = usePrefersReducedMotion();
  const sim = useSimulation(lesson, reduced);
  const { scenario, projection } = sim;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const on = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  // Keyboard: Space play/pause, \u2192 step, R reset, F fullscreen, Esc closes panels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "BUTTON" && e.key === " ") return;
      if (e.key === " ") { e.preventDefault(); sim.togglePlay(); }
      else if (e.key === "ArrowRight") sim.step();
      else if (e.key === "r" || e.key === "R") sim.reset();
      else if (e.key === "f" || e.key === "F") toggleFull();
      else if (e.key === "Escape") { setSelectedId(null); setMenuOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const selectedDef = lesson.nodes.find((n) => n.id === selectedId) ?? null;
  const total = scenario.length;
  const eyebrow = sim.finished ? "What you learned" : sim.sim.tick === 0 && sim.sim.notes.length === 0 ? "The problem" : total ? `Step ${sim.sim.tick} of ${total}` : `Step ${sim.sim.tick}`;
  const sentence = sim.finished ? scenario.learned : sim.sim.tick === 0 && sim.sim.notes.length === 0 ? scenario.problem : projection.explanation;

  return (
    <PlaybackContext.Provider value={{ playing: sim.playing, speed: sim.speed, reduced }}>
      <MotionConfig reducedMotion="user">
        <div ref={rootRef} className="flex h-dvh flex-col bg-canvas text-text">
          {/* Top bar */}
          <header className="relative z-20 flex h-12 shrink-0 items-center gap-3 border-b border-stroke px-4">
            <Link href="/" className="flex items-center gap-2 rounded-md text-[14px] font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-teal">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-teal text-[11px] font-bold text-white">F</span>
              Flowstate
            </Link>
            <span className="h-4 w-px bg-stroke" />
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">{lesson.topic}</span>
            <h1 className="text-[13px] font-medium">{lesson.title}</h1>

            <div className="relative ml-2">
              <button
                id="scenario-menu-button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
                className={btn}
              >
                <span className="font-mono text-[11px] text-dim">
                  {String(sim.scenarioIndex + 1).padStart(2, "0")} / {String(lesson.scenarios.length).padStart(2, "0")}
                </span>
                {scenario.title}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m2 3.5 3 3 3-3" /></svg>
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.ul
                    role="listbox"
                    aria-label="Scenarios"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-10 z-30 w-72 overflow-hidden rounded-xl border border-stroke bg-surface p-1 shadow-2xl"
                  >
                    {lesson.scenarios.map((s, i) => (
                      <li key={s.id} role="option" aria-selected={i === sim.scenarioIndex}>
                        <button
                          onClick={() => { sim.selectScenario(i); setMenuOpen(false); setSelectedId(null); }}
                          className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                        >
                          <span className="mt-0.5 font-mono text-[11px] text-dim">{String(i + 1).padStart(2, "0")}</span>
                          <span>
                            <span className="block text-[13px] font-medium" style={{ color: i === sim.scenarioIndex ? "var(--teal-soft)" : undefined }}>{s.title}</span>
                            <span className="block text-[11.5px] text-dim">{s.summary}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden font-mono text-[10.5px] text-dim lg:block">Space play · → step · R reset · F fullscreen</span>
              <button onClick={sim.reset} className={btn} aria-label="Reset scenario">Reset</button>
              <button onClick={toggleFull} className={btn} aria-label={isFull ? "Exit fullscreen" : "Enter fullscreen"} aria-pressed={isFull}>
                {isFull ? "Exit fullscreen" : "Fullscreen"}
              </button>
            </div>
          </header>

          {/* Canvas */}
          <main className="relative min-h-0 flex-1" aria-label="Architecture simulation">
            <ReactFlowProvider>
              <ArchCanvas
                nodeDefs={lesson.nodes}
                edgeDefs={lesson.edges}
                projection={projection}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </ReactFlowProvider>
            <Inspector def={selectedDef} view={selectedId ? projection.nodes[selectedId] : undefined} onClose={() => setSelectedId(null)} />
            <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full border border-stroke bg-surface/90 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-dim">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: sim.playing ? "var(--teal)" : "var(--tone-idle)" }} />
              Simulation{sim.playing ? "" : " \u00b7 paused"}
            </div>
          </main>

          {/* Bottom dock */}
          <footer className="shrink-0 border-t border-stroke bg-[#0e1214] px-4 py-3">
            <div className="flex items-start justify-between gap-6">
              <div aria-live="polite" className="min-w-0 max-w-3xl">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-teal">{eyebrow}</p>
                <p id="explanation" className="mt-1 min-h-[2.6em] text-[14.5px] leading-snug text-text">{sentence}</p>
              </div>
              <dl className="hidden shrink-0 gap-5 md:flex">
                {projection.metrics.map((m) => (
                  <div key={m.label} className="min-w-[56px]">
                    <dt className="text-[10.5px] text-dim">{m.label}</dt>
                    <dd className="mt-0.5 font-mono text-[15px] tabular-nums transition-colors duration-500" style={{ color: m.tone ? toneColor[m.tone] : "var(--text)" }}>{m.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-stroke pt-3">
              <div className="flex items-center gap-2" role="group" aria-label="Playback controls">
                <button id="play-pause" onClick={sim.togglePlay} className={`${btn} min-w-[84px] !border-teal !bg-teal/15`}>
                  {sim.finished ? "Replay" : sim.playing ? "Pause" : "Play"}
                </button>
                <button id="step" onClick={sim.step} disabled={sim.finished} className={btn}>Step</button>
                <button id="reset" onClick={sim.reset} className={btn}>Reset</button>
                <div className="ml-1 flex overflow-hidden rounded-lg border border-stroke" role="group" aria-label="Simulation speed">
                  {[0.5, 1, 2].map((v) => (
                    <button
                      key={v}
                      onClick={() => sim.setSpeed(v)}
                      aria-pressed={sim.speed === v}
                      className="h-8 px-2.5 font-mono text-[11.5px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal"
                      style={{ background: sim.speed === v ? "var(--surface-2)" : "transparent", color: sim.speed === v ? "var(--text)" : "var(--text-dim)" }}
                    >
                      {v}×
                    </button>
                  ))}
                </div>
              </div>

              {total !== null && (
                <div className="hidden h-1 w-40 overflow-hidden rounded-full bg-stroke lg:block" aria-hidden>
                  <div className="h-full bg-teal transition-all duration-500" style={{ width: `${(sim.sim.tick / total) * 100}%` }} />
                </div>
              )}

              <div className="ml-auto flex flex-wrap items-center gap-4">
                {lesson.interventions.map((iv) =>
                  iv.type === "slider" ? (
                    <label key={iv.id} className="flex items-center gap-3 text-[12px] text-dim">
                      <span>{iv.label}</span>
                      <input
                        id={`ctl-${iv.id}`}
                        className="flow-range w-44"
                        type="range"
                        min={iv.min}
                        max={iv.max}
                        step={iv.step}
                        value={iv.read(sim.sim)}
                        onChange={(e) => sim.intervene(iv.toEvents(Number(e.target.value)))}
                        aria-valuetext={iv.format(iv.read(sim.sim))}
                      />
                      <span className="w-[96px] font-mono text-[12px] text-text">{iv.format(iv.read(sim.sim))}</span>
                    </label>
                  ) : (
                    <button key={iv.id} id={`ctl-${iv.id}`} disabled={iv.disabled(sim.sim)} onClick={() => sim.intervene(iv.toEvents(sim.sim))} className={`${btn} !text-[#ff9b93] hover:!border-[#e5645a]/60`}>
                      {iv.label}
                    </button>
                  ),
                )}
              </div>
            </div>
          </footer>
        </div>
      </MotionConfig>
    </PlaybackContext.Provider>
  );
}
