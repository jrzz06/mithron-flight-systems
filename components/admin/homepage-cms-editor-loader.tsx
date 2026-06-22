"use client";

import dynamic from "next/dynamic";
import { ControlPlaneLoading } from "@/components/ui/control-plane-loading";

const HomepageCmsEditor = dynamic(
  () => import("@/features/admin/cms/homepage-cms-editor").then((module) => module.HomepageCmsEditor),
  {
    loading: () => <ControlPlaneLoading label="Loading website editor" />
  }
);

export { HomepageCmsEditor };
