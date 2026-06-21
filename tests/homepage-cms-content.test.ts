import { describe, expect, it } from "vitest";
import { mergeHomepageCmsContent } from "@/services/homepage-cms";
import { defaultHomepageCmsContent } from "@/config/homepage-cms";

describe("homepage CMS content", () => {
  it("merges saved testimonials header from admin_settings payload", () => {
    const merged = mergeHomepageCmsContent({
      testimonials: {
        eyebrow: "Customer voices",
        title: "Trusted by pilots and field teams",
        lead: "Operator feedback from the field.",
        linkLabel: "Browse products",
        linkHref: "/products"
      }
    });

    expect(merged.testimonials.title).toBe("Trusted by pilots and field teams");
    expect(merged.testimonials.lead).toBe("Operator feedback from the field.");
    expect(merged.testimonials.linkLabel).toBe("Browse products");
  });

  it("replaces legacy testimonials titles with the current default headline", () => {
    const merged = mergeHomepageCmsContent({
      testimonials: {
        title: "What customers say about our jerus"
      }
    });

    expect(merged.testimonials.title).toBe(defaultHomepageCmsContent.testimonials.title);
  });

  it("merges saved testimonials lead copy from admin_settings payload", () => {
    const merged = mergeHomepageCmsContent({
      testimonials: {
        eyebrow: "Customer voices",
        title: "Trusted by pilots and field teams",
        lead: "Operator feedback from the field.",
        linkLabel: "Browse products",
        linkHref: "/products"
      }
    });

    expect(merged.testimonials.lead).toBe("Operator feedback from the field.");
    expect(merged.testimonials.title).toBe("Trusted by pilots and field teams");
  });

  it("falls back to defaults for missing homepage fields", () => {
    const merged = mergeHomepageCmsContent({});
    expect(merged.testimonials.eyebrow).toBe(defaultHomepageCmsContent.testimonials.eyebrow);
    expect(merged.testimonials.title).toBe(defaultHomepageCmsContent.testimonials.title);
    expect(merged.testimonials.lead).toBe(defaultHomepageCmsContent.testimonials.lead);
    expect(merged.shelves.droneWorld.title).toBe(defaultHomepageCmsContent.shelves.droneWorld.title);
  });
});
