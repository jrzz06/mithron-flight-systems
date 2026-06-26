import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "figure",
  "figcaption",
  "img",
  "span",
  "div",
  "label",
  "input"
];

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value, "https://example.invalid");
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function sanitizeEditorHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "rel", "target", "class"],
      img: ["src", "alt", "width", "height", "class", "data-media-asset-id", "data-caption"],
      figure: ["class"],
      figcaption: ["class"],
      div: ["class", "data-type", "data-variant", "data-title", "data-icon", "data-description", "data-rows", "data-items"],
      span: ["class", "style", "data-color"],
      p: ["class", "style"],
      h1: ["class", "style"],
      h2: ["class", "style"],
      h3: ["class", "style"],
      h4: ["class", "style"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      input: ["type", "checked", "disabled"]
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i],
        "text-align": [/^(left|center|right|justify)$/]
      }
    },
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        if (href && !isSafeHttpUrl(href)) {
          return { tagName: "a", attribs: { ...attribs, href: "#" } };
        }
        return { tagName, attribs };
      },
      img: (tagName, attribs) => {
        const src = attribs.src ?? "";
        if (src.startsWith("data:")) {
          return { tagName: "span", attribs: {} };
        }
        if (src && !isSafeHttpUrl(src)) {
          return { tagName: "span", attribs: {} };
        }
        return { tagName, attribs };
      }
    },
    disallowedTagsMode: "discard"
  });
}

/** @deprecated Use sanitizeEditorHtml — kept for product overview compatibility */
export function sanitizeProductHtml(html: string) {
  return sanitizeEditorHtml(html);
}
