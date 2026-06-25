import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/site-footer";
import { StoreShellClient } from "@/components/layout/store-shell-client";
import type { FooterContent } from "@/config/storefront-content";
import type { EnterpriseMenuConfig } from "@/lib/nav-menu-types";
import type { NavigationNode } from "@/config/types";
import type { CatalogDataError } from "@/services/catalog";

export function StoreShell({
  children,
  navigationItems,
  enterpriseMenuConfigs,
  catalogErrors = [],
  footer
}: {
  children: ReactNode;
  navigationItems: NavigationNode[];
  enterpriseMenuConfigs: EnterpriseMenuConfig[];
  catalogErrors?: CatalogDataError[];
  footer: FooterContent;
}) {
  return (
    <StoreShellClient
      navigationItems={navigationItems}
      enterpriseMenuConfigs={enterpriseMenuConfigs}
      catalogErrors={catalogErrors}
      siteFooter={<SiteFooter content={footer} />}
    >
      {children}
    </StoreShellClient>
  );
}
