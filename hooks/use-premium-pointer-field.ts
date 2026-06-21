"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type PremiumPointerOptions = {
  disabled?: boolean;
  intensity?: number;
};

type PointerState = {
  active: boolean;
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function writePointerState(node: HTMLElement, state: PointerState, intensity: number) {
  const active = state.active ? 1 : 0;
  const dx = state.x - 0.5;
  const dy = state.y - 0.5;

  node.style.setProperty("--premium-pointer-x", `${(state.x * 100).toFixed(2)}%`);
  node.style.setProperty("--premium-pointer-y", `${(state.y * 100).toFixed(2)}%`);
  node.style.setProperty("--premium-hover-active", String(active));
  node.style.setProperty("--premium-light-opacity", state.active ? "0.58" : "0");
  node.style.setProperty("--premium-depth-x", `${(dx * 14 * intensity).toFixed(2)}px`);
  node.style.setProperty("--premium-depth-y", `${(dy * 10 * intensity).toFixed(2)}px`);
  node.style.setProperty("--premium-depth-x-soft", `${(dx * 5 * intensity).toFixed(2)}px`);
  node.style.setProperty("--premium-depth-y-soft", `${(dy * 4 * intensity).toFixed(2)}px`);
  node.style.setProperty("--premium-depth-x-inverse", `${(dx * -6 * intensity).toFixed(2)}px`);
  node.style.setProperty("--premium-depth-y-inverse", `${(dy * -4 * intensity).toFixed(2)}px`);
  node.style.setProperty("--premium-fog-x", `${(dx * -18 * intensity).toFixed(2)}px`);
  node.style.setProperty("--premium-fog-y", `${(dy * -8 * intensity).toFixed(2)}px`);
  node.style.setProperty("--premium-tilt-x", `${(dy * -1.8 * intensity).toFixed(3)}deg`);
  node.style.setProperty("--premium-tilt-y", `${(dx * 2.2 * intensity).toFixed(3)}deg`);
  node.style.setProperty("--premium-shadow-x", `${(dx * -16 * intensity).toFixed(2)}px`);
  node.style.setProperty("--premium-shadow-y", `${(18 + dy * 12 * intensity).toFixed(2)}px`);
}

export function usePremiumPointerField<T extends HTMLElement>({
  disabled = false,
  intensity = 1
}: PremiumPointerOptions = {}) {
  const frameRef = useRef<number | null>(null);
  const nodeRef = useRef<HTMLElement | null>(null);
  const stateRef = useRef<PointerState>({ active: false, x: 0.5, y: 0.5 });

  const scheduleWrite = useCallback((node: HTMLElement, state: PointerState) => {
    nodeRef.current = node;
    stateRef.current = state;

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const target = nodeRef.current;
      if (!target) return;
      writePointerState(target, stateRef.current, intensity);
    });
  }, [intensity]);

  const onPointerMove = useCallback((event: ReactPointerEvent<T>) => {
    if (disabled || event.pointerType === "touch") return;
    const node = event.currentTarget;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    scheduleWrite(node, {
      active: true,
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
    });
  }, [disabled, scheduleWrite]);

  const onPointerEnter = useCallback((event: ReactPointerEvent<T>) => {
    if (disabled || event.pointerType === "touch") return;
    scheduleWrite(event.currentTarget, { ...stateRef.current, active: true });
  }, [disabled, scheduleWrite]);

  const onPointerLeave = useCallback((event: ReactPointerEvent<T>) => {
    if (disabled || event.pointerType === "touch") return;
    scheduleWrite(event.currentTarget, { active: false, x: 0.5, y: 0.5 });
  }, [disabled, scheduleWrite]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return {
    onPointerEnter,
    onPointerLeave,
    onPointerMove
  };
}
