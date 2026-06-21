import { ControlPlaneLoading } from "@/components/ui/control-plane-loading";

export default function AdminLoading() {
  return <ControlPlaneLoading label="Loading admin dashboard" metricCount={8} />;
}
