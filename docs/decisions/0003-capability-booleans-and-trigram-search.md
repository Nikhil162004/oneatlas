# Capability flags are booleans; search is `pg_trgm`

**Booleans over a `Capability` join table.** Filters compose as `AND "supportsToolCalling" = true`
against an indexed column. A join table would need one join per selected capability for no gain,
because the vocabulary is fixed by the brief (reasoning, tools, structured output, vision, open
weights). `shortcut: adding a capability now needs a migration; move to a join table if the
vocabulary becomes user-extensible.`

**Trigrams over a search engine.** The brief's search is "find the model whose name contains this".
`pg_trgm` GIN indexes on `name` and `slug` (created in `prisma/sql/search.sql`, which Prisma cannot
express because it needs an operator class) do that with zero new services, and the `q` filter stays
in the one SQL statement that also does filtering, sorting and paging. Meilisearch/Algolia would add
a second source of truth to keep in sync with Postgres, an index-build step, and a deploy dependency,
to answer a query the database can already answer at a few hundred rows.
`upgrade trigger: descriptions become searchable (need `tsvector` + ranking) or the corpus passes
~100k rows and EXPLAIN shows a seq scan winning for the wrong reason.`
