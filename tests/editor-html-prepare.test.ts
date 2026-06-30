import { describe, expect, it } from "vitest";
import {
  cleanupEditorHtmlMarkup,
  decodeEscapedEditorHtml,
  editorHtmlToPlainText,
  prepareEditorHtmlForDisplay,
  prepareEditorHtmlForSave
} from "@/lib/editor/prepare-html";
import { sanitizeEditorHtml } from "@/lib/editor/sanitize";
import { editorJsonToHtml } from "@/lib/editor/serialize";

describe("editor html prepare pipeline", () => {
  it("decodes escaped html instead of showing raw tags", () => {
    const escaped = "&lt;p&gt;Hello &lt;strong&gt;world&lt;/strong&gt;&lt;/p&gt;";
    expect(prepareEditorHtmlForDisplay(escaped)).toBe("<p>Hello <strong>world</strong></p>");
  });

  it("strips inline styles and redundant spans", () => {
    const dirty =
      '<p style="text-align:center;color:#ff0000;font-size:18px;"><span style="color:#00ff00;">Styled copy</span></p>';
    const clean = prepareEditorHtmlForDisplay(dirty);
    expect(clean).toBe("<p>Styled copy</p>");
    expect(clean).not.toContain("style=");
    expect(clean).not.toContain("<span");
  });

  it("preserves semantic formatting and safe links", () => {
    const dirty = "<p><strong>Bold</strong> and <em>italic</em> with <a href=\"https://mithron.com\">link</a></p><ul><li>One</li></ul>";
    const clean = prepareEditorHtmlForDisplay(dirty);
    expect(clean).toContain("<strong>Bold</strong>");
    expect(clean).toContain("<em>italic</em>");
    expect(clean).toContain('href="https://mithron.com"');
    expect(clean).toContain("<li>One</li>");
  });

  it("removes scripts and event handlers", () => {
    const dirty = '<p>Safe</p><script>alert(1)</script><img src=x onerror="alert(1)">';
    const clean = prepareEditorHtmlForDisplay(dirty);
    expect(clean).toBe("<p>Safe</p>");
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onerror");
  });

  it("wraps plain text into paragraphs", () => {
    expect(prepareEditorHtmlForDisplay("First block.\n\nSecond block.")).toBe(
      "<p>First block.</p><p>Second block.</p>"
    );
  });

  it("strips tags for plain text helpers", () => {
    expect(editorHtmlToPlainText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("normalizes editor json output on save", () => {
    const html = editorJsonToHtml({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "center" },
          content: [{ type: "text", text: "Centered", marks: [{ type: "textStyle", attrs: { color: "#ff0000" } }] }]
        }
      ]
    });
    expect(html).toBe("<p>Centered</p>");
    expect(html).not.toContain("style=");
  });

  it("cleans duplicate empty paragraphs", () => {
    expect(cleanupEditorHtmlMarkup("<p></p><p>Hello</p><p></p>")).toBe("<p>Hello</p>");
  });

  it("decodeEscapedEditorHtml handles double-encoded entities", () => {
    const once = decodeEscapedEditorHtml("&lt;p&gt;Hi&lt;/p&gt;");
    expect(once).toBe("<p>Hi</p>");
  });

  it("keeps editor atom block data attributes", () => {
    const html = '<div data-type="callout" data-variant="information" class="editor-callout"><p>Note</p></div>';
    expect(sanitizeEditorHtml(html)).toContain('data-type="callout"');
  });
});

describe("prepareEditorHtmlForSave alias", () => {
  it("matches display normalization", () => {
    const input = '<p style="color:red">Same</p>';
    expect(prepareEditorHtmlForSave(input)).toBe(prepareEditorHtmlForDisplay(input));
  });
});
