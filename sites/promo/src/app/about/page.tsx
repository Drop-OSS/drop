import { AnimatedNumber } from '@/components/animated-number'
import { Container } from '@/components/container'
import { Footer } from '@/components/footer'
import { GradientBackground } from '@/components/gradient'
import { Navbar } from '@/components/navbar'
import { Team } from '@/components/team'
import { Heading, Lead, Subheading } from '@/components/text'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About',
  description:
    'About Drop OSS - what we do, what we believe, and what we aim to achieve.',
}

function Header() {
  return (
    <Container className="mt-16">
      <Heading as="h1">An open Steam.</Heading>
      <Lead className="mt-6 max-w-3xl">
        We&apos;re building an open-source alternative to platforms like Steam
        and Epic Games, enabling anyone to have full control over their gaming.
      </Lead>
      <section className="mt-16 grid grid-cols-1 lg:grid-cols-2 lg:gap-12">
        <div className="max-w-lg">
          <h2 className="text-2xl font-medium tracking-tight">Our mission</h2>
          <p className="mt-6 text-sm/6 text-zinc-400">
            We aim to build a &quot;Steam-like experience for DRM-free
            games&quot;. One of the major sticking points of DRM games, and why
            platforms like Steam have done so well, is that they provide awesome
            features like worldwide play-together, social features, and useful
            overlays and tools. We aim to replicate this for <i>any</i> game.
          </p>
          <p className="mt-8 text-sm/6 text-zinc-400">
            Don&apos;t get us wrong, we don&apos;t think Steam or Valve is bad.
            They are unusually consumer-friendly, and provide a great service.
            They will always have a place, providing a marketplace for DRM
            games. Drop aims to be the alternative.
          </p>
        </div>
        <div className="max-lg:mt-16 lg:col-span-1">
          <Subheading>The Numbers</Subheading>
          <hr className="mt-6 border-t border-zinc-800" />
          <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div className="flex flex-col gap-y-2 border-b border-dotted border-zinc-800 pb-4">
              <dt className="text-sm/6 text-zinc-400">Lines of code</dt>
              <dd className="order-first text-6xl font-medium tracking-tight">
                <AnimatedNumber start={0} end={75} />k
              </dd>
            </div>
            <div className="flex flex-col gap-y-2 border-b border-dotted border-zinc-800 pb-4">
              <dt className="text-sm/6 text-zinc-400">
                Individual open-source projects
              </dt>
              <dd className="order-first text-6xl font-medium tracking-tight">
                &gt;
                <AnimatedNumber start={0} end={5} />
              </dd>
            </div>
            <div className="flex flex-col gap-y-2 max-sm:border-b max-sm:border-dotted max-sm:border-gray-200 max-sm:pb-4">
              <dt className="text-sm/6 text-zinc-400">Docker pulls</dt>
              <dd className="order-first text-6xl font-medium tracking-tight">
                <AnimatedNumber start={0} end={210} decimals={1} />k
              </dd>
            </div>
            <div className="flex flex-col gap-y-2">
              <dt className="text-sm/6 text-zinc-400">Contributors</dt>
              <dd className="order-first text-6xl font-medium tracking-tight">
                &gt;
                <AnimatedNumber start={0} end={15} />
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </Container>
  )
}

function FrequentlyAskedQuestions() {
  return (
    <Container className="mt-32">
      <section id="faqs" className="scroll-mt-8">
        <Subheading className="">Frequently asked questions</Subheading>
        <Heading as="div" className="mt-2">
          Your questions answered.
        </Heading>
        <div className="mt-16 mb-32 max-w-xl space-y-12">
          <dl>
            <dt className="text-sm font-semibold">
              Do you intend to replace Steam?
            </dt>
            <dd className="mt-4 text-sm/6 text-zinc-400">
              No. Drop is not a replacement for Steam, in the sense that we will
              ever offer a marketplace for developers to sell games. Drop can
              replace Steam <i>for an individual</i>, if they only played
              DRM-free games that they bought from outside of Steam (like GOG).
            </dd>
          </dl>
          <dl>
            <dt className="text-sm font-semibold">
              Will Drop ever cost money or require a subscription?
            </dt>
            <dd className="mt-4 text-sm/6 text-zinc-400">
              We believe in <strong>paying for services, not code</strong>. All
              our projects are and always will be open source (AGPLv3), and we
              endeavour to allow users to self-host as much of it as possible.
              Where that is not possible, we may launch a subscription service -
              likely as a feature for multiplayer, to play between self-hosted
              Drop instances. Naturally, this service will also be available to
              self-host.
            </dd>
          </dl>
          <dl>
            <dt className="text-sm font-semibold">Is Drop legal?</dt>
            <dd className="mt-4 text-sm/6 text-zinc-400">
              Yes. Officially, Drop is <strong>only</strong> for DRM-free games,
              like the ones you purchase from GOG or download from itch.io,{' '}
              <strong>and</strong> that you have a license to redistribute. We
              cannot control whether you use Drop with cracked, pirated, or
              DRM-bypassed games or not, and do not condone the use of
              torrenting and automation software to automatically download
              games.
            </dd>
          </dl>
          <dl>
            <dt className="text-sm font-semibold">How can I support Drop or get involved?</dt>
            <dd className="mt-4 text-sm/6 text-zinc-400">
              Thank you for helping us out! If you&apos;re looking to contribute
              code, check out our{' '}
              <Link
                href="https://developer.droposs.org/contributing"
                className="text-blue-500 hover:underline"
                target="_blank"
              >
                developer contributing guide
              </Link>
              . If you&apos;re looking to contribute financially, you can join
              our{' '}
              <Link
                href="https://opencollective.com/drop-oss"
                className="text-blue-500 hover:underline"
                target="_blank"
              >
                OpenCollective
              </Link>
              , or click on individual contributors above and add to their
              personal pockets.
            </dd>
          </dl>
        </div>
      </section>
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
      <Header />
      <Team />
      <FrequentlyAskedQuestions />
      <Footer />
    </main>
  )
}
