import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { glassBadgeClassName, glassButtonClassName, glassChipClassName, glassPillClassName } from "@/lib/glass-ui";
import { cn } from "@/lib/utils";

type GlassSurfaceProps = React.HTMLAttributes<HTMLElement> & {
  asChild?: boolean;
};

export function GlassButton({
  asChild = false,
  cart = false,
  className,
  ...props
}: GlassSurfaceProps & { cart?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={glassButtonClassName({ cart, className })} {...props} />;
}

export function GlassPill({ asChild = false, className, ...props }: GlassSurfaceProps) {
  const Comp = asChild ? Slot : "span";
  return <Comp className={glassPillClassName(className)} {...props} />;
}

export function GlassBadge({ asChild = false, className, ...props }: GlassSurfaceProps) {
  const Comp = asChild ? Slot : "span";
  return <Comp className={glassBadgeClassName(className)} {...props} />;
}

export function GlassChip({ asChild = false, className, ...props }: GlassSurfaceProps) {
  const Comp = asChild ? Slot : "span";
  return <Comp className={glassChipClassName(className)} {...props} />;
}

export function GlassInteractive({
  asChild = false,
  variant = "button",
  cart = false,
  className,
  ...props
}: GlassSurfaceProps & { variant?: "button" | "pill" | "badge" | "chip"; cart?: boolean }) {
  const Comp = asChild ? Slot : variant === "button" ? "button" : "span";
  const resolvedClassName =
    variant === "pill"
      ? glassPillClassName(className)
      : variant === "badge"
        ? glassBadgeClassName(className)
        : variant === "chip"
          ? glassChipClassName(className)
          : glassButtonClassName({ cart, className });

  return <Comp className={cn(resolvedClassName)} {...props} />;
}
