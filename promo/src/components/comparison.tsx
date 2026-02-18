'use client'

import { Button } from '@/components/button'
import { Container } from '@/components/container'
import { Footer } from '@/components/footer'
import { Gradient, GradientBackground } from '@/components/gradient'
import { Link } from '@/components/link'
import { Mark } from '@/components/logo'
import { Navbar } from '@/components/navbar'
import { Heading, Lead, Subheading } from '@/components/text'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import {
  CheckIcon,
  ChevronUpDownIcon,
  MinusIcon,
} from '@heroicons/react/16/solid'
import { useSearchParams } from 'next/navigation'
import type React from 'react'
function DropLogo() {
  return (
    <div className="relative -mb-1 inline-flex items-center justify-center gap-x-1">
      <svg
        aria-hidden="true"
        viewBox="0 0 418 42"
        className="absolute inset-0 h-full w-full scale-75 fill-blue-300/30"
        preserveAspectRatio="none"
      >
        <path d="M203.371.916c-26.013-2.078-76.686 1.963-124.73 9.946L67.3 12.749C35.421 18.062 18.2 21.766 6.004 25.934 1.244 27.561.828 27.778.874 28.61c.07 1.214.828 1.121 9.595-1.176 9.072-2.377 17.15-3.92 39.246-7.496C123.565 7.986 157.869 4.492 195.942 5.046c7.461.108 19.25 1.696 19.17 2.582-.107 1.183-7.874 4.31-25.75 10.366-21.992 7.45-35.43 12.534-36.701 13.884-2.173 2.308-.202 4.407 4.442 4.734 2.654.187 3.263.157 15.593-.78 35.401-2.686 57.944-3.488 88.365-3.143 46.327.526 75.721 2.23 130.788 7.584 19.787 1.924 20.814 1.98 24.557 1.332l.066-.011c1.201-.203 1.53-1.825.399-2.335-2.911-1.31-4.893-1.604-22.048-3.261-57.509-5.556-87.871-7.36-132.059-7.842-23.239-.254-33.617-.116-50.627.674-11.629.54-42.371 2.494-46.696 2.967-2.359.259 8.133-3.625 26.504-9.81 23.239-7.825 27.934-10.149 28.304-14.005.417-4.348-3.529-6-16.878-7.066Z" />
      </svg>
      <Mark aria-hidden="true" className="h-6" />
      <span className="font-display text-xl font-bold text-blue-400 uppercase">
        Drop
      </span>
    </div>
  )
}

function GameVaultLogo() {
  return (
    <div className="inline-flex items-center gap-x-2 text-xl font-bold">
      <img src="/icons/gamevault.png" alt="GameVault Logo" className="size-8" />
      <span className="relative whitespace-nowrap text-zinc-100">
        <svg
          aria-hidden="true"
          viewBox="0 0 418 42"
          className="absolute top-2/3 left-0 h-[0.58em] w-full fill-purple-900 opacity-30"
          preserveAspectRatio="none"
        >
          <path d="M203.371.916c-26.013-2.078-76.686 1.963-124.73 9.946L67.3 12.749C35.421 18.062 18.2 21.766 6.004 25.934 1.244 27.561.828 27.778.874 28.61c.07 1.214.828 1.121 9.595-1.176 9.072-2.377 17.15-3.92 39.246-7.496C123.565 7.986 157.869 4.492 195.942 5.046c7.461.108 19.25 1.696 19.17 2.582-.107 1.183-7.874 4.31-25.75 10.366-21.992 7.45-35.43 12.534-36.701 13.884-2.173 2.308-.202 4.407 4.442 4.734 2.654.187 3.263.157 15.593-.78 35.401-2.686 57.944-3.488 88.365-3.143 46.327.526 75.721 2.23 130.788 7.584 19.787 1.924 20.814 1.98 24.557 1.332l.066-.011c1.201-.203 1.53-1.825.399-2.335-2.911-1.31-4.893-1.604-22.048-3.261-57.509-5.556-87.871-7.36-132.059-7.842-23.239-.254-33.617-.116-50.627.674-11.629.54-42.371 2.494-46.696 2.967-2.359.259 8.133-3.625 26.504-9.81 23.239-7.825 27.934-10.149 28.304-14.005.417-4.348-3.529-6-16.878-7.066Z"></path>
        </svg>
        <span className="relative">GameVault</span>
      </span>
    </div>
  )
}

function GameVaultPlus() {
  return (
    <div className="inline-flex items-center gap-x-1 rounded-full bg-zinc-800 px-2 py-1 text-xs">
      <img
        src="/icons/gamevault-plus.png"
        alt="GameVault+ icon"
        className="size-4"
      />
      GameVault+
    </div>
  )
}

