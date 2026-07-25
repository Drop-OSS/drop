"use client";

import { MDXContent } from "@content-collections/mdx/react";
import type { Post } from "content-collections";
import { useMDXComponents } from "./mdx-components";

/**
 * Renders a post's MDX content.
 *
 * @param content - The post containing the MDX source
 * @returns The rendered MDX content
 */
export default function Content({ content }: { readonly content: Post }) {
  return <MDXContent code={content.mdx} components={useMDXComponents()} />;
}
