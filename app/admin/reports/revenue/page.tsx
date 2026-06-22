import { ReportPageShell } from "@/components/admin/report-page-shell";
import { MetricGrid } from "@/components/platform";
import { getSalesReportSummary } from "@/services/reports";

export default async function RevenueReportPage() {
  const sales = await getSalesReportSummary();
  return (
    <ReportPageShell title="Revenue" description="Across paid and fulfilled order statuses.">
      <MetricGrid metrics={[{ label: "Total revenue", value: `₹${sales.revenue.toFixed(0)}`, detail: `${sales.totalOrders} orders` }]} />
    </ReportPageShell>
  );
}