function ComingSoon() {
  return (
    <div className="inline-flex items-center gap-x-1 rounded-full bg-zinc-900 px-2 py-1 text-xs">
      coming soon&trade;
    </div>
  )
}

function RomMLogo() {
  return (
    <div className={'inline-flex items-center gap-x-2'}>
      <img src="/icons/rommicon.svg" className="size-8" alt="RomM icon" />
      <img src="/icons/rommmark.png" className="h-4" alt="RomM workmark" />
    </div>
  )
}

const projects: Array<{
  name: string
  slug: string
  logo: () => React.JSX.Element
  description: string
  href: string
  highlights: Array<{ description: string; disabled?: boolean; paid?: boolean }>
  features: {
    [key: string]: {
      [key: string]: number | string | boolean | (() => React.JSX.Element)
    }
  }
}> = [
  {
    name: 'Drop OSS' as const,
    slug: 'drop',
    logo: DropLogo,
    description: 'An open-source and free self-hosted Steam alternative.',
    href: '/',
    highlights: [
      { description: 'First-class Linux support' },
      { description: 'Game versioning' },
      { description: 'Multiple metadata sources' },
      { description: 'Cloud saves & playtime tracking', disabled: true },
      {
        description: 'Overlay network for Steam-like play together',
        disabled: true,
      },
    ],
    features: {
      Library: {
        'Multiple libraries': true,
        'Versioned layout': true,
        'Non-versioned layout': true,
        'Installer/setup games': true,
        'Portable games': true,
        'Archives support': 'All 7-zip formats',
        'Automatic import': 'Bulk-import tool',
      },
      Metadata: {
        'Additional with plugins': false,
        IGDB: true,
        GiantBomb: true,
        PCGamingWiki: true,
        Manual: true,
        Steam: true,
      },
      Clients: {
        Windows: true,
        Linux: true,
        macOS: true,
        Android: ComingSoon,
      },
      Authentication: {
        Simple: true,
        SSO: true,
      },
      Cloud: {
        'Cloud saves': ComingSoon,
        'Steamworks-compatible networking': ComingSoon,
        'Dedicated server discovery': ComingSoon,
      },
      'Client Features': {
        'Proton compatible for Linux': true,
        'Multi-server': ComingSoon,
        'In-game overlay': ComingSoon,
      },
      Additional: {
        'User collections': true,
        'Server news': true,
      },
    },
  },
  {
    name: 'GameVault' as const,
    slug: 'gamevault',
    logo: GameVaultLogo,
    description:
      'A source-available, mature Steam-like experience for your home server.',
    href: 'https://gamevau.lt/',
    highlights: [
      { description: 'Native Windows app' },
      { description: 'Published on Microsoft Store' },
      { description: 'Playtime tracking' },
      { description: 'Cloud saves', paid: true },
      { description: 'Third-party integrations', paid: true },
    ],
    features: {
      Library: {
        'Multiple libraries': 'Using Docker volumes or symlinks',
        'Automatic import': true,
        'Non-versioned layout': true,
        'Installer/setup games': true,
        'Portable games': true,
        'Archives support': 'All 7-zip formats',
      },
      Metadata: {
        'Additional with plugins': true,
        IGDB: true,
        Manual: true,
        VNDB: 'Community plugin',
      },
      Clients: {
        Windows: true,
        Linux: true,
        macOS: true,
      },
      Authentication: {
        Simple: true,
        SSO: true,
      },
      Cloud: {
        'Cloud saves': GameVaultPlus,
      },
      'Client Features': {
        'Multi-server': true,
        Theming: GameVaultPlus,
        'Multi-profile usage': GameVaultPlus,
        'Playnite integration': GameVaultPlus,
        'Steam integration': GameVaultPlus,
        'Discord integration': GameVaultPlus,
      },
      Additional: {
        'Parental controls': true,
        'Server news': true,
      },
    },
  },
  {
    name: 'RomM' as const,
    slug: 'romm',
    logo: RomMLogo,
    description:
      'An open-source, self-hosted rom manager, with built-in large emulator support.',
    href: 'https://romm.app/',
    highlights: [
      { description: '400+ supported platforms' },
      { description: 'Web-based (EmulatorJS) emulation' },
      { description: 'Multiple metadata sources' },
      { description: 'Android app' },
      { description: 'Cloud sync', disabled: true },
    ],
    features: {
      Library: {
        'Non-versioned layout': true,
        'Automatic import': true,
        'Archives support': 'All 7-zip formats',
        'Portable games': true,
      },
      Metadata: {
        IGDB: true,
        Hasheous: true,
        SteamGridDB: true,
        Retroachievements: true,
        PlayMatch: true,
        ScreenScraper: true,
        LaunchBox: true,
      },
      Clients: {
        Browser: true,
        Android: true,
        muOS: true,
      },
      'Client Features': {
        'Playnite integration': true,
      },
      Authentication: {
        Simple: true,
        SSO: true,
      },
      Cloud: {
        'Cloud saves': ComingSoon,
      },
    },
  },
]

