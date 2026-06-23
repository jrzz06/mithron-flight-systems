import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = ["p", "br", "strong", "em", "u", "ul", "ol", "li", "a", "h2", "h3", "blockquote"];

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value, "https://example.invalid");
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function sanitizeProductHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "rel", "target"]
    },
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        if (href && !isSafeHttpUrl(href)) {
          return {
            tagName: "a",
            attribs: {
              ...attribs,
              href: "#"
            }
          };
        }
        return { tagName, attribs };
      }
    }
  });
}
