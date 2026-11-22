import { PrismaClient } from '@prisma/client';
import { buildList } from '../src/lib/query';
import { listQuerySchema } from '../src/lib/validation';
const p = new PrismaClient();
const q = (o: Record<string, string>) => listQuerySchema.parse(o);
for (const [label, opts] of [['default page 1 (sort=released)', {}], ['search q=gpt', { q: 'gpt' }], ['filter type+caps+context', { type: 'IMAGE', capabilities: 'tools,vision', minContext: '100000' }]] as const) {
  const { text, values } = buildList(q(opts as Record<string, string>));
  // The result column is named "QUERY PLAN"; read the first value of each row rather than
  // guessing at the key Prisma hands back.
  const plan = await p.$queryRawUnsafe<Array<Record<string, string>>>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${text}`, ...values);
  const lines = plan.map((r) => Object.values(r)[0] as string);
  console.log(`\n--- ${label} ---`);
  console.log(lines.filter((l) => /Execution Time|Index .*using|Seq Scan|Rows Removed|Sort|Actual Time/.test(l)).map((l) => l.replace(/^\s+/, '  ')).join('\n'));
}
await p.$disconnect();
