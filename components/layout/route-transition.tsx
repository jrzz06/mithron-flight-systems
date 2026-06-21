"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isOperationalShellRoute } from "@/lib/ui/shell-routes";

let hasHydratedRouteTransition = false;

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [animateEntry] = useState(() => hasHydratedRouteTransition);

  useEffect(() => {
    hasHydratedRouteTransition = true;
  }, []);

  if (pathname === "/" || isOperationalShellRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div
      data-route-transition={animateEntry ? "route-entry" : "initial-paint"}
    >
      {children}
    </div>
  );
}
