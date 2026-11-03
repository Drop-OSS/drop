/**
 * HTML -> Markdown conversion shared by the metadata providers and the
 * storefront provider-info helpers. The conversion rules are Steam's (built
 * for the bb_* classes its store descriptions use), which also cover the
 * plain `<p>`/`<h4>`/`<img>` markup GOG publishes.
 *
 * Embedded images have two modes:
 *  - with `createObject`, every `<img>` becomes an object-store placeholder
 *    (`![](/api/v1/object/{id})`) and its id is returned in `objects` -
 *    this is the Steam path and its output must stay byte-identical;
 *  - without it, `<img>` tags are dropped and the surrounding text kept -
 *    the GOG path, where product images are not mirrored.
 */

type CreateObject = (input: string | Buffer) => string;

export type HtmlToMarkdownOptions = {
  createObject?: CreateObject;
};

export type HtmlToMarkdownResult = {
  markdown: string;
  /** Object ids created for embedded images, in document order. */
  objects: string[];
};

export function htmlToMarkdown(
  html: string,
  options: HtmlToMarkdownOptions = {},
): HtmlToMarkdownResult {
  if (!html || html.trim().length === 0) return { markdown: "", objects: [] };

  const { createObject } = options;
  let markdown = html;
  const objects: string[] = [];
  const imageReplacements: { placeholder: string; imageId: string }[] = [];

  markdown = convertBasicHtmlElements(markdown);

  if (createObject) {
    // Replace images with placheholders
    markdown = markdown.replace(
      /<img[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi,
      (match, src) => {
        const imageId = createObject(src);
        objects.push(imageId);
        const placeholder = `__IMG_${imageReplacements.length}__`;
        imageReplacements.push({ placeholder, imageId });
        return placeholder;
      },
    );
  } else {
    // No object store: drop the image, keep the prose around it.
    markdown = markdown.replace(/<img[^>]*>/gi, "");
  }

  markdown = convertRemainingHtmlElements(markdown);

  markdown = stripHtmlTags(markdown);

  markdown = cleanupBasicFormatting(markdown);

  markdown = processImagePlaceholders(markdown, imageReplacements);

  markdown = finalCleanup(markdown);

  return { markdown, objects };
}

/**
 * The first meaningful paragraph of an HTML blurb as single-line plain text,
 * capped at `maxLength` characters. Empty (or `&nbsp;`-only) leading
 * paragraphs are skipped, which is how store descriptions often pad their
 * summary above the hero image.
 */
export function firstParagraphAsText(html: string, maxLength = 280): string {
  if (!html) return "";

  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => normalizeWhitespace(stripHtmlTags(match[1] ?? "")))
    .filter(Boolean);
  const fallback = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, " ");
  const text = paragraphs[0] ?? normalizeWhitespace(stripHtmlTags(fallback));
  if (!text) return "";
  if (text.length <= maxLength) return text;

  // Cut on a word boundary when one is close enough to the cap; the
  // ellipsis counts towards maxLength.
  let cut = text.slice(0, Math.max(0, maxLength - 3));
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > Math.floor(cut.length * 0.6)) cut = cut.slice(0, lastSpace);
  return `${cut.trimEnd()}...`;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function convertBasicHtmlElements(markdown: string): string {
  // Remove HTML comments
  markdown = markdown.replace(/<!--[\s\S]*?-->/g, "");

  // Convert the bullet points and tabs to markdown list format
  markdown = markdown.replace(/•\s*\t+/g, "\n- ");

  // Handle numbered enumeration (1.\t, 2.\t, etc.)
  markdown = markdown.replace(/(\d+)\.\s*\t+/g, "\n$1. ");

  // Convert bold text
  markdown = markdown.replace(
    /<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi,
    "**$2**",
  );

  // Convert headers (h1-h6) with Steam's bb_tag class
  markdown = markdown.replace(
    /<h([1-6])(?:\s+class="bb_tag")?[^>]*>(.*?)<\/h[1-6]>/gi,
    (_, level, content) => {
      const headerLevel = "#".repeat(parseInt(level));
      const cleanContent = stripHtmlTags(content).trim();
      return cleanContent ? `\n\n${headerLevel} ${cleanContent}\n\n` : "";
    },
  );

  return markdown;
}

