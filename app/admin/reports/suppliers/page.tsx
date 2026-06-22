import { ReportPageShell } from "@/components/admin/report-page-shell";
import { MetricGrid } from "@/components/platform";
import { getSupplierReportSummary } from "@/services/reports";

export default async function SuppliersReportPage() {
  const suppliers = await getSupplierReportSummary();
  return (
    <ReportPageShell title="Supplier throughput">
      <MetricGrid
        metrics={[
          { label: "Total products", value: String(suppliers.total) },
          { label: "Awaiting review", value: String(suppliers.pending) },
          { label: "Published", value: String(suppliers.published) }
        ]}
      />
    </ReportPageShell>
  );
}
