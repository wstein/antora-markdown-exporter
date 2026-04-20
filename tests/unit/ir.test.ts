import { describe, expect, it } from "vitest";
import { convertAssemblyToMarkdownIR } from "../../src/exporter/convert-assembly.js";
import { normalizeMarkdownIR } from "../../src/markdown/normalize.js";

describe("Markdown IR boundary", () => {
  it("converts assembled AsciiDoc into a document IR", () => {
    const assembled = "== Sample\nHello world.";
    const ir = convertAssemblyToMarkdownIR(assembled);
    const normalized = normalizeMarkdownIR(ir);

    expect(normalized.type).toBe("document");
    expect(normalized.children[0]).toMatchObject({ type: "heading", depth: 2 });
    expect(normalized.children[1]).toMatchObject({ type: "paragraph" });
  });
});
