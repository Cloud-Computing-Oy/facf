# Scheduling and Capacity Leases

## Pipeline

Placement is mandatory filtering followed by scoring. Scoring never overrides a
mandatory policy.

## Mandatory Filters

A candidate MUST satisfy model/revision, context limits, free unexpired capacity,
data class, trust class, region, provider allow/deny lists, price/budget, runtime
features, and model licence policy. If none qualifies, the broker returns an
explicit placement failure; it never silently relaxes trust, data, region, or
price constraints.

## Scoring

```text
score =
    cost_weight        * normalized_cost
  + queue_weight       * normalized_queue_delay
  + latency_weight     * normalized_time_to_first_token
  + reliability_weight * normalized_failure_risk
  + carbon_weight      * normalized_carbon_signal
  - warm_model_bonus
  - locality_bonus
```

Lower scores win. Weights are versioned and visible. Price and sustainability
signals carry source and freshness metadata.

## Lease Algorithm

1. Snapshot eligible offers.
2. Sort by score and stable tie-breaker.
3. Create a pending lease with an idempotency key.
4. Offer it to the first candidate with a short deadline.
5. Agent atomically reserves a local slot or rejects.
6. On timeout/rejection, close the attempt and try the next candidate.
7. On acceptance, issue scoped execution credentials.
8. Release capacity only through a terminal transition or expiry reconciliation.

Broker and agent use compare-and-swap versions so stale messages cannot revert
state.

## Retry and Hedging

- Placement calls use bounded exponential backoff.
- Inference may move before visible output.
- Transparent retry stops after output begins.
- Hedged execution is disabled in the MVP because it duplicates cost and exposure.
- Async jobs may retry when inputs and outputs are idempotently addressed.

## Fairness and Reputation

Per-tenant concurrency, per-provider caps, FIFO within priority, and bounded
priority aging prevent domination. Reputation derives from completion, estimate
accuracy, meter reconciliation, conformance, challenges, incidents, and disputes.
Self-reported benchmarks never directly determine trust or settlement.
