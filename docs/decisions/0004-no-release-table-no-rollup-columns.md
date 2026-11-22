# Two tables I deleted before they existed

**No `Release`.** Module 5 asks to "explore their models and releases". A model row already carries
`releaseDate`, so the lab page groups models by month — one `GROUP BY` and no second table to keep
consistent. `upgrade trigger: a lab publishes something that is not a model (a paper, a dataset);
that needs a row, and the row needs a source.`

**No `minPricePer1MIn` / `listingCount` rollups on `Model`.** Sorting by price is
`ORDER BY COALESCE(a."minPrompt", sentinel)`, which the LATERAL already computes for display. A
denormalised copy would have to be recomputed by the ingest, verified against drift, and would be
wrong for the window between an upstream price change and the next run. `upgrade trigger: > ~20k
listings, or EXPLAIN shows a sort spilling to disk.`
