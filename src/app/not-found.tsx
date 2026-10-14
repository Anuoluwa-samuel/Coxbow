import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/site/logo";
import { Container } from "@/components/ui/section";

export default function NotFound() {
  return (
    <Container className="py-20 text-center">
      <Logo className="mb-12" />
      <p className="font-display text-6xl text-brass-text">404</p>
      <h1 className="mt-4 text-3xl">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-ink-soft">It may have moved, or the service may no longer be offered.</p>
      <div className="mt-8 flex justify-center gap-3">
        <ButtonLink href="/">Home</ButtonLink>
        <ButtonLink href="/services" variant="outline">Services</ButtonLink>
      </div>
    </Container>
  );
}
