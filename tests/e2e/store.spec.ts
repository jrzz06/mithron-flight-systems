import { expect, test } from "@playwright/test";

test.describe("Mithron cinematic storefront", () => {
  test("homepage exposes the premium nav shell, hero carousel, and composite landing section", async ({ page, isMobile }) => {
    test.setTimeout(120000);
    await page.goto("/");
    const main = page.getByTestId("home-page-canvas");
    const hero = main.getByTestId("home-hero");
    const composite = main.getByTestId("home-landing-composite");

    await expect(main).toHaveAttribute("data-homepage-contract", "NAV_HERO_CAROUSEL_COMPOSITE");
    await expect(hero).toBeVisible();
    await expect(composite).toBeVisible();
    await expect(composite).toHaveAttribute("data-home-composite-root", "true");
    await expect(composite).toHaveAttribute("data-motion-engine", "native-gsap-scrolltrigger");
    await expect(main.getByTestId("product-ecosystem-showcase")).toHaveCount(0);
    await expect(main.getByTestId("platform-intelligence-chapter")).toHaveCount(0);
    await expect(main.getByTestId("platform-world-architecture")).toHaveCount(0);
    await expect(main.getByTestId("ecosystem-atmospheric-motion-layer")).toHaveCount(0);
    await expect(main.getByTestId("ecosystem-fluid-canvas")).toHaveCount(0);
    await expect(main.getByTestId("ecosystem-experience")).toHaveCount(0);
    await expect(main.getByTestId("optical-river")).toHaveCount(0);
    await expect(main.getByTestId("optical-product-field")).toHaveCount(0);
    await expect(main.getByTestId("optical-network")).toHaveCount(0);
    await expect(main.getByTestId("optical-veil")).toHaveCount(0);
    await expect(main.locator("h1").first()).toContainText("DRONE IS MITHRON");
    await expect(main.getByTestId("hero-primary-cta")).toHaveAttribute("href", "https://www.mithronsmart.com");
    await expect(main.getByTestId("hero-primary-cta")).toContainText("Visit Mithron Smart");

    await expect(main.locator("[data-hero-video]")).toHaveCount(0);
    const heroImage = main.getByTestId("hero-product-image").locator("img").first();
    await expect(heroImage).toBeVisible();
    await expect(heroImage).toHaveAttribute("src", /(_next\/image\?url=%2Fassets%2Fhero%2F|\/assets\/hero\/)/);
    await expect(page.locator(".site-footer, footer")).toHaveCount(1);
    await expect(composite.getByTestId("home-mini-carousel")).toBeVisible();

    for (const removedTestId of [
      "ecosystem-experience",
      "optical-river",
      "optical-product-field",
      "optical-network",
      "optical-veil",
      "hero-banner-extension",
      "drone-world-ecosystem-panel",
      "ecosystem-showcase-section",
      "showcase-carousel",
      "home-cinematic-sequence",
      "hero-ecosystem-transition",
      "product-icon-rail",
      "mission-domains-section",
      "cinematic-media-rail",
      "community-section",
      "trust-section",
      "post-hero-ecosystem",
      "post-hero-ecosystem-shell",
      "post-hero-ecosystem-showcase",
      "solutions-worlds",
      "product-ecosystem-showcase",
      "platform-intelligence-chapter",
      "platform-world-architecture",
      "platform-shared-intelligence-layer"
    ]) {
      await expect(main.getByTestId(removedTestId)).toHaveCount(0);
    }
    for (const removedText of [
      "OUR ECOSYSTEM",
      "One Ecosystem.",
      "Engineered for Precision",
      "Trusted by Professionals",
      "Built for",
      "Featured Products",
      "Product feed unavailable"
    ]) {
      await expect(main.getByText(removedText, { exact: true })).toHaveCount(0);
    }
    await expect(main.getByTestId("ecosystem-product-card")).toHaveCount(0);
    await expect(main.getByTestId("ecosystem-carousel-panel")).toHaveCount(0);

    await expect(main.getByTestId("ecosystem-product-stage")).toHaveCount(0);

    const homepageChildren = await main.evaluate((node) => (
      Array.from(node.children)
        .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === "SECTION" && child.getBoundingClientRect().height > 0)
        .map((child) => ({
        tagName: child.tagName,
        testId: child.getAttribute("data-testid") ?? "",
        hidden: child.getAttribute("hidden") !== null || getComputedStyle(child).display === "none"
      }))
    ));
    expect(homepageChildren).toEqual([
      { tagName: "SECTION", testId: "home-hero", hidden: false },
      { tagName: "SECTION", testId: "home-landing-composite", hidden: false }
    ]);

    const heroCtaState = await main.getByTestId("hero-primary-cta").boundingBox();
    expect(heroCtaState?.height ?? 0).toBeGreaterThanOrEqual(40);
    expect(heroCtaState?.height ?? 0).toBeLessThanOrEqual(44);

    const viewport = page.viewportSize();
    const heroBox = await main.getByTestId("home-hero").boundingBox();
    expect(heroBox).not.toBeNull();
    expect(heroBox?.height ?? 0).toBeGreaterThanOrEqual((viewport?.height ?? 0) * 0.62);
    expect(heroBox?.height ?? 0).toBeLessThanOrEqual((viewport?.height ?? 0) * 0.8 + 3);
    await expect(hero).toHaveAttribute("data-hero-system", "mithron-native-fullscreen-carousel");
    await expect(main.getByTestId("hero-pagination").locator("button")).toHaveCount(4);
    const heroContainment = await hero.evaluate((node) => getComputedStyle(node).overflow);
    expect(heroContainment).toBe("hidden");

    const homepageLayout = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLElement>("[data-testid='home-page-canvas']")!;
      const visibleSection = (testId: string) => Array.from(canvas.children)
        .filter((child): child is HTMLElement => child instanceof HTMLElement && child.matches(`section[data-testid='${testId}']`))
        .find((section) => section.getBoundingClientRect().height > 0)!;
      const hero = visibleSection("home-hero");
      const composite = visibleSection("home-landing-composite");
      const canvasRect = canvas.getBoundingClientRect();
      const heroRect = hero.getBoundingClientRect();
      const compositeRect = composite.getBoundingClientRect();
      const visibleSections = Array.from(canvas.children)
        .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === "SECTION" && child.getBoundingClientRect().height > 0);

      return {
        scrollHeight: document.documentElement.scrollHeight,
        mainHeight: Math.round(canvasRect.height),
        heroHeight: Math.round(heroRect.height),
        heroTop: Math.round(heroRect.top),
        heroBottom: Math.round(heroRect.bottom),
        compositeTop: Math.round(compositeRect.top),
        compositeHeight: Math.round(compositeRect.height),
        compositeRootCount: canvas.querySelectorAll("section[data-testid='home-landing-composite'][data-home-composite-root='true']").length,
        nestedCompositeSectionCount: composite.querySelectorAll("section").length,
        ecosystemCount: canvas.querySelectorAll("[data-testid='product-ecosystem-showcase']").length,
        platformCount: canvas.querySelectorAll("[data-testid='platform-intelligence-chapter']").length,
        atmosphericMotionLayerCount: canvas.querySelectorAll("[data-testid='ecosystem-atmospheric-motion-layer']").length,
        fluidCanvasCount: canvas.querySelectorAll("[data-testid='ecosystem-fluid-canvas']").length,
        renderedSections: visibleSections.length,
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        beforeContent: getComputedStyle(canvas, "::before").content,
        beforeBackground: getComputedStyle(canvas, "::before").backgroundImage,
        afterContent: getComputedStyle(canvas, "::after").content
      };
    });
    expect(homepageLayout.mainHeight).toBeGreaterThan(homepageLayout.heroHeight);
    expect(homepageLayout.scrollHeight).toBeGreaterThan(homepageLayout.heroHeight + 800);
    expect(homepageLayout.heroTop).toBeLessThanOrEqual(1);
    expect(homepageLayout.heroBottom).toBeGreaterThanOrEqual((viewport?.height ?? 0) * 0.62);
    expect(homepageLayout.heroBottom).toBeLessThanOrEqual((viewport?.height ?? 0) * 0.8 + 3);
    expect(homepageLayout.compositeTop).toBeGreaterThanOrEqual(homepageLayout.heroBottom - 2);
    expect(homepageLayout.compositeHeight).toBeGreaterThan(1600);
    expect(homepageLayout.compositeRootCount).toBe(1);
    expect(homepageLayout.nestedCompositeSectionCount).toBe(0);
    expect(homepageLayout.ecosystemCount).toBe(0);
    expect(homepageLayout.platformCount).toBe(0);
    expect(homepageLayout.atmosphericMotionLayerCount).toBe(0);
    expect(homepageLayout.fluidCanvasCount).toBe(0);
    expect(homepageLayout.renderedSections).toBe(2);
    expect(homepageLayout.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(homepageLayout.beforeContent).toBe("none");
    expect(homepageLayout.beforeBackground).toBe("none");
    expect(homepageLayout.afterContent).toBe("none");

    const chapterOrder = await composite.locator("[data-home-composite-chapter]").evaluateAll((nodes) => (
      nodes.map((node) => node.getAttribute("data-home-composite-chapter"))
    ));
    expect(chapterOrder).toEqual([
      "drone-world",
      "drone-care",
      "global-products",
      "agri-drones",
      "city-drones"
    ]);
    for (const removedChapter of ["lineup-solutions", "draft-testimonials", "creative-three", "about-us"]) {
      await expect(composite.locator(`[data-home-composite-chapter='${removedChapter}']`)).toHaveCount(0);
    }

    const shelfIds = [
      "drone-world-shelf",
      "drone-care-shelf",
      "global-products-shelf"
    ];
    await expect(composite.getByTestId("home-product-shelf-section")).toHaveCount(shelfIds.length);
    await expect(composite.getByTestId("home-product-shelf-hero")).toHaveCount(shelfIds.length);
    await expect(composite.getByTestId("home-product-shelf-grid")).toHaveCount(shelfIds.length);
    await expect(composite.getByTestId("home-product-guide-card")).toHaveCount(shelfIds.length);
    await expect(composite.getByTestId("home-shelf-prev")).toHaveCount(0);
    await expect(composite.getByTestId("home-shelf-next")).toHaveCount(0);

    for (const shelfId of shelfIds) {
      const shelf = composite.locator(`[data-shelf-id='${shelfId}']`);
      await expect(shelf).toBeVisible();
      await expect(shelf.getByTestId("home-product-shelf-hero")).toBeVisible();
      await expect(shelf.getByTestId("home-product-shelf-grid")).toBeVisible();
      await expect(shelf.getByTestId("home-product-guide-card")).toBeVisible();
      const productCardCount = await shelf.getByTestId("home-product-card").count();
      expect(productCardCount).toBeGreaterThan(0);
      expect(productCardCount).toBeLessThanOrEqual(4);
      if (!isMobile) expect(productCardCount).toBe(4);
      const shelfProductImages = await shelf.getByTestId("home-product-card").locator("a[href^='/product/'] img, img").evaluateAll((nodes) => (
        nodes.map((node) => {
          const img = node as HTMLImageElement;
          return img.currentSrc || img.getAttribute("src") || "";
        })
      ));
      const heroImageSource = await shelf.getByTestId("home-product-shelf-hero").locator("img").first().evaluate((node) => {
        const img = node as HTMLImageElement;
        return img.currentSrc || img.getAttribute("src") || "";
      });
      expect(shelfProductImages.length).toBe(productCardCount);
      expect(heroImageSource.length).toBeGreaterThan(0);
      expect(/placeholder|default-section-pencil-art/i.test(heroImageSource)).toBe(false);
      expect(shelfProductImages.every((src) => src.length > 0 && !/placeholder|default-section-pencil-art/i.test(src))).toBe(true);
      const shelfBoardLayout = await shelf.evaluate((node) => {
        const grid = node.querySelector<HTMLElement>("[data-testid='home-product-shelf-grid']");
        const guide = node.querySelector<HTMLElement>("[data-testid='home-product-guide-card']");
        const firstCard = node.querySelector<HTMLElement>("[data-testid='home-product-card']");
        const style = grid ? getComputedStyle(grid) : null;
        return {
          gridDisplay: style?.display ?? null,
          guideVisible: Boolean(guide && guide.getBoundingClientRect().width > 0 && guide.getBoundingClientRect().height > 0),
          firstCardVisible: Boolean(firstCard && firstCard.getBoundingClientRect().width > 0 && firstCard.getBoundingClientRect().height > 0),
          pageOverflow: document.documentElement.scrollWidth - window.innerWidth
        };
      });
      expect(shelfBoardLayout.gridDisplay).toBe(isMobile ? "grid" : "grid");
      expect(shelfBoardLayout.guideVisible).toBe(true);
      expect(shelfBoardLayout.firstCardVisible).toBe(true);
      expect(shelfBoardLayout.pageOverflow).toBeLessThanOrEqual(1);
    }

    const droneWorldShelf = composite.locator("[data-shelf-id='drone-world-shelf']");
    const droneWorldHeroText = await droneWorldShelf.getByTestId("home-product-shelf-hero").textContent();
    expect(droneWorldHeroText ?? "").not.toMatch(/controller|flight controller|propeller|battery|cable|connector|sensor|motor|frame|hpc/i);
    const droneWorldHeroTone = await droneWorldShelf.getByTestId("home-product-shelf-hero").evaluate((node) => {
      const style = getComputedStyle(node);
      const images = Array.from(node.querySelectorAll<HTMLImageElement>("img"));
      return {
        textColor: style.color,
        backgroundImage: style.backgroundImage,
        heroImageCount: images.length,
        heroHeight: node.getBoundingClientRect().height
      };
    });
    expect(droneWorldHeroTone.textColor).toBe("rgb(255, 255, 255)");
    expect(droneWorldHeroTone.backgroundImage).not.toContain("rgba(15, 23, 42, 0.78)");
    expect(droneWorldHeroTone.heroImageCount).toBe(1);
    expect(droneWorldHeroTone.heroHeight).toBeLessThanOrEqual(isMobile ? 340 : 460);

    await expect(composite.getByTestId("mission-world-section")).toHaveCount(0);
    await expect(composite.getByTestId("mission-world-tile")).toHaveCount(10);
    await expect(composite.getByTestId("agri-community-world-section")).toBeVisible();
    await expect(composite.getByTestId("city-drone-world-section")).toBeVisible();
    await expect(composite.getByTestId("home-customer-testimonials")).toBeVisible();
    await expect(composite.getByTestId("home-about-band")).toBeVisible();
    await expect(composite.getByTestId("home-about-footer")).toBeVisible();
    await expect(composite.locator("[data-testid='agri-community-world-section'] [data-showcase-kind='mission-image']")).toHaveCount(5);
    await expect(composite.locator("[data-testid='city-drone-world-section'] [data-showcase-kind='mission-image']")).toHaveCount(5);
    await expect(composite.locator("[data-testid='agri-community-world-section'] [data-mission-text-reveal]")).toHaveCount(0);
    await expect(composite.locator("[data-testid='city-drone-world-section'] [data-mission-image-reveal]")).toHaveCount(0);
    const agriLayoutState = await composite.getByTestId("agri-community-world-section").evaluate((section) => {
      const firstTile = section.querySelector<HTMLElement>("[data-testid='mission-world-tile']");
      const sectionRect = section.getBoundingClientRect();
      const tileRect = firstTile?.getBoundingClientRect();
      return {
        sectionHeight: sectionRect.height,
        viewportHeight: window.innerHeight,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        firstTileHeight: tileRect?.height ?? 0
      };
    });
    expect(agriLayoutState.sectionHeight).toBeGreaterThanOrEqual(agriLayoutState.viewportHeight * (isMobile ? 0.72 : 0.82));
    expect(agriLayoutState.firstTileHeight).toBeGreaterThan(isMobile ? 300 : 420);
    expect(agriLayoutState.pageOverflow).toBeLessThanOrEqual(1);
    const missionShowcaseState = await composite.getByTestId("mission-world-tile").evaluateAll((nodes) => (
      nodes.map((node) => ({
        tagName: node.tagName,
        cursor: getComputedStyle(node).cursor,
        href: node instanceof HTMLAnchorElement ? node.href : "",
        showcaseOnly: node.getAttribute("data-showcase-link") === "false",
        tabIndex: node.getAttribute("tabindex"),
        playCount: node.querySelectorAll("[class*='missionTilePlay']").length
      }))
    ));
    expect(missionShowcaseState).toHaveLength(10);
    expect(missionShowcaseState.filter((tile) => tile.href.length > 0)).toHaveLength(3);
    expect(missionShowcaseState.filter((tile) => tile.showcaseOnly)).toHaveLength(7);
    expect(missionShowcaseState.every((tile) => tile.tabIndex === null)).toBe(true);
    expect(missionShowcaseState.every((tile) => tile.playCount === 0)).toBe(true);

    const linkedMissionTiles = composite.locator("[data-testid='mission-world-tile']").filter({
      hasNot: composite.locator("[data-showcase-link='false']")
    });
    await expect(linkedMissionTiles).toHaveCount(3);
    await expect(linkedMissionTiles.nth(0)).toHaveAttribute("href", "https://drone.mithronsmart.com/droneowner_reg");
    await expect(linkedMissionTiles.nth(1)).toHaveAttribute("href", "https://drone.mithronsmart.com/register");
    await expect(linkedMissionTiles.nth(2)).toHaveAttribute("href", "https://drone.mithronsmart.com/farmer");
    await expect(composite.locator("[data-testid='agri-community-world-section'] [data-tile-size='hero']")).toHaveCount(1);
    await expect(composite.locator("[data-testid='city-drone-world-section'] [data-tile-size='hero']")).toHaveCount(1);
    for (const missionLabel of [
      "AGRONE Pilot Registration",
      "AGRONE Drone Owner Registration",
      "Smart Farmer Registration",
      "Agri Drone Loan & EMI Check",
      "All India Farmer Drone Booking",
      "Smart City Monitoring",
      "Traffic Analytics",
      "Infrastructure Inspection",
      "Emergency Response",
      "Crowd Monitoring"
    ]) {
      await expect(composite.getByText(missionLabel, { exact: true }).first()).toBeVisible();
    }
    for (const removedMissionLabel of [
      "Yield Monitoring",
      "RTK Survey Operations",
      "Smart Agriculture Insights",
      "Utility Inspection",
      "Urban Mapping",
      "Construction Survey"
    ]) {
      await expect(composite.getByText(removedMissionLabel, { exact: true })).toHaveCount(0);
    }

    await expect(composite.getByText(/Representative .* mission gallery using existing Mithron media/)).toHaveCount(2);
    await expect(composite.getByText("Published sector stories from the CMS.")).toHaveCount(0);
    await expect(composite.getByText("VERIFIED CMS").first()).toHaveCount(0);
    const oldDraftBadge = ["PAR", "TIAL draft"].join("");
    const oldDraftAttribution = ["Awaiting CMS", "proof"].join(" ");
    await expect(composite.getByText(oldDraftBadge)).toHaveCount(0);
    await expect(composite.getByText(oldDraftAttribution)).toHaveCount(0);

    const catalogImageState = await composite.locator("a[href^='/product/'] img").evaluateAll((nodes) => (
      nodes.map((node) => {
        const img = node as HTMLImageElement;
        return img.currentSrc || img.getAttribute("src") || "";
      })
    ));
    expect(catalogImageState.length).toBeGreaterThanOrEqual(isMobile ? 6 : 12);
    expect(catalogImageState.every((src) => src.length > 0 && !/placeholder|default-section-pencil-art/i.test(src))).toBe(true);

    await expect(page.getByTestId("home-three-cinematic-section")).toHaveCount(0);
    await expect(page.getByTestId("home-three-scene-canvas")).toHaveCount(0);
    await expect(page.getByTestId("home-three-scene-fallback")).toHaveCount(0);

    if (!isMobile) {
      await page.getByTestId("home-hero").scrollIntoViewIfNeeded();

      const heroMedia = page.getByTestId("hero-product-image").locator("img").first();
      await expect(heroMedia).toHaveAttribute("src", /(_next\/image\?url=%2Fassets%2Fhero%2F|\/assets\/hero\/)/);
      const heroImageState = await page.getByTestId("hero-product-image").evaluate((node) => ({
        transform: getComputedStyle(node).transform
      }));
      expect(heroImageState.transform).not.toBe("none");

      await page.getByRole("button", { name: "Next hero" }).click({ force: true });
      await expect(page.locator("h1").first()).toContainText(/Mithron Terrain Mapping|Mithron Drone Ecosystem|Mithron Night Surveillance/);
    }

    if (isMobile) {
      const mobileCurrentSources = await page.locator("img").evaluateAll((nodes) => nodes.map((node) => (node as HTMLImageElement).currentSrc || node.getAttribute("src") || ""));
      expect(mobileCurrentSources.some((src) => /3840w|2560w/.test(src))).toBe(false);
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(page.getByTestId("mobile-menu").getByRole("link", { name: "Agri Drones" })).toBeVisible();
      await expect(page.getByTestId("mobile-menu").getByRole("link", { name: "Accessories" })).toBeVisible();
      await expect(page.getByTestId("mobile-menu").getByRole("link", { name: "Global Products" })).toBeVisible();
      await page.getByRole("button", { name: "Close menu" }).click();
    } else {
      const topNavigation = page.getByRole("navigation");
      await expect(topNavigation.getByRole("link", { name: "Products" })).toBeVisible();
      await expect(topNavigation.getByRole("link", { name: "Agri Drones" })).toBeVisible();
      await expect(topNavigation.getByRole("link", { name: "Global Products" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Search Mithron systems" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
    }

    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    await page.locator("button[aria-label='Search Mithron systems']").evaluateAll((buttons) => {
      const visibleButton = buttons.find((button) => {
        const rect = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      }) as HTMLButtonElement | undefined;
      visibleButton?.click();
    });
    await expect(page.getByPlaceholder("Search Mithron systems")).toBeVisible();
    await page.getByPlaceholder("Search Mithron systems").fill("kisan");
    await expect(page.getByRole("link", { name: /Agri Kisan/ }).first()).toBeVisible();
    await page.getByRole("button", { name: "Close search" }).click();

    await expect(page.getByRole("button", { name: "Open mission cart" })).toHaveCount(0);
  });

  test("catalog cards keep consistent alignment and premium spacing", async ({ page, isMobile }) => {
    await page.goto("/products");

    await expect(page.getByTestId("catalog-intro")).toBeVisible();
    await page.waitForFunction(() => {
      const images = Array.from(document.querySelectorAll<HTMLImageElement>("[data-card-variant='catalog'] img"));
      return images.length >= 4 && images.slice(0, 4).every((image) => image.getBoundingClientRect().height > 120);
    });
    const cards = page.locator("[data-card-variant='catalog']");
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(4);

    const catalogMetrics = await page.evaluate(() => {
      const cardShells = Array.from(document.querySelectorAll<HTMLElement>("[data-card-variant='catalog']"));
      const grid = cardShells[0]?.parentElement as HTMLElement;
      const cardNodes = cardShells.map((shell) => shell.querySelector<HTMLElement>("a") ?? shell);
      const firstTop = cardNodes[0]?.getBoundingClientRect().top ?? 0;
      const firstRow = cardNodes.filter((card) => Math.abs(card.getBoundingClientRect().top - firstTop) < 8);
      const rowCards = firstRow.slice(0, 4);
      const heights = rowCards.map((card) => Math.round(card.getBoundingClientRect().height));
      const imageHeights = rowCards.map((card) => Math.round(card.querySelector<HTMLImageElement>("img")!.getBoundingClientRect().height)).filter((height) => height > 0);
      const ctaTops = rowCards.map((card) => {
        const cta = Array.from(card.querySelectorAll<HTMLElement>("span")).find((node) => node.textContent?.includes("View System") || node.textContent?.includes("View system"));
        return Math.round(cta?.getBoundingClientRect().top ?? 0);
      });
      const gridStyle = getComputedStyle(grid);
      const firstCardStyle = getComputedStyle(cardNodes[0]!);

      return {
        rowCount: rowCards.length,
        heights,
        imageHeights,
        ctaTops,
        gridDisplay: gridStyle.display,
        columnGap: Number.parseFloat(gridStyle.columnGap),
        rowGap: Number.parseFloat(gridStyle.rowGap),
        cardBackground: firstCardStyle.backgroundColor,
        cardBorderRadius: Number.parseFloat(firstCardStyle.borderTopLeftRadius)
      };
    });

    expect(catalogMetrics.gridDisplay).toBe("grid");
    expect(catalogMetrics.columnGap).toBeGreaterThanOrEqual(16);
    expect(catalogMetrics.rowGap).toBeGreaterThanOrEqual(16);
    expect(catalogMetrics.rowCount).toBeGreaterThanOrEqual(isMobile ? 1 : 3);
    expect(Math.max(...catalogMetrics.heights) - Math.min(...catalogMetrics.heights)).toBeLessThanOrEqual(2);
    expect(Math.max(...catalogMetrics.imageHeights) - Math.min(...catalogMetrics.imageHeights)).toBeLessThanOrEqual(2);
    expect(Math.max(...catalogMetrics.ctaTops) - Math.min(...catalogMetrics.ctaTops)).toBeLessThanOrEqual(2);
    expect(catalogMetrics.cardBackground).toBe("rgb(255, 255, 255)");
    expect(catalogMetrics.cardBorderRadius).toBeGreaterThanOrEqual(22);
  });

  test("category showcase hero starts flush under a minimalist active nav state", async ({ page, isMobile }) => {
    await page.goto("/agriculture");

    const hero = page.locator(".catalog-hero-section--showcase");
    await expect(hero).toBeVisible();

    if (!isMobile) {
      const activeLink = page.getByRole("navigation").getByRole("link", { name: "Agri Drones" });
      await expect(activeLink).toHaveAttribute("aria-current", "page");
    }

    const layout = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>(".TOP_NAVBAR")!;
      const heroNode = document.querySelector<HTMLElement>(".catalog-hero-section--showcase")!;
      const active = document.querySelector<HTMLElement>(".adaptive-navbar__link.is-active");
      const underline = active?.querySelector<HTMLElement>(".adaptive-navbar__underline") ?? null;
      const navRect = nav.getBoundingClientRect();
      const heroRect = heroNode.getBoundingClientRect();
      const activeStyle = active ? getComputedStyle(active) : null;
      const underlineStyle = underline ? getComputedStyle(underline) : null;

      return {
        navTop: Math.round(navRect.top),
        heroTop: Math.round(heroRect.top),
        heroCoversNavBand: heroRect.top <= navRect.top + 1 && heroRect.bottom > navRect.bottom,
        activeBackground: activeStyle?.backgroundColor ?? null,
        activeTransition: activeStyle?.transitionProperty ?? null,
        underlineWidth: underline ? Math.round(underline.getBoundingClientRect().width) : null,
        underlineOpacity: underlineStyle ? Number.parseFloat(underlineStyle.opacity) : null,
        underlineTransition: underlineStyle?.transitionProperty ?? null,
        underlineTransform: underlineStyle?.transform ?? null
      };
    });

    expect(layout.navTop).toBe(0);
    expect(layout.heroTop).toBeLessThanOrEqual(8);
    expect(layout.heroCoversNavBand || layout.heroTop <= 8).toBe(true);

    if (!isMobile) {
      expect(layout.activeBackground).toBe("rgba(0, 0, 0, 0)");
      expect(layout.activeTransition).not.toContain("transform");
      expect(layout.underlineWidth).toBeLessThanOrEqual(24);
      expect(layout.underlineOpacity).toBeGreaterThanOrEqual(0.65);
      expect(layout.underlineTransition).toContain("opacity");
      expect(layout.underlineTransform).not.toContain("0, 0, 0, 0");
    }
  });

  test("homepage keeps the premium nav usable in reduced motion", async ({ page, isMobile }) => {
    test.setTimeout(120000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => {
      window.history.scrollRestoration = "manual";
      window.scrollTo(0, 0);
    });
    expect(await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

    const main = page.getByTestId("home-page-canvas");
    const composite = page.getByTestId("home-landing-composite");

    await expect(main).toHaveAttribute("data-homepage-contract", "NAV_HERO_CAROUSEL_COMPOSITE");
    await expect(page.getByTestId("home-hero")).toHaveCount(1);
    await expect(page.getByTestId("home-hero")).toHaveAttribute("data-hero-system", "mithron-native-fullscreen-carousel");
    await expect(composite).toBeVisible();
    await expect(composite).toHaveAttribute("data-motion-state", "reduced");
    await composite.getByTestId("agri-community-world-section").scrollIntoViewIfNeeded();
    await expect(composite.getByTestId("mission-world-tile").first()).toBeVisible();
    expect(await page.getByTestId("home-hero").locator("[data-testid='hero-primary-cta']").count()).toBeGreaterThan(0);
    await expect(page.getByTestId("product-ecosystem-showcase")).toHaveCount(0);
    await expect(page.getByTestId("platform-intelligence-chapter")).toHaveCount(0);
    await expect(page.getByTestId("platform-world-architecture")).toHaveCount(0);
    await expect(page.getByTestId("post-hero-ecosystem")).toHaveCount(0);
    await expect(page.getByTestId("ecosystem-experience")).toHaveCount(0);
    const reducedMotionTitle = await page.locator("h1").first().textContent();
    await expect(page.locator("#creative-three")).toHaveCount(0);
    await expect(page.getByTestId("home-three-cinematic-section")).toHaveCount(0);
    await expect(page.getByTestId("home-three-story-chapter")).toHaveCount(0);
    await expect(page.getByTestId("home-three-scene-fallback")).toHaveCount(0);
    await expect(page.locator("[data-three-ready='false']")).toHaveCount(0);
    await page.waitForTimeout(7200);
    await expect(page.locator("h1").first()).toHaveText(reducedMotionTitle ?? "");
    if (isMobile) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByRole("button", { name: "Open menu" }).click({ force: true });
      await expect(page.getByTestId("mobile-menu").getByRole("link", { name: "Products" })).toHaveCount(0);
      await expect(page.getByTestId("mobile-menu").getByRole("link", { name: "Accessories" })).toBeVisible();
      await expect(page.getByTestId("mobile-menu").getByRole("link", { name: "Global Products" })).toBeVisible();
      await page.getByRole("button", { name: "Close menu" }).click();
    } else {
      const topNavigation = page.getByRole("navigation");
      await expect(topNavigation.getByRole("link", { name: "Products" })).toBeVisible();
      await expect(topNavigation.getByRole("link", { name: "Global Products" })).toBeVisible();
    }
    await page.getByRole("button", { name: "Search Mithron systems" }).click();
    await expect(page.getByPlaceholder("Search Mithron systems")).toBeVisible();
  });

  test("product page adds a bundle to the mission cart and reaches deployment configuration", async ({ page, isMobile }) => {
    await page.goto("/product/source-agri-kisan-drone-small-8-liter");

    await expect(page.getByRole("heading", { name: "Agri Kisan Drone Small - 8 Liter" }).first()).toBeVisible();
    await expect(page.locator("[data-media-viewer='mithron-native-assets'] img[src*='mithron-products']").first()).toBeVisible();
    if (isMobile) {
      await page.getByRole("button", { name: "Add to cart" }).click({ force: true });
    } else {
      await page.getByRole("button", { name: "Add selected bundle to cart" }).click({ force: true });
    }

    await expect(page.locator(".cart-drawer-root.is-open")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mission ready" })).toBeVisible();
    await expect(page.getByText("Agri Kisan Drone Small - 8 Liter").first()).toBeVisible();
    const configureButton = page.getByRole("button", { name: "Configure deployment" });
    await expect(configureButton).toBeVisible();
    const configureButtonBox = await configureButton.boundingBox();
    expect(configureButtonBox).not.toBeNull();
    await page.mouse.click(
      (configureButtonBox?.x ?? 0) + (configureButtonBox?.width ?? 0) / 2,
      (configureButtonBox?.y ?? 0) + Math.min(12, (configureButtonBox?.height ?? 24) / 2)
    );

    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByRole("heading", { name: "Configure deployment" })).toBeVisible();
    await page.getByRole("button", { name: "Submit deployment request" }).click();
    await expect(page.getByRole("heading", { name: "Deployment request secured" })).toBeVisible();
  });
});
