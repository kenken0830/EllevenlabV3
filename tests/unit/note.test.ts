import { describe, expect, it } from "vitest";

import { parseNoteContent } from "../../src/note.js";

describe("parseNoteContent", () => {
  it("parses front matter and body", () => {
    const parsed = parseNoteContent(`---
id: note-01
title: Example
---

一行目。
二行目。`);

    expect(parsed.metadata).toEqual({
      id: "note-01",
      title: "Example",
    });
    expect(parsed.body).toBe("一行目。\n二行目。");
  });

  it("accepts note content without front matter", () => {
    const parsed = parseNoteContent("一行目。\n二行目。");

    expect(parsed.metadata).toEqual({});
    expect(parsed.body).toBe("一行目。\n二行目。");
  });
});
