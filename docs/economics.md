# Network Economics

FACF uses useful AI execution rather than proof-of-work. Bitcoin demonstrates that many independent machines can coordinate through a shared protocol and economic incentives; it does not provide a suitable workload, privacy model, or settlement design for LLM inference.

## Economic actors

- clients buy policy-compliant inference capacity;
- providers sell bounded compute availability;
- operators supply discovery, trust, scheduling, metering, settlement, support, and demand aggregation;
- developers build compatible agents, adapters, and tools.

## Price formation

A provider offer can include a currency, minimum charge, input/output token rates, time rate, or reserved-capacity rate. The operator may present a simpler customer price while absorbing scheduling and settlement complexity.

## Unit-economics model

For a workload class:

```text
gross margin = customer revenue
             - provider compensation
             - payment and settlement costs
             - control-plane and support costs
             - credits, fraud, and dispute losses

contribution margin per accelerator-hour = gross margin / delivered accelerator-hours
```

No profitability claim should be made until real pilots measure utilization, completion rate, energy-adjusted provider cost, support burden, and customers' willingness to pay.

## Incentive design

- pay for accepted, policy-compliant work rather than mere uptime claims;
- make reservations and cancellations economically explicit;
- penalize attributable non-delivery and fraudulent metering through reputation, withheld settlement, or contract;
- avoid rewards that encourage fake identities, unnecessary computation, or low-quality capacity;
- keep customer price predictable even when provider spot prices vary.

## Settlement roadmap

The MVP uses conventional contracts, invoices, and ledger reconciliation. A token or blockchain is not required for identity, scheduling, or payment, and would introduce regulatory, usability, and volatility risks before product-market fit. Alternative settlement rails can be evaluated later behind the same signed-meter interface.
