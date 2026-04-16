import { defineCollection, defineConfig } from '@content-collections/core'
import { compileMDX } from '@content-collections/mdx'
import { z } from 'zod'

const posts = defineCollection({
  name: 'Posts',
  directory: 'posts',
  include: '*.mdx',
  schema: z.object({
    title: z.string(),
    date: z.string(),
    image: z.string(),
    author: z.string(),
    tags: z.string(),
  }),
  async transform(data, context) {
    const paragraph = data.content
      .split('\n')
      .filter((e) => !e.startsWith('#'))
      .at(0)
    const excerpt = paragraph!.split(' ').slice(0, 20).join(' ') + '...'

    const mdx = await compileMDX(context, data)
    return { ...data, excerpt, url: `/news/${data._meta.path}`, mdx }
  },
})

export default defineConfig({
  collections: [posts],
})
