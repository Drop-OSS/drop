'use client'

import * as Headless from '@headlessui/react'
import { ArrowLongRightIcon } from '@heroicons/react/20/solid'
import { clsx } from 'clsx'
import {
  MotionValue,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  type HTMLMotionProps,
} from 'framer-motion'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import useMeasure, { type RectReadOnly } from 'react-use-measure'
import { Container } from './container'
import { Link } from './link'
import { Heading, Subheading } from './text'

function SponsorCard({
  name,
  from,
  img,
  bounds,
  scrollX,
  ...props
}: {
  img: string
  name: string
  from: string
  bounds: RectReadOnly
  scrollX: MotionValue<number>
} & HTMLMotionProps<'div'>) {
  let ref = useRef<HTMLDivElement | null>(null)

  let computeOpacity = useCallback(() => {
    let element = ref.current
    if (!element || bounds.width === 0) return 1

    let rect = element.getBoundingClientRect()

    if (rect.left < bounds.left) {
      let diff = bounds.left - rect.left
      let percent = diff / rect.width
      return Math.max(0.5, 1 - percent)
    } else if (rect.right > bounds.right) {
      let diff = rect.right - bounds.right
      let percent = diff / rect.width
      return Math.max(0.5, 1 - percent)
    } else {
      return 1
    }
  }, [ref, bounds.width, bounds.left, bounds.right])

  let opacity = useSpring(computeOpacity(), {
    stiffness: 154,
    damping: 23,
  })

  useLayoutEffect(() => {
    opacity.set(computeOpacity())
  }, [computeOpacity, opacity])

  useMotionValueEvent(scrollX, 'change', () => {
    opacity.set(computeOpacity())
  })

  return (
    <motion.div
      ref={ref}
      style={{ opacity }}
      {...props}
      className="relative flex w-64 rounded-3xl sm:w-72 bg-black"
    >
      <figure className="relative p-10">
        <figcaption className="pb-3 border-b border-white/20">
          <p className="text-sm/6 font-medium text-white">{name}</p>
          <p className="text-sm/6 font-medium">
            <span className="bg-linear-to-r from-sky-300 from-28% via-blue-200 via-70% to-cyan-300 bg-clip-text text-transparent">
              {from}
            </span>
          </p>
        </figcaption>
      </figure>
    </motion.div>
  )
}

function CallToAction() {
  return <div />
  return (
    <div>
      <p className="max-w-sm text-sm/6 text-gray-600">
        Join the best sellers in the business and start using Radiant to hit
        your targets today.
      </p>
      <div className="mt-2">
        <Link
          href="#"
          className="inline-flex items-center gap-2 text-sm/6 font-medium text-pink-600"
        >
          Get started
          <ArrowLongRightIcon className="size-5" />
        </Link>
      </div>
    </div>
  )
}

type Sponsor = {
  name: string
  image: string
  from: string
}

export function Sponsors() {
  let scrollRef = useRef<HTMLDivElement | null>(null)
  let { scrollX } = useScroll({ container: scrollRef })
  let [setReferenceWindowRef, bounds] = useMeasure()
  let [activeIndex, setActiveIndex] = useState(0)

  useMotionValueEvent(scrollX, 'change', (x) => {
    setActiveIndex(Math.floor(x / scrollRef.current!.children[0].clientWidth))
  })

  function scrollTo(index: number) {
    let gap = 32
    let width = (scrollRef.current!.children[0] as HTMLElement).offsetWidth
    scrollRef.current!.scrollTo({ left: (width + gap) * index })
  }

  const [sponsors, setSponsors] = useState<Array<Sponsor> | null>(null)

  useEffect(() => {
    ;(async () => {
      const cached = window.localStorage.getItem('sponsors')
      if (cached) {
        const cachedData = JSON.parse(cached)
        if (cachedData.created + 1000 * 60 * 60 * 24 * 1 > Date.now()) {
          setSponsors(cachedData.sponsors)
          return
        }
      }

      const openCollective: Array<{
        role: 'BACKER'
        image: string
        name: string
        totalAmountDonated: number
      }> = await (
        await fetch('https://opencollective.com/drop-oss/members/all.json')
      ).json()

      const ocSponsors = openCollective
        .filter((e) => e.role === 'BACKER')
        .sort((a, b) => b.totalAmountDonated - a.totalAmountDonated)
        .map(
          (v) =>
            ({
              name: v.name,
              image: v.image ?? '/avatars/sponsor.png',
              from: 'OpenCollective',
            }) satisfies Sponsor,
        )

      /*
      const octokit = new Octokit({})
      const data: {
        user: {
          sponsors: {
            edges: Array<Array<{ node: { avatarUrl: string; name: string } }>>
          }
        }
      } = await octokit.graphql(`{
  user(login: "DecDuck") {
    sponsors(first: 100) {
      edges {
        node {
          ... on User {
            id
            name
            url
            avatarUrl
          }
        }
      }
    }
  }
}`)

      const githubSponsors = data.user.sponsors.edges
        .flat()
        .map((e) => e.node)
        .map(
          (e) =>
            ({
              image: e.avatarUrl,
              name: e.name,
              from: 'GitHub Sponsors',
            }) satisfies Sponsor,
        )
            */

      const githubSponsors: Sponsor[] = []

      const sponsors = [...githubSponsors, ...ocSponsors]
      window.localStorage.setItem(
        'sponsors',
        JSON.stringify({ created: Date.now(), sponsors }),
      )
      setSponsors(sponsors)
    })()
  }, [])

  return (
    <div className="mt-32 overflow-hidden">
      <Container>
        <div ref={setReferenceWindowRef}>
          <Subheading>Financial</Subheading>
          <Heading as="h3" className="mt-2">
            The people who make this possible.
          </Heading>
        </div>
      </Container>
      <div
        ref={scrollRef}
        className={clsx([
          'mt-16 flex gap-8 px-(--scroll-padding)',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth',
          '[--scroll-padding:max(--spacing(6),calc((100vw-(var(--container-2xl)))/2))] lg:[--scroll-padding:max(--spacing(8),calc((100vw-(var(--container-7xl)))/2))]',
        ])}
      >
        {sponsors &&
          sponsors.map(({ image, name, from }, testimonialIndex) => (
            <SponsorCard
              key={testimonialIndex}
              name={name}
              from={from}
              img={image}
              bounds={bounds}
              scrollX={scrollX}
              onClick={() => scrollTo(testimonialIndex)}
            />
          ))}
        <div className="w-2xl shrink-0 sm:w-216" />
      </div>
      <Container className="mt-16">
        <div className="flex justify-between">
          <CallToAction />
          <div className="hidden sm:flex sm:gap-2">
            {sponsors &&
              sponsors.map(({ name }, i) => (
                <Headless.Button
                  key={i}
                  onClick={() => scrollTo(i)}
                  data-active={activeIndex === i ? true : undefined}
                  aria-label={`Scroll to sponsorship from ${name}`}
                  className={clsx(
                    'size-2.5 cursor-pointer rounded-full border border-transparent bg-zinc-600 transition',
                    'data-active:bg-blue-700 data-hover:bg-zinc-900',
                    'forced-colors:data-active:bg-[Highlight] forced-colors:data-focus:outline-offset-4',
                  )}
                />
              ))}
          </div>
        </div>
      </Container>
    </div>
  )
}
