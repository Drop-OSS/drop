import { Container } from '@/components/container'
import { Footer } from '@/components/footer'
import { Gallery } from '@/components/gallery-modal'
import { GradientBackground } from '@/components/gradient'
import { Navbar } from '@/components/navbar'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'A collection of screenshots, across all components of Drop.',
}


export default function About() {
  return (
    <main className="overflow-hidden">
      <GradientBackground />
      <Container>
        <Navbar />
      </Container>
      <Gallery />
      <Footer />
    </main>
  )
}
