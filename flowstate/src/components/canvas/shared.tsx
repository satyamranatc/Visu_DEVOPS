"use client";

import { createContext, useContext } from "react";
import type { IconName, Tone } from "@/engine/types";

export const toneColor: Record<Tone, string> = {
  healthy: "var(--tone-healthy)",
  warning: "var(--tone-warning)",
  error: "var(--tone-error)",
  pending: "var(--tone-pending)",
  idle: "var(--tone-idle)",
  inactive: "var(--tone-inactive)",
};

export interface PlaybackCtx {
  playing: boolean;
  speed: number;
  reduced: boolean;
}
export const PlaybackContext = createContext<PlaybackCtx>({ playing: true, speed: 1, reduced: false });
export const usePlayback = () => useContext(PlaybackContext);

const paths: Record<IconName, React.ReactNode> = {
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M17.5 13.6c2.2.3 3.8 1.9 3.8 4.4" />
    </>
  ),
  balancer: (
    <>
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="5" cy="19" r="2.2" />
      <circle cx="19" cy="19" r="2.2" />
      <path d="M12 7.2v4.3M12 11.5 5 16.8M12 11.5l7 5.3" />
    </>
  ),
  server: (
    <>
      <rect x="3.5" y="4" width="17" height="6.5" rx="1.6" />
      <rect x="3.5" y="13.5" width="17" height="6.5" rx="1.6" />
      <path d="M7 7.2h.01M7 16.8h.01M11 7.2h6M11 16.8h6" />
    </>
  ),
  policy: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="M12 17 16.5 10.5" />
      <circle cx="12" cy="17" r="1.1" />
    </>
  ),
  capacity: (
    <>
      <rect x="3.5" y="5" width="7" height="6" rx="1.4" />
      <rect x="13.5" y="5" width="7" height="6" rx="1.4" />
      <rect x="3.5" y="14" width="7" height="6" rx="1.4" strokeDasharray="2 2" />
      <rect x="13.5" y="14" width="7" height="6" rx="1.4" strokeDasharray="2 2" />
    </>
  ),
  container: (
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.8" />
      <path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" />
    </>
  ),
  queue: (
    <>
      <rect x="3" y="7" width="4.5" height="10" rx="1" />
      <rect x="9.75" y="7" width="4.5" height="10" rx="1" />
      <rect x="16.5" y="7" width="4.5" height="10" rx="1" />
    </>
  ),
};

export function Icon({ name, size = 20, color = "currentColor" }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}
