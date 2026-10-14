"use client";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/section";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="py-28 text-center">
      <h1 className="text-3xl">Something went wrong</h1>
      <p className="mt-3 text-ink-soft">This is on our side. Please try again; if it keeps happening, contact us.</p>
      <Button className="mt-8" onClick={reset}>Try again</Button>
    </Container>
  );
}
