# The three reference platforms, and what each one changed

The brief says to study OpenRouter, RouterPlus and LiteLLM before starting, and that we are *not*
expected to replicate them. This is the record of what each one taught me and where that decision
landed in the code, so the answer to "what did you take and why" is a file rather than a memory.

## OpenRouter — the listing shape

**What it is:** a marketplace in front of ~20 providers. Its public API is the model list, and the
thing that matters for a discovery product is the grain of that data: `data[]` entries carry a
`pricing` object, an `architecture` with `input_modalities` / `output_modalities`, a
`top_provider` (the cheapest or best endpoint at the time of the request), `supported_parameters`,
and a separate `/models/{author}/{slug}/endpoints` call that returns *one entry per provider
endpoint*, each with its own `pricing`, `context_length`, `quantization`, `uptime_last_1d` and
`latency_last_30m`.

**What I copied.** The grain. `ModelListing` is keyed on (model, provider, endpoint) because that is
where price, context ceiling, quantisation and reliability actually live — see
`docs/decisions/0001`. The ingest reads both calls and merges them: the model list gives the
catalogue row, `/endpoints` gives the listings. `uptime_last_1d` arrives as a 0–100 float with long
tails and is stored as a `Decimal(5,2)`, `latency_last_30m` as nullable, because a missing latency
must not become `0 ms` (that cast bug is `docs/decisions/0004`).

**What I rejected.** The commerce. Accounts, credits, per-key rate limits, a chat playground: the
brief is discovery and intelligence, and building the wrong half of a marketplace is how an MVP ends
up with a login page and no rankings. Also `top_provider` as a *displayed* fact: it is one endpoint
chosen by their ranking rules, so I keep every endpoint and let the UI mark the cheapest one
(`src/lib/query.ts` `LISTING_AGGREGATE`), rather than inheriting someone else's notion of "best".

## RouterPlus — the quality bar

**What it is:** an inference gateway whose pitch is routing decided on *your* evals and production
traffic, not on global benchmarks. Its `Optimize` flow compares candidate models against a baseline
on held-out eval cases and only declares a winner if the candidate clears a quality bar *and* a cost
check; the customer deploys it or not. It also sells data-compliance routing, regional routing,
reserved capacity and SLAs.

**What I copied.** The refusal to overstate. Two consequences in the code:

- Nothing in OneAtlas claims a model is "best". The only mark on a price list is `cheapest`, which is
  a claim about the mirrored rows and can be checked against them
  (`src/app/models/[lab]/[slug]/page.tsx`).
- A score is never shown alone. Every benchmark row carries the benchmark name and the leader's value
  as a bar, and every provider average prints its sample size (`10 of 25`), because an average over
  two measurements and an average over two hundred look identical otherwise
  (`src/app/providers/page.tsx`, `listProviders`).
- Cost and quality are kept in separate columns, never averaged into one number — RouterPlus's whole
  argument is that a winner is workload-specific, and a single composite would lie about it.

**What I rejected.** The gateway itself: BYOK routing, capacity reservation, SLA and procurement
flows. That is infrastructure, not discovery, and none of it is gradeable in this assignment's terms.

## LiteLLM — the anti-pattern worth avoiding

**What it is:** an open-source, self-hosted AI gateway for platform teams — one key in front of the
stack, spend attribution per team, budget caps, routing, observability, MCP and agent clients. Its
model metadata famously ships as a static JSON file in the repo
(`model_prices_and_context_window.json`), which is exactly the shape of "the data lives in the
frontend".

**What I copied.** The parts of its product thinking that apply to a discovery surface: model
metadata has to answer "what will this cost me and who can actually serve it", and pricing is
per-endpoint, not per-model. Also the mirrored-then-served discipline: OneAtlas never calls the
upstream API at request time. Every page reads Postgres through the same service its API reads, so a
deploy without egress still answers (`src/lib/services/`, and `npm run ingest` being a separate,
re-runnable step).

**What I rejected, and what it taught me.** A flat JSON blob as the source of truth. The brief's line
— "application data must be managed through the database and APIs; avoid hardcoded frontend-only
implementations" — is a direct rejection of that pattern, so here the JSON is only ever an *input* to
`scripts/ingest.ts`, and the fixtures exist to make ingest reproducible offline
(`fixtures/or_models_full.json`, 476 records). The other rejected thing is the enterprise surface
(budgets, keys, spend per team), which needs an org and a billing system to mean anything.

## What all three agree on, and therefore what the MVP had to have

1. A model row is a **price per provider**, shown as a range, not a single number.
2. Discovery is **filter + sort + search over that table**, and the filter state has to be shareable —
   hence every control here is a URL (`docs/decisions/0006`).
3. **Reliability is a first-class column**: who serves it, with what latency, at what uptime, over how
   many samples. Two of the three sell on it, so a discovery product that hides it is decorative.
4. Benchmarks inform a choice; they do not replace one. None of the three prints a single "best model"
   verdict, so neither does `/rankings`.
