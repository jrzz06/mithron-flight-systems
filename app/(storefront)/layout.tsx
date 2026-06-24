import { Suspense } from "react";
import { StoreShell } from "@/components/layout/store-shell";
import { getEnterpriseMenuProducts } from "@/services/catalog";
import { buildEnterpriseMenuConfigs } from "@/services/catalog-navigation";
import { getStorefrontShellCms } from "@/services/cms";

function StorefrontShellFallback({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#eef0f3]">
      <div className="h-[104px] animate-pulse bg-[#dfe3e8]" aria-hidden="true" />
      <main className="store-main-offset">{children}</main>
    </div>
  );
}

async function StorefrontShellContent({ children }: { children: React.ReactNode }) {
  const [enterpriseMenu, cms] = await Promise.all([
    getEnterpriseMenuProducts(),
    getStorefrontShellCms()
  ]);
  const enterpriseMenuConfigs = buildEnterpriseMenuConfigs(enterpriseMenu.products);

  return (
    <StoreShell
      navigationItems={cms.navigation}
      enterpriseMenuConfigs={enterpriseMenuConfigs}
      catalogErrors={enterpriseMenu.errors}
      footer={cms.footer}
    >
      {children}
    </StoreShell>
  );
}

export default function StorefrontLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={<StorefrontShellFallback>{children}</StorefrontShellFallback>}>
      <StorefrontShellContent>{children}</StorefrontShellContent>
    </Suspense>
  );
}
