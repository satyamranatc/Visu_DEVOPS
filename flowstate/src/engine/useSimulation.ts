"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lesson } from "@/engine/types";

const BASE_INTERVAL_MS = 2400;

export function useSimulation<S extends { tick: number; notes: unknown[] }, E>(lesson: Lesson<S, E>, reduced: boolean) {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const scenario = lesson.scenarios[scenarioIndex];
  const [sim, setSim] = useState<S>(() => lesson.init(lesson.scenarios[0].initial));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const finished = scenario.length !== null && sim.tick >= scenario.length;

  const step = useCallback(() => {
    setSim((s) => {
      if (scenario.length !== null && s.tick >= scenario.length) return s;
      return lesson.tick(s, scenario.script[s.tick + 1] ?? []);
    });
  }, [lesson, scenario]);

  const reset = useCallback(
    (index = scenarioIndex) => {
      setScenarioIndex(index);
      setSim(lesson.init(lesson.scenarios[index].initial));
    },
    [lesson, scenarioIndex],
  );

  const selectScenario = useCallback(
    (index: number) => {
      reset(index);
      setPlaying(!reduced);
    },
    [reset, reduced],
  );

  const togglePlay = useCallback(() => {
    if (finished) {
      reset();
      setPlaying(true);
    } else setPlaying((p) => !p);
  }, [finished, reset]);

  const intervene = useCallback((events: E[]) => setSim((s) => lesson.apply(s, events)), [lesson]);

  // Auto-play shortly after mount, unless the user prefers reduced motion.
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setPlaying(true), 700);
    return () => clearTimeout(t);
  }, [reduced]);

  const running = playing && !finished;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(step, BASE_INTERVAL_MS / speed);
    return () => clearInterval(id);
  }, [running, speed, step]);

  const projection = useMemo(() => lesson.project(sim), [lesson, sim]);

  return { scenario, scenarioIndex, sim, projection, playing: running, speed, finished, setSpeed, step: () => { setPlaying(false); step(); }, reset: () => { reset(); setPlaying(false); }, selectScenario, togglePlay, intervene };
}
