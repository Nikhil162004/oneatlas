import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h2 className="num text-3xl">404</h2>
      <p className="mt-2 text-[var(--muted)]">No such model, lab or page here.</p>
      <Link href="/models" className="btn mt-4 inline-flex">Browse all models</Link>
    </div>
  );
}
