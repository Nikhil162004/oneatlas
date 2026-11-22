import Link from 'next/link';
import { notFound } from 'next/navigation';
import { collectionDetail } from '@/lib/services/catalogue';
import { Empty, Section } from '@/components/ui';
import { contextLabel, priceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await collectionDetail(slug).catch(() => null);
  return { title: c ? c.title : 'Collection' };
}

/**
 * One collection, ranked. The criteria are printed on the page because a ranking a reader
 * cannot reproduce from /models is marketing, not discovery; every row also carries the
 * specific fact (score, price, context) that earned its place.
 */
export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await collectionDetail(slug).catch(() => null);
  if (!c) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1>{c.title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {c.blurb} Criteria: <span className="num">{c.criteria}</span>. Recompute or widen it in{' '}
          <Link className="underline" href="/models">Models</Link>.
        </p>
      </div>

      {!c.rows.length ? (
        <Empty title="No models qualify right now" hint="The mirror may be empty, or the criteria exclude everything it holds." />
      ) : (
        <>
          <Section id="rows" title="Ranked" count={c.rows.length} />
          <div className="tablewrap">
            <table className="stack-sm min-w-[800px] text-sm">
              <caption className="sr-only">Models in this collection, ranked, with the fact that placed each one</caption>
              <thead>
                <tr>
                  <th scope="col" className="text-right">Rank</th>
                  <th scope="col">Model</th>
                  <th scope="col">Lab</th>
                  <th scope="col" className="text-right">Context</th>
                  <th scope="col" className="text-right">In / out per 1M</th>
                  <th scope="col">Why it ranks</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((r, i) => (
                  <tr key={r.slug}>
                    <td className="num text-right">{i + 1}</td>
                    <td data-title>
                      <Link className="font-medium underline-offset-2 hover:underline" href={`/models/${r.slug}`}>{r.name}</Link>
                      <span className="block text-xs text-[var(--faint)]">{r.modelType.toLowerCase()}</span>
                    </td>
                    <td>{r.lab.name}</td>
                    <td className="num text-right">{contextLabel(r.contextWindow)}</td>
                    <td className="num text-right">{priceLabel(r.prompt)} / {priceLabel(r.completion)}</td>
                    <td className="num text-[var(--muted)]">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
