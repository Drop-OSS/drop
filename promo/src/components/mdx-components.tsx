import type { MDXComponents } from 'mdx/types';
import Link from 'next/link'

const components: MDXComponents = {
  p: ({ children }) => (
    <p className="my-8 text-base/8 first:mt-0 last:mb-0">{children}</p>
  ),
  h1: ({ children }) => (
    <h2 className="mt-12 mb-10 text-4xl/8 font-medium tracking-tight text-zinc-100 first:mt-0 last:mb-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2 className="mt-12 mb-10 text-2xl/8 font-medium tracking-tight text-zinc-100 first:mt-0 last:mb-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-12 mb-10 text-xl/8 font-medium tracking-tight text-zinc-100 first:mt-0 last:mb-0">
      {children}
    </h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-10 border-l-2 border-l-zinc-700 pl-6 text-base/8 text-zinc-100 first:mt-0 last:mb-0">
      {children}
    </blockquote>
  ),
  image: (props) => (
    // eslint-disable-next-line jsx-a11y/alt-text
    <img
      {...(props as { alt: string; src: string })}
      className="w-full rounded-2xl"
    />
  ),
  hr: () => <hr className="my-8 border-t border-zinc-800" />,
  strong: ({ children }) => (
    <strong className="font-semibold text-zinc-100">{children}</strong>
  ),
  code: ({ children }) => (
    <>
      <code className="text-[15px]/8 font-semibold text-zinc-300 bg-zinc-800 p-4 rounded-xl w-full">
        {children}
      </code>
    </>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-4 text-base/8 marker:text-gray-400">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-4 text-base/8 marker:text-gray-400">
      {children}
    </ol>
  ),
  li: ({ children }) => {
    return <li className="my-2 pl-2 has-[br]:mb-8">{children}</li>
  },
  a: (props) => {
    return (
      <Link
        {...props}
        className="font-medium text-blue-400 underline decoration-blue-400 underline-offset-4 data-hover:decoration-blue-600"
      >
        {props.children}
      </Link>
    )
  },
}

export function useMDXComponents(): MDXComponents {
  return components
}
