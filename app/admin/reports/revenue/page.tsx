import { ReportPageShell } from "@/components/admin/report-page-shell";
import { MetricGrid } from "@/components/platform";
import { formatINR } from "@/lib/utils";
import { getSalesReportSummary } from "@/services/reports";

export default async function RevenueReportPage() {
  const sales = await getSalesReportSummary();
  return (
    <ReportPageShell title="Revenue" description="Across paid and fulfilled order statuses.">
      <MetricGrid metrics={[{ label: "Total revenue", value: formatINR(sales.revenue), detail: `${sales.totalOrders} orders` }]} />
    </ReportPageShell>
  );
}
