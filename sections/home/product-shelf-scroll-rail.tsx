"use client";

import { useCallback, useRef, type ReactNode } from "react";

type ProductShelfScrollRailProps = {
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  "data-testid"?: string;
  "data-shelf-layout"?: string;
};

export function ProductShelfScrollRail({
  className,
  children,
  "aria-label": ariaLabel,
  "data-testid": testId,
  "data-shelf-layout": shelfLayout
}: ProductShelfScrollRailProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const touchRef = useRef({ x: 0, y: 0, swiped: false });

  const onTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchRef.current = { x: touch.clientX, y: touch.clientY, swiped: false };
  }, []);

  const onTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchRef.current.x;
    const deltaY = touch.clientY - touchRef.current.y;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
      touchRef.current.swiped = true;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    window.setTimeout(() => {
      touchRef.current.swiped = false;
    }, 80);
  }, []);

  const onClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!touchRef.current.swiped) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return (
    <div
      ref={railRef}
      className={className}
      data-testid={testId}
      data-shelf-layout={shelfLayout}
      aria-label={ariaLabel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onClickCapture={onClickCapture}
    >
      {children}
    </div>
  );
}
