import { ReportPageShell } from "@/components/admin/report-page-shell";
import { MetricGrid } from "@/components/platform";
import { getInventoryReportSummary } from "@/services/reports";

export default async function InventoryReportPage() {
  const inventory = await getInventoryReportSummary();
  return (
    <ReportPageShell title="Inventory health">
      <MetricGrid
        metrics={[
          { label: "Low stock", value: String(inventory.lowStock) },
          { label: "Out of stock", value: String(inventory.outOfStock) }
        ]}
      />
    </ReportPageShell>
  );
}
