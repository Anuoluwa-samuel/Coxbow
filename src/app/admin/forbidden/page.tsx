import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-sand px-4 text-center">
      <h1 className="text-3xl">You do not have access to that page</h1>
      <p className="text-ink-soft">Ask an administrator if you need different permissions.</p>
      <Link href="/admin" className="font-semibold text-forest-800 underline">Back to the dashboard</Link>
    </div>
  );
}
