import News from '@/components/news'
import type { Metadata } from 'next'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'News',
  description: 'Stay up to date with updates and information about Drop.',
}

export default function NewsPage() {
  return <Suspense><News /></Suspense>
}
