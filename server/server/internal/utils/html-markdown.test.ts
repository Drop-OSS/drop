import { test } from "node:test";
import assert from "node:assert/strict";
import { firstParagraphAsText, htmlToMarkdown } from "./html-markdown";

// The Steam path is pinned byte-for-byte: these rules were moved out of
// steam.ts, so any accidental drift changes stored descriptions on refresh.
const STEAM_HTML = [
  "<h1>About</h1>",
  "<p>Hello <strong>world</strong>.</p>",
  "<p>Shot:</p>",
  '<img src="https://cdn.example/a.jpg">',
  "<ul><li>One</li><li>Two</li></ul>",
].join("");

test("createObject mode matches Steam's conversion exactly", () => {
  const seen: string[] = [];
  const result = htmlToMarkdown(STEAM_HTML, {
    createObject: (input) => {
      seen.push(String(input));
      return `obj${seen.length}`;
    },
  });

  assert.deepEqual(seen, ["https://cdn.example/a.jpg"]);
  assert.deepEqual(result.objects, ["obj1"]);
  assert.equal(
    result.markdown,
    "# About\n\nHello **world**.Shot:\n\n![](/api/v1/object/obj1)\n\n- One\n- Two",
  );
});

test("without createObject images are dropped but the text is kept", () => {
  const result = htmlToMarkdown(
    '<p>Before <img src="https://cdn.example/a.jpg"> after</p>',
  );
  assert.deepEqual(result.objects, []);
  assert.equal(result.markdown, "Before  after");
});

test("GOG-style paragraphs and headings keep their breaks", () => {
  // Real payload shape (live-verified Nov 2026): paragraphs are separated by
  // blank lines in the source, images sit alone in a padded paragraph.
  const html = [
    "<p>\nMankind turned Earth into a wasteland.\n</p>",
    "<p>\n&nbsp;\n</p>",
    "<h4>Beaver societies</h4>",
    '<p>\n&nbsp;<img src="https://items.gog.com/factions.gif">\n</p>',
    "<p>\nControl one of two factions.\n</p>",
  ].join("\n");
  assert.equal(
    htmlToMarkdown(html).markdown,
    "Mankind turned Earth into a wasteland.\n\n#### Beaver societies\n\nControl one of two factions.",
  );
});

test("empty HTML yields an empty document", () => {
  assert.deepEqual(htmlToMarkdown(""), { markdown: "", objects: [] });
  assert.deepEqual(htmlToMarkdown("   "), { markdown: "", objects: [] });
});

test("firstParagraphAsText skips padding and decodes entities", () => {
  assert.equal(
    firstParagraphAsText(
      "<p>\n&nbsp;\n</p><p>&nbsp;</p><p>Ship &amp; survive.</p><p>More.</p>",
    ),
    "Ship & survive.",
  );
});

test("firstParagraphAsText falls back to the whole document", () => {
  assert.equal(
    firstParagraphAsText("Just a line<br>and another"),
    "Just a line and another",
  );
  assert.equal(firstParagraphAsText(""), "");
});

test("firstParagraphAsText truncates on a word boundary", () => {
  const text = firstParagraphAsText(`<p>${"word ".repeat(100)}</p>`);
  assert.ok(text.length <= 280);
  assert.ok(text.endsWith("..."));
  assert.ok(!text.slice(0, -3).endsWith("wor"));
  assert.equal(firstParagraphAsText("<p>short</p>", 10), "short");
});
