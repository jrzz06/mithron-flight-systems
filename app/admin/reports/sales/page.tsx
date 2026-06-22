import { DataList } from "@/components/admin/module-panel";
import { ReportPageShell } from "@/components/admin/report-page-shell";
import { humanStatus } from "@/lib/platform/copy";
import { getSalesReportSummary } from "@/services/reports";

export default async function SalesReportPage() {
  const sales = await getSalesReportSummary();
  return (
    <ReportPageShell title="Sales report" description="Order volume by status.">
      <DataList
        rows={Object.entries(sales.byStatus).map(([status, count]) => ({
          label: humanStatus(status),
          value: String(count)
        }))}
      />
    </ReportPageShell>
  );
}
