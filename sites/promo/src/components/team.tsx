'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from './button'
import { Container } from './container'
import { Heading, Lead, Subheading } from './text'

function Person({
  name,
  description,
  img,
  contributions,
}: {
  name: string
  description: string
  img: string
  contributions: number
}) {
  return (
    <li>
      <Link
        href={`https://github.com/${name}`}
        target="_blank"
        className="group flex items-center gap-4"
      >
        <img alt="" src={img} className="size-12 rounded-full" />
        <div className="text-sm/6">
          <h3 className="font-medium group-hover:underline">{name}</h3>
          <p className="text-zinc-400">{description}</p>
          <p className="text-xs font-semibold text-blue-600/80">
            {contributions} contribution(s)
          </p>
        </div>
      </Link>
    </li>
  )
}

type TeamObject = {
  login: string
  avatar_url: string
  contributions: number
  type: 'User'
}

const descriptionOverride: { [key: string]: string } = {
  DecDuck: 'Lead Maintainer',
  quexeky: 'Maintainer',
}

export function Team() {
  const [team, setTeam] = useState<Array<TeamObject> | null>(null)

  useEffect(() => {
    ;(async () => {
      const cached = window.localStorage.getItem('team')
      if (cached) {
        const cachedData = JSON.parse(cached)
        if (cachedData.created + 1000 * 60 * 60 * 24 * 1 > Date.now()) {
          setTeam(cachedData.team)
          return
        }
      }

      const dropTeam: Array<TeamObject> = await (
        await fetch('https://api.github.com/repos/Drop-OSS/drop/contributors')
      ).json()
      const dropAppTeam: Array<TeamObject> = await (
        await fetch(
          'https://api.github.com/repos/Drop-OSS/drop-app/contributors',
        )
      ).json()

      const teamObj: { [key: string]: TeamObject } = {}
      for (const user of [...dropTeam, ...dropAppTeam]) {
        if (user.login === 'weblate' || user.type !== 'User') continue
        if (teamObj[user.login]) {
          teamObj[user.login].contributions += user.contributions
        } else {
          teamObj[user.login] = user
        }
      }
      const team = Object.values(teamObj).sort(
        (a, b) => b.contributions - a.contributions,
      )

      window.localStorage.setItem(
        'team',
        JSON.stringify({ team, created: Date.now() }),
      )
      setTeam(team)
    })()
  }, [])

  return (
    <Container className="mt-32">
      <Subheading>Meet the developers</Subheading>
      <Heading as="h3" className="mt-2">
        Who&apos;s behind Drop?
      </Heading>
      <Lead className="mt-6 max-w-3xl">
        Drop OSS was started by privacy and FOSS advocates who know a little
        code.
      </Lead>
      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div className="max-w-lg">
          <p className="text-sm/6 text-zinc-400">
            Drop OSS was started, mostly on a whim, in response to frustrations
            with the controlled nature of DRM games, and the missing comforts of
            DRM-free games. Since then, we&apos;ve put together a small circle
            of dedicated maintainers and contributors to develop Drop and all
            its amazing features.
          </p>
          <p className="mt-8 text-sm/6 text-zinc-400">
            If you know a little code, you can help out! We heavily encourage
            contributions, especially if you&apos;re passionate about the
            project and enjoy writing code. We use a variety of stacks across
            the various projects we maintain, but we predominantly use Vue,
            Rust, and Typescript.
          </p>
          <div className="mt-6">
            <Button
              className="w-full sm:w-auto"
              href="https://developer.droposs.org/contributing"
              target="_blank"
              variant="outline"
            >
              Contribute &rarr;
            </Button>
          </div>
        </div>
      </div>
      <Subheading id="team" as="h3" className="mt-24">
        The team
      </Subheading>
      <hr className="mt-6 border-t border-zinc-800" />
      <ul
        role="list"
        className="mx-auto mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3 lg:grid-cols-4"
      >
        {team &&
          team.map((member) => (
            <Person
              key={member.login}
              name={member.login}
              description={`${descriptionOverride[member.login] ?? 'Contributor'}`}
              contributions={member.contributions}
              img={member.avatar_url}
            />
          ))}
      </ul>
    </Container>
  )
}
