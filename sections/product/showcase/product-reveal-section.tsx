"use client";

import { useRevealOnScroll } from "@/hooks/use-reveal-on-scroll";
import { cn } from "@/lib/utils";
import styles from "./product-showcase.module.css";

export function ProductRevealSection({
  children,
  className,
  id
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const { ref, visible } = useRevealOnScroll<HTMLElement>();
  return (
    <section
      id={id}
      ref={ref}
      className={cn(styles.reveal, visible && styles.revealVisible, className)}
    >
      {children}
    </section>
  );
}
