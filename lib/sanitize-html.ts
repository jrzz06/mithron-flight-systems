import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = ["p", "br", "strong", "em", "u", "ul", "ol", "li", "a", "h2", "h3", "blockquote"];

export function sanitizeProductHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "rel", "target"]
    },
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false
  });
}