function Header() {
  return (
    <Container className="mt-16">
      <Heading as="h1" className="leading-12">
        What&apos;s the{' '}
        <span className="rounded-xl bg-zinc-900 px-3 py-2 font-mono text-zinc-300">
          git&nbsp;diff
        </span>
        ?
      </Heading>
      <Lead className="mt-6 max-w-3xl">
        A breakdown between the different projects available to you, put
        together by the Drop OSS project.
      </Lead>
      <Subheading className="mt-2">Last updated 19-01-2026</Subheading>
    </Container>
  )
}

function ProjectCards() {
  return (
    <div className="relative py-24">
      <Gradient className="absolute inset-x-2 top-48 bottom-0 rounded-4xl ring-1 ring-black/5 ring-inset" />
      <Container className="relative">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {projects.map((tier, tierIndex) => (
            <ProjectCard key={tierIndex} tier={tier} />
          ))}
        </div>
      </Container>
    </div>
  )
}

function ProjectCard({ tier }: { tier: (typeof projects)[number] }) {
  return (
    <div className="-m-2 grid grid-cols-1 rounded-4xl shadow-[inset_0_0_2px_1px_#ffffff4d] ring-1 ring-white/5 max-lg:mx-auto max-lg:w-full max-lg:max-w-md">
      <div className="grid grid-cols-1 rounded-4xl p-2 shadow-md shadow-black/5">
        <div className="rounded-3xl bg-zinc-900 p-10 pb-9 shadow-2xl ring-1 ring-black/5">
          <div className="flex w-full items-center justify-center pb-8">
            {tier.logo()}
          </div>

          <Subheading>{tier.name}</Subheading>
          <p className="mt-2 text-sm/6 text-zinc-100/75">{tier.description}</p>
          <div className="mt-8">
            <Button href={tier.href}>Learn more &rarr;</Button>
          </div>
          <div className="mt-8">
            <h3 className="text-sm/6 font-medium text-zinc-100">
              Key features:
            </h3>
            <ul className="mt-3 space-y-3">
              {tier.highlights.map((props, featureIndex) => (
                <FeatureItem key={featureIndex} {...props} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProjectTable({
  selectedProject,
}: {
  selectedProject: (typeof projects)[number]
}) {
  function onlyUnique<T>(value: T, index: number, array: Array<T>) {
    return array.indexOf(value) === index
  }

  const sections = projects
    .map((e) => Object.keys(e.features))
    .flat()
    .filter(onlyUnique)
  const features: { [key: string]: string[] } = {}
  for (const section of sections) {
    const uniqueFeatures = projects
      .filter((e) => e.features[section])
      .map((e) => Object.keys(e.features[section]))
      .flat()
      .filter(onlyUnique)
    features[section] = uniqueFeatures
  }
  return (
    <Container className="py-24">
      <table className="w-full text-left">
        <caption className="sr-only">Project comparison</caption>
        <colgroup>
          <col className="w-3/5 sm:w-2/5" />
          <col
            data-selected={selectedProject === projects[0] ? true : undefined}
            className="w-2/5 data-selected:table-column max-sm:hidden sm:w-1/5"
          />
          <col
            data-selected={selectedProject === projects[1] ? true : undefined}
            className="w-2/5 data-selected:table-column max-sm:hidden sm:w-1/5"
          />
          <col
            data-selected={selectedProject === projects[2] ? true : undefined}
            className="w-2/5 data-selected:table-column max-sm:hidden sm:w-1/5"
          />
        </colgroup>
        <thead>
          <tr className="max-sm:hidden">
            <td className="p-0" />
            {projects.map((project) => (
              <th
                key={project.slug}
                scope="col"
                data-selected={selectedProject === project ? true : undefined}
                className="p-0 data-selected:table-cell max-sm:hidden"
              >
                <Subheading as="div">{project.name}</Subheading>
              </th>
            ))}
          </tr>
          <tr className="sm:hidden">
            <td className="p-0">
              <div className="relative inline-block">
                <Menu>
                  <MenuButton className="flex items-center justify-between gap-2 font-medium">
                    {selectedProject.name}
                    <ChevronUpDownIcon className="size-4 fill-zinc-100" />
                  </MenuButton>
                  <MenuItems
                    anchor="bottom start"
                    className="min-w-(--button-width) rounded-lg bg-white p-1 shadow-lg ring-1 ring-gray-200 [--anchor-gap:6px] [--anchor-offset:-4px] [--anchor-padding:10px]"
                  >
                    {projects.map((tier) => (
                      <MenuItem key={tier.slug}>
                        <Link
                          scroll={false}
                          href={`/comparison?tier=${tier.slug}`}
                          data-selected={
                            tier === selectedProject ? true : undefined
                          }
                          className="group flex items-center gap-2 rounded-md px-2 py-1 data-focus:bg-gray-200"
                        >
                          {tier.name}
                          <CheckIcon className="hidden size-4 group-data-selected:block" />
                        </Link>
                      </MenuItem>
                    ))}
                  </MenuItems>
                </Menu>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center">
                  <ChevronUpDownIcon className="size-4 fill-gray-900" />
                </div>
              </div>
            </td>
            <td colSpan={3} className="p-0 text-right">
              <Button variant="outline" href={selectedProject.href}>
                Get started
              </Button>
            </td>
          </tr>
          <tr className="max-sm:hidden">
            <th className="p-0" scope="row">
              <span className="sr-only">Get started</span>
            </th>
            {projects.map((tier) => (
              <td
                key={tier.slug}
                data-selected={selectedProject === tier ? true : undefined}
                className="px-0 pt-4 pb-0 data-selected:table-cell max-sm:hidden"
              >
                <Button variant="outline" href={tier.href}>
                  Get started
                </Button>
              </td>
            ))}
          </tr>
        </thead>
        {sections.map((section) => (
          <tbody key={section} className="group">
            <tr>
              <th
                scope="colgroup"
                colSpan={4}
                className="px-0 pt-10 pb-0 group-first-of-type:pt-5"
              >
                <div className="-mx-4 rounded-lg bg-zinc-900 px-4 py-3 text-sm/6 font-semibold">
                  {section}
                </div>
              </th>
            </tr>
            {features[section].map((name) => (
              <tr
                key={name}
                className="border-b border-zinc-800 last:border-none"
              >
                <th
                  scope="row"
                  className="px-0 py-4 text-sm/6 font-normal text-zinc-200"
                >
                  {name}
                </th>
                {projects.map((project) => {
                  let value = project.features[section]?.[name]

                  return (
                    <td
                      key={project.slug}
                      data-selected={
                        selectedProject === project ? true : undefined
                      }
                      className="p-4 data-selected:table-cell max-sm:hidden"
                    >
                      {typeof value === 'function' ? (
                        <>{value()}</>
                      ) : value === true ? (
                        <>
                          <CheckIcon className="size-4 fill-green-600" />
                          <span className="sr-only">
                            Included in {project.name}
                          </span>
                        </>
                      ) : value === false || value === undefined ? (
                        <>
                          <MinusIcon className="size-4 fill-gray-400" />
                          <span className="sr-only">
                            Not included in {project.name}
                          </span>
                        </>
                      ) : (
                        <div className="text-xs text-zinc-400">{value}</div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </Container>
  )
}

function FeatureItem({
  description,
  disabled = false,
  paid = false,
}: {
  description: string
  disabled?: boolean
  paid?: boolean
}) {
  return (
    <li
      data-disabled={disabled ? true : undefined}
      className="flex items-center gap-4 text-sm/6 text-zinc-100/75 data-disabled:text-zinc-100/40"
    >
      <span className="inline-flex h-6 items-center self-start">
        <PlusIcon className="size-3.75 shrink-0 fill-zinc-100/25" />
      </span>
      {disabled && <span className="sr-only">Coming soon:</span>}
      {description}
      {disabled && (
        <span className="text-right text-xs text-blue-300">
          coming soon&trade;
        </span>
      )}
      {paid && <GameVaultPlus />}
    </li>
  )
}

function PlusIcon(props: React.ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 15 15" aria-hidden="true" {...props}>
      <path clipRule="evenodd" d="M8 0H7v7H0v1h7v7h1V8h7V7H8V0z" />
    </svg>
  )
}

export default function Pricing() {
  let params = useSearchParams()
  let tier =
    typeof params.get('tier') === 'string'
      ? projects.find(({ slug }) => slug === params.get('tier'))!
      : projects[0]

  return (
    <main className="overflow-hidden">
      <GradientBackground />
      <Container>
        <Navbar />
      </Container>
      <Header />
      <ProjectCards />
      <ProjectTable selectedProject={tier} />
      <Footer />
    </main>
  )
}