function convertRemainingHtmlElements(markdown: string): string {
  // Convert paragraphs with Steam's bb_paragraph class
  markdown = markdown.replace(
    /<p(?:\s+class="bb_paragraph")?[^>]*>(.*?)<\/p>/gi,
    (_, content) => {
      const cleanContent = stripHtmlTags(content).trim();
      return cleanContent ? `${cleanContent}` : "";
    },
  );

  // Convert unordered lists with Steam's bb_ul class
  markdown = markdown.replace(
    /<ul(?:\s+class="bb_ul")?[^>]*>([\s\S]*?)<\/ul>/gi,
    (_, content) => {
      const listItems = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      const markdownItems = listItems
        .map((item: string) => {
          const cleanItem = item.replace(/<li[^>]*>([\s\S]*?)<\/li>/i, "$1");
          const cleanContent = stripHtmlTags(cleanItem).trim();
          return cleanContent ? `- ${cleanContent}` : "";
        })
        .filter(Boolean);
      return markdownItems.length > 0 ? `${markdownItems.join("\n")}\n` : "";
    },
  );

  // Convert ordered lists with Steam's bb_ol class
  markdown = markdown.replace(
    /<ol(?:\s+class="bb_ol")?[^>]*>([\s\S]*?)<\/ol>/gi,
    (_, content) => {
      const listItems = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      const markdownItems = listItems
        .map((item: string, index: number) => {
          const cleanItem = item.replace(/<li[^>]*>([\s\S]*?)<\/li>/i, "$1");
          const cleanContent = stripHtmlTags(cleanItem).trim();
          return cleanContent ? `${index + 1}. ${cleanContent}` : "";
        })
        .filter(Boolean);
      return markdownItems.length > 0 ? `${markdownItems.join("\n")}\n` : "";
    },
  );

  // Convert line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, "\n");

  // Convert italic text with <em> and <i> tags
  markdown = markdown.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, "*$2*");

  // Convert underlined text
  markdown = markdown.replace(/<u[^>]*>(.*?)<\/u>/gi, "_$1_");

  // Convert links
  markdown = markdown.replace(
    /<a[^>]*href\s*=\s*["']([^"']+)["'][^>]*>(.*?)<\/a>/gi,
    "[$2]($1)",
  );

  // Convert divs to line breaks (common in Steam descriptions)
  markdown = markdown.replace(/<div[^>]*>(.*?)<\/div>/gi, "$1\n");

  // Handle span tags with bb_img_ctn class (Steam image containers)
  markdown = markdown.replace(
    /<span\s+class="bb_img_ctn"[^>]*>(.*?)<\/span>/gi,
    "$1",
  );

  return markdown;
}

function cleanupBasicFormatting(markdown: string): string {
  // Clean up spaces before newlines
  markdown = markdown.replace(/ +\n/g, "\n");

  // Clean up excessive spacing around punctuation
  markdown = markdown.replace(/\s+([.,!?;:])/g, "$1");

  return markdown;
}

function processImagePlaceholders(
  markdown: string,
  imageReplacements: { placeholder: string; imageId: string }[],
): string {
  const lines = markdown.split("\n");
  const processedLines: string[] = [];

  for (const line of lines) {
    const replacedLines = replacePlaceholdersInLine(line, imageReplacements);
    processedLines.push(...replacedLines);
  }

  return processedLines.join("\n");
}

function replacePlaceholdersInLine(
  line: string,
  imageReplacements: { placeholder: string; imageId: string }[],
): string[] {
  const currentLine = line;
  const results: string[] = [];

  // Find all placeholders
  const placeholdersInLine = imageReplacements.filter(({ placeholder }) =>
    currentLine.includes(placeholder),
  );

  if (placeholdersInLine.length === 0) {
    return [line];
  }

  // Sort placeholders by their position
  placeholdersInLine.sort(
    (a, b) =>
      currentLine.indexOf(a.placeholder) - currentLine.indexOf(b.placeholder),
  );

  let lastIndex = 0;

  for (const { placeholder, imageId } of placeholdersInLine) {
    const placeholderIndex = currentLine.indexOf(placeholder, lastIndex);

    if (placeholderIndex === -1) continue;

    // Add text before the placeholder (if any)
    const beforeText = currentLine.substring(lastIndex, placeholderIndex);
    if (beforeText.trim()) {
      results.push(beforeText.trim());
      results.push(""); // Empty line before image
    }

    results.push(`![](/api/v1/object/${imageId})`);

    lastIndex = placeholderIndex + placeholder.length;
  }

  // Add any remaining text after the last placeholder
  const afterText = currentLine.substring(lastIndex);
  if (afterText.trim()) {
    results.push(""); // Empty line after image
    results.push(afterText.trim());
  }

  // If we only have images and no text, return just the images
  if (
    results.every(
      (line) => line === "" || line.startsWith("![](/api/v1/object/"),
    )
  ) {
    return results.filter((line) => line !== "");
  }

  return results;
}

function finalCleanup(markdown: string): string {
  // Clean up multiple consecutive newlines
  markdown = markdown.replace(/\n{3,}/g, "\n\n");

  markdown = markdown.trim();

  return markdown;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
