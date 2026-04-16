import { Container } from '@/components/container'
import DownloadCards from '@/components/downloads'
import { Footer } from '@/components/footer'
import { GradientBackground } from '@/components/gradient'
import { Navbar } from '@/components/navbar'
import { Heading, Lead, Subheading } from '@/components/text'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Download',
  description: 'Download the latest version of the Drop client.',
}

function Header() {
  return (
    <Container className="mt-16">
      <Heading as="h1" className="leading-12">
        Download
      </Heading>
      <Lead className="mt-6 max-w-3xl">
        Download the latest version of the Drop Desktop Client for your platform.
      </Lead>
      <Subheading className="mt-2">Last updated 15-11-2025</Subheading>
    </Container>
  )
}

export default function DownloadPage() {
  return (
    <main className="overflow-hidden">
      <GradientBackground />
      <Container>
        <Navbar />
      </Container>
      <Header />

      <DownloadCards />

      <Footer />
    </main>
  )
}
