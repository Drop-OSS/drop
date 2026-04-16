import { withContentCollections } from '@content-collections/next'
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true, output: 'export' }

export default withContentCollections(nextConfig)
