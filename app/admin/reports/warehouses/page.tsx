import { ReportPageShell } from "@/components/admin/report-page-shell";
import { MetricGrid } from "@/components/platform";
import { getInventoryReportSummary } from "@/services/reports";

export default async function WarehousesReportPage() {
  const inventory = await getInventoryReportSummary();
  return (
    <ReportPageShell title="Warehouse readiness" description="Stock alerts requiring warehouse attention.">
      <MetricGrid metrics={[{ label: "Low-stock SKUs", value: String(inventory.lowStock) }]} />
    </ReportPageShell>
  );
}
