import { Button } from '@/components/button'
import { Container } from '@/components/container'
import Content from '@/components/content'
import { Footer } from '@/components/footer'
import { GradientBackground } from '@/components/gradient'
import { Navbar } from '@/components/navbar'
import { fetchPostAuthors } from '@/components/post'
import { Heading, Subheading } from '@/components/text'
import { ChevronLeftIcon } from '@heroicons/react/16/solid'
import { allPosts } from 'content-collections'
import dayjs from 'dayjs'
import { notFound } from 'next/navigation'

export const generateStaticParams = async () =>
  allPosts.map((post) => ({ slug: post._meta.path }))

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ slug: string }>
}) => {
  const aParams = await params
  const post = allPosts.find((post) => post._meta.path === aParams.slug)
  if (!post) notFound()
  return { title: post.title, description: post.excerpt }
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const aParams = await params
  const post = allPosts.find((post) => post._meta.path === aParams.slug)
  if (!post) notFound()

  const postAuthors = fetchPostAuthors()

  const author = post.author ? postAuthors[post.author] : undefined
  const tags = (post.tags ?? '').split(',').map((e) => e.trim())

  return (
    <main className="overflow-hidden">
      <GradientBackground />
      <Container>
        <Navbar />
        <Subheading className="mt-16">
          {dayjs(post.date).format('dddd, MMMM D, YYYY')}
        </Subheading>
        <Heading as="h1" className="mt-2">
          {post.title}
        </Heading>
        <div className="mt-16 grid grid-cols-1 gap-8 pb-24 lg:grid-cols-[15rem_1fr] xl:grid-cols-[15rem_1fr_15rem]">
          <div className="flex flex-wrap items-center gap-8 max-lg:justify-between lg:flex-col lg:items-start">
            {author && (
              <div className="flex items-center gap-3">
                {author.avatar && (
                  <img
                    alt=""
                    src={author.avatar}
                    className="aspect-square size-6 rounded-full object-cover"
                  />
                )}
                <div className="text-sm/5 text-zinc-300">{author.name}</div>
              </div>
            )}
            {
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <div
                    key={tag}
                    className="rounded-full border border-dotted border-zinc-800 bg-zinc-900 px-2 text-sm/6 font-medium text-zinc-400"
                  >
                    {tag}
                  </div>
                ))}
              </div>
            }
          </div>
          <div className="text-zinc-400">
            <div className="max-w-2xl xl:mx-auto">
              {post.image && (
                <img
                  alt={post.title}
                  src={post.image}
                  className="mb-10 aspect-3/2 w-full rounded-2xl object-cover shadow-xl"
                />
              )}
              <Content content={post} />

              <div className="mt-10">
                <Button variant="outline" href="/news">
                  <ChevronLeftIcon className="size-4" />
                  Back to news
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Container>
      <Footer />
    </main>
  )
}
