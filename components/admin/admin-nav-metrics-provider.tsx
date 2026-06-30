"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AdminNavMetrics = {
  pendingSupplierApprovals: number;
};

const AdminNavMetricsContext = createContext<AdminNavMetrics>({ pendingSupplierApprovals: 0 });

export function AdminNavMetricsProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<AdminNavMetrics>({ pendingSupplierApprovals: 0 });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    function refresh() {
      fetch("/api/admin/nav-metrics", { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { pendingSupplierApprovals: 0 }))
        .then((payload) => {
          if (!active) return;
          setMetrics({
            pendingSupplierApprovals: Number(payload.pendingSupplierApprovals ?? 0)
          });
        })
        .catch(() => undefined);
    }

    refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  const value = useMemo(() => metrics, [metrics.pendingSupplierApprovals]);
  return <AdminNavMetricsContext.Provider value={value}>{children}</AdminNavMetricsContext.Provider>;
}

export function useAdminNavMetrics() {
  return useContext(AdminNavMetricsContext);
}
