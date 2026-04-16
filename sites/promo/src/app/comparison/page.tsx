import Comparison from "@/components/comparison";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: 'Comparison',
  description:
    'A breakdown of the different projects you may be interested in, and the pros & cons of each.',
}


export default function ComparisonPage() {
  return <Suspense><Comparison /></Suspense>
}