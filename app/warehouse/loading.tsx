import { ControlPlaneLoading } from "@/components/ui/control-plane-loading";

export default function WarehouseLoading() {
  return (
    <main data-control-plane data-control-plane-scope="warehouse" data-control-plane-theme="light" className="min-h-screen bg-[var(--platform-bg)] px-4 py-5 md:px-8">
      <section className="mx-auto max-w-[1240px]">
        <ControlPlaneLoading label="Loading warehouse workspace" metricCount={4} />
      </section>
    </main>
  );
}
