import { StoreShell } from "@/components/layout/store-shell";
import { LenisProvider } from "@/components/providers/lenis-provider";
import { getProductShellItems, getProducts } from "@/services/catalog";
import { buildEnterpriseMenuConfigs } from "@/services/catalog-navigation";
import { getPublicCmsSnapshot } from "@/services/cms";

export default async function StorefrontLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [products, shellProducts, cms] = await Promise.all([
    getProducts(),
    getProductShellItems(),
    getPublicCmsSnapshot()
  ]);
  const enterpriseMenuConfigs = buildEnterpriseMenuConfigs(products);

  return (
    <LenisProvider>
      <StoreShell
        products={shellProducts}
        interests={cms.home.interests}
        navigationItems={cms.navigation}
        enterpriseMenuConfigs={enterpriseMenuConfigs}
        footer={cms.footer}
      >
        {children}
      </StoreShell>
    </LenisProvider>
  );
}
