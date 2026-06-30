import { Suspense } from "react";
import { footerContent } from "@/config/storefront-content";
import { StoreShell } from "@/components/layout/store-shell";
import { createNavigationCatalogUnavailableError, getEnterpriseMenuProducts } from "@/services/catalog";
import { buildEnterpriseMenuConfigs } from "@/services/catalog-navigation";
import { getStorefrontShellCms } from "@/services/cms";

const emptyShellCms = {
  navigation: [],
  footer: footerContent
};

function StorefrontShellFallback({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#eef0f3]">
      <div className="h-[104px] animate-pulse bg-[#dfe3e8]" aria-hidden="true" />
      <main className="store-main-offset">{children}</main>
    </div>
  );
}

async function StorefrontShellContent({ children }: { children: React.ReactNode }) {
  const [enterpriseResult, cmsResult] = await Promise.allSettled([
    getEnterpriseMenuProducts(),
    getStorefrontShellCms()
  ]);

  if (enterpriseResult.status === "rejected") {
    const message = enterpriseResult.reason instanceof Error ? enterpriseResult.reason.message : String(enterpriseResult.reason);
    console.warn(`[storefront-shell] enterprise menu load failed: ${message}`);
  }
  if (cmsResult.status === "rejected") {
    const message = cmsResult.reason instanceof Error ? cmsResult.reason.message : String(cmsResult.reason);
    console.warn(`[storefront-shell] CMS shell load failed: ${message}`);
  }

  const enterpriseMenu = enterpriseResult.status === "fulfilled"
    ? enterpriseResult.value
    : {
        products: [],
        errors: [createNavigationCatalogUnavailableError(enterpriseResult.reason)]
      };

  const cms = cmsResult.status === "fulfilled" ? cmsResult.value : emptyShellCms;
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
