import { BentoCard } from '@/components/bento-card'
import { Button } from '@/components/button'
import { Container } from '@/components/container'
import { Footer } from '@/components/footer'
import { Gradient } from '@/components/gradient'
import { LogoCluster } from '@/components/logo-cluster'
import { Navbar } from '@/components/navbar'
import { Heading, Subheading } from '@/components/text'
import { ArrowDownCircleIcon } from '@heroicons/react/24/solid'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  description:
    'Drop is an open-source, self-hostabled alternative to platforms like Steam and Epic Games.',
}

function Hero() {
  return (
    <div className="relative">
      <Gradient className="absolute inset-2 bottom-0 rounded-4xl ring-1 ring-black/5 ring-inset" />
      <Container className="relative">
        <Navbar />
        <div className="pt-16 pb-24 sm:pt-24 sm:pb-32 md:pt-32 md:pb-48">
          <h1 className="font-display text-6xl/[0.9] font-medium tracking-tight text-balance text-zinc-100 sm:text-8xl/[0.8] md:text-9xl/[0.8]">
            An open Steam.
          </h1>
          <p className="mt-8 max-w-lg text-xl/7 font-medium text-zinc-100/75 sm:text-2xl/8">
            Drop is an open-source, self-hosted alternative to platforms like
            Steam and Epic.
          </p>
          <div className="mt-12 flex flex-col gap-x-6 gap-y-4 sm:flex-row">
            <Button href="https://docs.droposs.org/docs/guides/quickstart">
              Get started
            </Button>
            <Button variant="outline" href="/about">
              About
            </Button>
          </div>
        </div>
      </Container>
    </div>
  )
}

function FeatureSection() {
  return (
    <div className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl sm:text-center">
          <Subheading>Drop OSS</Subheading>
          <Heading as="h3" className="mt-2 max-w-4xl">
            The ultimate self-hosted game manager.
          </Heading>

          <p className="mt-6 text-lg/8 text-zinc-400">
            Drop is built from the ground up to be flexible, fast, and
            beautiful. It's designed to scale with your library, and handle
            thousands of games.
          </p>
        </div>
      </div>
      <div className="relative overflow-hidden pt-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <img
            alt="App screenshot"
            src="/gallery/store.png"
            width={1920}
            height={1071}
            className="mb-[-5%] rounded-xl shadow-2xl ring-1 ring-gray-900/10"
          />
          <div aria-hidden="true" className="relative">
            <div className="absolute -inset-x-20 bottom-0 bg-linear-to-t from-zinc-950 pt-[7%]" />
          </div>
        </div>
      </div>
      <div className="mx-auto mt-16 max-w-7xl px-6 sm:mt-20 md:mt-24 lg:px-8">
        <dl className="mx-auto grid max-w-2xl grid-cols-1 gap-x-6 gap-y-10 text-base/7 text-zinc-400 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16">
          <div className="relative pl-9">
            <dt className="inline font-semibold text-zinc-100">
              <ArrowDownCircleIcon
                aria-hidden="true"
                className="absolute top-1 left-1 size-5 text-blue-600"
              />
              ADASDASD
            </dt>{' '}
            <dd className="inline">ASDASDASDAS</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

function BentoSection() {
  return (
    <Container>
      <Subheading>Features</Subheading>
      <Heading as="h3" className="mt-2 max-w-3xl">
        Upgrade your games library.
      </Heading>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-16 lg:grid-cols-6 lg:grid-rows-2">
        <BentoCard
          eyebrow="Metadata"
          title="Rich metadata editing"
          description="Drop has a rich metadata editor - you can use Markdown, images, and update icons, descriptions, and names."
          graphic={
            <div className="flex h-full w-full items-center justify-center p-4">
              <div className="bg-position-center h-full w-full grow rounded-lg bg-[url(/screenshots/metadata.webp)] bg-cover bg-no-repeat" />
            </div>
          }
          fade={['bottom']}
          className="max-lg:rounded-t-4xl lg:col-span-3 lg:rounded-tl-4xl"
        />
        <BentoCard
          eyebrow="Store"
          title="Let your users discover games"
          description="Drop has a fully featured store, where your users can discover and filter your game library, and create collections of their favourite games."
          graphic={
            <div className="flex h-full w-full items-center justify-center p-4">
              <div className="bg-position-center h-full w-full grow rounded-lg bg-[url(/screenshots/storepage.png)] bg-cover bg-no-repeat" />
            </div>
          }
          fade={['bottom']}
          className="lg:col-span-3 lg:rounded-tr-4xl"
        />
        <BentoCard
          eyebrow="Authentication"
          title="Flexible authentication"
          description="Drop supports both simple and SSO authentication, with more features like SCIM on the way."
          graphic={
            <div className="flex h-full w-full items-center justify-center p-4">
              <div className="bg-position-center h-full w-full grow rounded-lg bg-[url(/screenshots/authentication.png)] bg-cover bg-no-repeat" />
            </div>
          }
          fade={['bottom']}
          className="lg:col-span-2 lg:rounded-bl-4xl"
        />
        <BentoCard
          eyebrow="Metadata"
          title="Automatically import metadata"
          description="Drop can import metadata for your games from platforms like IGDB, GiantBomb, and PCGamingWiki."
          graphic={<LogoCluster />}
          className="lg:col-span-2"
        />
        <BentoCard
          eyebrow="News"
          title="Keep your users up-to-date with server news"
          description="Admins can write news articles that appear in-browser and client, to keep users up-to-date."
          fade={['bottom']}
          graphic={
            <div className="flex h-full w-full items-center justify-center p-4">
              <div className="bg-position-center h-full w-full grow rounded-lg bg-[url(/screenshots/news.png)] bg-cover bg-no-repeat" />
            </div>
          }
          className="max-lg:rounded-b-4xl lg:col-span-2 lg:rounded-br-4xl"
        />
      </div>
    </Container>
  )
}

export default function Home() {
  return (
    <div className="overflow-hidden">
      <Hero />
      <main>
        <div className="bg-linear-to-b pb-16">
          <FeatureSection />
          <BentoSection />
        </div>
      </main>
      <Footer />
    </div>
  )
}
