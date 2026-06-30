import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
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
  "mark",
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

function isSafeAbsoluteHttpUrl(value: string) {
  if (!/^https?:\/\//i.test(value.trim())) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function stripPresentationAttributes(attribs: Record<string, string>) {
  const next = { ...attribs };
  delete next.style;
  delete next["data-color"];
  delete next.color;
  delete next.face;
  delete next.size;
  delete next.align;
  delete next.valign;
  delete next.width;
  delete next.height;
  delete next.border;
  delete next.cellpadding;
  delete next.cellspacing;
  return next;
}

export function sanitizeEditorHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "rel", "target", "class"],
      img: ["src", "alt", "class", "data-media-asset-id", "data-caption"],
      figure: ["class"],
      figcaption: ["class"],
      div: ["class", "data-type", "data-variant", "data-title", "data-icon", "data-description", "data-rows", "data-items"],
      span: ["class"],
      p: ["class"],
      h1: ["class"],
      h2: ["class"],
      h3: ["class"],
      h4: ["class"],
      mark: ["class"],
      td: ["colspan", "rowspan", "class"],
      th: ["colspan", "rowspan", "class"],
      input: ["type", "checked", "disabled"],
      ul: ["class"],
      ol: ["class"],
      li: ["class"],
      blockquote: ["class"],
      code: ["class"],
      pre: ["class"]
    },
    allowedStyles: {},
    transformTags: {
      b: "strong",
      i: "em",
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const cleaned = stripPresentationAttributes(attribs);
        if (href && !isSafeHttpUrl(href)) {
          return { tagName: "a", attribs: { ...cleaned, href: "#" } };
        }
        return { tagName, attribs: cleaned };
      },
      img: (tagName, attribs) => {
        const src = attribs.src ?? "";
        const cleaned = stripPresentationAttributes(attribs);
        if (src.startsWith("data:")) {
          return { tagName: "span", attribs: {} };
        }
        if (!src || !isSafeAbsoluteHttpUrl(src)) {
          return { tagName: "span", attribs: {} };
        }
        return { tagName, attribs: cleaned };
      },
      p: (_tagName, attribs) => ({ tagName: "p", attribs: stripPresentationAttributes(attribs) }),
      span: (_tagName, attribs) => ({ tagName: "span", attribs: stripPresentationAttributes(attribs) }),
      div: (_tagName, attribs) => ({ tagName: "div", attribs: stripPresentationAttributes(attribs) }),
      h1: (_tagName, attribs) => ({ tagName: "h1", attribs: stripPresentationAttributes(attribs) }),
      h2: (_tagName, attribs) => ({ tagName: "h2", attribs: stripPresentationAttributes(attribs) }),
      h3: (_tagName, attribs) => ({ tagName: "h3", attribs: stripPresentationAttributes(attribs) }),
      h4: (_tagName, attribs) => ({ tagName: "h4", attribs: stripPresentationAttributes(attribs) }),
      mark: (_tagName, attribs) => ({ tagName: "mark", attribs: stripPresentationAttributes(attribs) })
    },
    disallowedTagsMode: "discard"
  });
}

/** @deprecated Use sanitizeEditorHtml — kept for product overview compatibility */
export function sanitizeProductHtml(html: string) {
  return sanitizeEditorHtml(html);
}
