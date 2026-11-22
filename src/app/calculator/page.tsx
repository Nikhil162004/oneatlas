import { listModels } from '@/lib/services/catalogue';
import { listQuerySchema } from '@/lib/validation';
import CalculatorExplorer from '@/components/CalculatorExplorer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cost calculator' };

/**
 * What a workload costs, ranked across models. The server seeds the hundred cheapest-by-input
 * models from the same service /api/models reads; the island re-ranks them locally as the
 * workload changes, because rates do not move while you type.
 */
export default async function CalculatorPage() {
  const query = listQuerySchema.parse({ sort: 'priceLow', limit: 100 });
  const { data } = await listModels(query).catch(() => ({ data: [] }));

  return (
    <div className="space-y-6">
      <div>
        <h1>Cost calculator</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Describe the workload; the bill follows. Every rate is a live mirrored price, and every row links to the
          model record it came from.
        </p>
      </div>
      <CalculatorExplorer initialRows={data} />
    </div>
  );
}
