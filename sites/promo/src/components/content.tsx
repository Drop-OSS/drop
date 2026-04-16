'use client'

import { MDXContent } from '@content-collections/mdx/react'
import type { Post } from 'content-collections'
import { useMDXComponents } from './mdx-components'

export default function Content({ content }: { content: Post }) {
  return <MDXContent code={content.mdx} components={useMDXComponents()} />
}
