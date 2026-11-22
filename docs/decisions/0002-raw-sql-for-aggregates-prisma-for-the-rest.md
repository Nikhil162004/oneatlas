# Two query styles on purpose

`/api/models` and `/api/rankings` use `$queryRawUnsafe` with a placeholder list built in one pass;
everything else uses the Prisma client.

Reason: "cheapest provider per model" is an aggregate over a 1:N join, and it must be the *same*
expression in WHERE (price filter), in the LATERAL (sort key) and in ORDER BY (cursor). Expressing
that in the fluent API means `groupBy` + client-side join + manual sorting, which is a reimplementation
of SQL and slower to boot. Every other read is a single table with includes, where the client's
types are worth more than the control.

Both paths take the same `conditions()` builder, so a filter cannot be supported by the page and
forgotten by the API.
