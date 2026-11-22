# Price is a (model, provider, endpoint) fact

`ModelListing` holds pricing, context ceiling, quantisation, latency and uptime. `Model` holds
identity and capability flags only.

Alternatives considered: pricing columns on `Model` (rejected: it can only ever show one provider,
so "cheaper elsewhere" is unrepresentable and the compare screen collapses); a `priceHistory` table
(rejected: nobody asked for time series, and it is a write path with no read).

Cost paid: every price shown in a list is an aggregate (`MIN` over the lateral join), not a column
read. That is the trade, and it buys the only interesting thing the product does.
