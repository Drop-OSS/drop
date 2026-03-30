'use client'

import { Button } from '@/components/button'
import { Container } from '@/components/container'
import { Footer } from '@/components/footer'
import { GradientBackground } from '@/components/gradient'
import { Link } from '@/components/link'
import { Navbar } from '@/components/navbar'
import { fetchPostAuthors } from '@/components/post'
import { Heading, Lead, Subheading } from '@/components/text'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid'
import { clsx } from 'clsx'
import { allPosts } from 'content-collections'
import dayjs from 'dayjs'
import { notFound, useSearchParams } from 'next/navigation'

const postsPerPage = 5

function FeaturedPosts() {
  const featuredPosts = allPosts.slice(0, 3)

  if (featuredPosts.length === 0) {
    return
  }

  const postAuthors = fetchPostAuthors()

  return (
    <div className="mt-16 pb-14">
      <Container>
        <h2 className="text-2xl font-medium tracking-tight">Featured</h2>
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {featuredPosts.map((post) => (
            <div
              key={post._meta.path}
              className="relative flex flex-col rounded-3xl bg-zinc-900 p-2 shadow-md ring-1 shadow-white/5 ring-white/5"
            >
              {post.image && (
                <img
                  alt={post.title}
                  src={post.image}
                  className="aspect-3/2 w-full rounded-2xl object-cover"
                />
              )}
              <div className="flex flex-1 flex-col p-8">
                <div className="text-sm/5 text-zinc-400">
                  {dayjs(post.date).format('dddd, MMMM D, YYYY')}
                </div>
                <div className="mt-2 text-base/7 font-medium">
                  <Link href={post.url}>
                    <span className="absolute inset-0" />
                    {post.title}
                  </Link>
                </div>
                <div className="mt-2 flex-1 text-sm/6 text-zinc-400">
                  {post.excerpt}
                </div>
                {postAuthors[post.author ?? ''] && (
                  <div className="mt-6 flex items-center gap-3">
                    <img
                      alt=""
                      src={postAuthors[post.author ?? ''].avatar}
                      className="aspect-square size-6 rounded-full object-cover"
                    />
                    <div className="text-sm/5 text-zinc-300">
                      {postAuthors[post.author ?? ''].name}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  )
}

function Posts({ page, category }: { page: number; category?: string }) {
  let posts = allPosts.slice((page - 1) * postsPerPage, page * postsPerPage)

  if (posts.length === 0 && (page > 1 || category)) {
    notFound()
  }

  if (posts.length === 0) {
    return <p className="mt-6 text-gray-500">No posts found.</p>
  }

  const postAuthors = fetchPostAuthors()

  return (
    <div className="mt-6">
      {posts.map((post) => (
        <div
          key={post._meta.path}
          className="relative grid grid-cols-1 border-b border-b-zinc-900 py-10 first:border-t first:border-t-zinc-900 max-sm:gap-3 sm:grid-cols-3"
        >
          <div>
            <div className="text-sm/5 max-sm:text-gray-700 sm:font-medium">
              {dayjs(post.date).format('dddd, MMMM D, YYYY')}
            </div>
            {postAuthors[post.author ?? ''] && (
              <div className="mt-2.5 flex items-center gap-3">
                {
                  <img
                    alt=""
                    src={postAuthors[post.author ?? ''].avatar}
                    className="aspect-square size-6 rounded-full object-cover"
                  />
                }
                <div className="text-sm/5 text-zinc-300">
                  {postAuthors[post.author ?? ''].name}
                </div>
              </div>
            )}
          </div>
          <div className="sm:col-span-2 sm:max-w-2xl">
            <h2 className="text-sm/5 font-medium">{post.title}</h2>
            <p className="mt-3 text-sm/6 text-zinc-300">{post.excerpt}</p>
            <div className="mt-4">
              <Link
                href={post.url}
                className="flex items-center gap-1 text-sm/5 font-medium"
              >
                <span className="absolute inset-0" />
                Read more
                <ChevronRightIcon className="size-4 fill-gray-400" />
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Pagination({
  page,
  category,
}: {
  page: number
  category?: string
}) {
  function url(page: number) {
    let params = new URLSearchParams()

    if (category) params.set('category', category)
    if (page > 1) params.set('page', page.toString())

    return params.size !== 0 ? `/news?${params.toString()}` : '/news'
  }

  let totalPosts = allPosts.length
  let hasPreviousPage = page - 1
  let previousPageUrl = hasPreviousPage ? url(page - 1) : undefined
  let hasNextPage = page * postsPerPage < totalPosts
  let nextPageUrl = hasNextPage ? url(page + 1) : undefined
  let pageCount = Math.ceil(totalPosts / postsPerPage)

  if (pageCount < 2) {
    return
  }

  return (
    <div className="mt-6 flex items-center justify-between gap-2">
      <Button
        variant="outline"
        href={previousPageUrl}
        disabled={!previousPageUrl}
      >
        <ChevronLeftIcon className="size-4" />
        Previous
      </Button>
      <div className="flex gap-2 max-sm:hidden">
        {Array.from({ length: pageCount }, (_, i) => (
          <Link
            key={i + 1}
            href={url(i + 1)}
            data-active={i + 1 === page ? true : undefined}
            className={clsx(
              'size-7 rounded-lg text-center text-sm/7 font-medium',
              'data-hover:bg-zinc-900',
              'data-active:shadow-sm data-active:ring-1 data-active:ring-white/10',
              'data-active:data-hover:bg-zinc-900',
            )}
          >
            {i + 1}
          </Link>
        ))}
      </div>
      <Button variant="outline" href={nextPageUrl} disabled={!nextPageUrl}>
        Next
        <ChevronRightIcon className="size-4" />
      </Button>
    </div>
  )
}

export default function News() {
  const paramsPage = useSearchParams().get('page');
  let page =
    paramsPage
      ? typeof paramsPage === 'string' && parseInt(paramsPage) > 1
        ? parseInt(paramsPage)
        : notFound()
      : 1

  return (
    <main className="overflow-hidden">
      <GradientBackground />
      <Container>
        <Navbar />
        <Subheading className="mt-16">News</Subheading>
        <Heading as="h1" className="mt-2">
          What&apos;s about to drop?
        </Heading>
        <Lead className="mt-6 max-w-3xl">
          Check out what&apos;s new and what&apos;s upcoming in Drop through our
          hand-written articles by the core team of Drop.
        </Lead>
      </Container>
      {page === 1 && <FeaturedPosts />}
      <Container className="pb-24">
        <Posts page={page} />
        <Pagination page={page} />
      </Container>
      <Footer />
    </main>
  )
}
