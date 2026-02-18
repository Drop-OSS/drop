import { Button } from '@/components/button'
import { Container } from '@/components/container'
import { Footer } from '@/components/footer'
import { GradientBackground } from '@/components/gradient'
import { Navbar } from '@/components/navbar'
import { Sponsors } from '@/components/sponsors'
import { Heading, Lead, Subheading } from '@/components/text'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sponsors',
  description: 'Thanking the people who contribute financially to the project.',
}

function CTA() {
  return (
    <Container className="py-32">
      <Subheading>Contribute</Subheading>
      <Heading as="h3" className="mt-2">
        How can I help out?
      </Heading>
      <Lead className="mt-6 max-w-3xl">
        Sign up to our OpenCollective, or become a GitHub sponsor to give back
        to the project.
      </Lead>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div className="max-w-lg">
          <p className="text-sm/6 text-zinc-400">
            If you&apos;re looking to give back to the project financially -
            first off, thank you. It really does help a lot. There are two
            options for contributing: our OpenCollective, which funds
            project-only expenses, like infrastructure and domain names, and
            GitHub Sponsors, which goes directly to developers, and help them
            pay the bills and keep them motivated.
          </p>
          <div className="mt-6 space-x-4">
            <Button
              className="w-full sm:w-auto"
              href="https://opencollective.com/drop-oss"
              target="_blank"
            >
              OpenCollective &rarr;
            </Button>
            <Button
              className="w-full sm:w-auto"
              href="/about#team"
            >
              Team &rarr;
            </Button>
          </div>
        </div>
      </div>
    </Container>
  )
}

export default function About() {
  return (
    <main className="overflow-hidden">
      <GradientBackground />
      <Container>
        <Navbar />
      </Container>

      <Sponsors />
      <CTA />

      <Footer />
    </main>
  )
}
