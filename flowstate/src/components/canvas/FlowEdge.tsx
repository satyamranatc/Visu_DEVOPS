"use client";

import { useEffect, useRef } from "react";
import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import type { EdgeTone, EdgeView } from "@/engine/types";
import { usePlayback } from "./shared";

export type FlowEdgeData = { view: EdgeView } & Record<string, unknown>;
export type FlowEdgeType = Edge<FlowEdgeData, "flow">;

const style: Record<EdgeTone, { stroke: string; dot: string; dash?: string; opacity: number }> = {
  flow: { stroke: "#1c9995", dot: "#7ae6e1", opacity: 0.4 },
  error: { stroke: "#e5645a", dot: "#ff8b82", opacity: 0.5 },
  probe: { stroke: "#7b93b8", dot: "#a9bddb", dash: "4 5", opacity: 0.6 },
  blocked: { stroke: "#e5645a", dot: "#e5645a", dash: "3 6", opacity: 0.45 },
  draining: { stroke: "#d9a441", dot: "#d9a441", dash: "3 6", opacity: 0.5 },
  control: { stroke: "#1c9995", dot: "#7ae6e1", dash: "5 5", opacity: 0.55 },
  idle: { stroke: "#3a444a", dot: "#3a444a", opacity: 0.5 },
};

export function FlowEdge(props: EdgeProps<FlowEdgeType>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const view = data?.view;
  const { playing, speed, reduced } = usePlayback();
  const ref = useRef<SVGGElement>(null);
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.3 });
  const s = style[view?.tone ?? "idle"];
  const dots = view?.dots ?? 0;
  const dur = 2.2 / speed;

  // Freeze SMIL timelines when paused so markers stop mid-path.
  useEffect(() => {
    const svg = ref.current?.ownerSVGElement;
    if (!svg) return;
    if (playing && !reduced) svg.unpauseAnimations();
    else svg.pauseAnimations();
  }, [playing, reduced, dots, path, speed]);

  if (!view || view.hidden) return null;

  return (
    <g ref={ref}>
      <BaseEdge id={id} path={path} style={{ stroke: s.stroke, strokeOpacity: s.opacity, strokeWidth: 1.6, strokeDasharray: s.dash }} />
      {!reduced &&
        Array.from({ length: dots }, (_, i) => (
          <circle key={`${view.tone}-${i}`} r={view.tone === "probe" ? 2.5 : 3.4} fill={view.tone === "probe" ? "none" : s.dot} stroke={view.tone === "probe" ? s.dot : "none"} strokeWidth={1.2}>
            <animateMotion dur={`${dur * (view.tone === "probe" ? 1.6 : 1)}s`} begin={`${-(i * dur) / dots}s`} repeatCount="indefinite" path={path} />
          </circle>
        ))}
      {view.tone === "blocked" && (
        <g transform={`translate(${labelX} ${labelY})`}>
          <circle r="8" fill="#111517" stroke="#e5645a" strokeOpacity="0.7" />
          <path d="M-3 -3 3 3M3 -3-3 3" stroke="#e5645a" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}
