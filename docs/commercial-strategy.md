# Commercial Strategy

## Status and Evidence Posture

This is a structural business case. Architecture, the first laptop node, and the
CCO LLM Router integration are known. Customer demand, willingness to pay,
provider acquisition cost, workload volume, realised unit cost, and support cost
are missing and must be measured before financial claims.

## Strategic Objective

Cloud Computing Oy should use an open protocol to accelerate adoption while
retaining commercial control over the trusted network, brand, buyer
relationships, verified provider programme, operating data, billing, support,
and enterprise services.

## Priority Customer Workflows

1. **Overflow and fallback inference** — AI applications obtain bounded
   open-model capacity when their primary route is unavailable, costly, or busy.
2. **EU/private capacity pooling** — organisations combine approved internal and
   partner GPU cells behind one policy-controlled endpoint.
3. **Idle-capacity monetisation** — verified providers sell otherwise unused GPU
   windows without surrendering host administration.

## Value Hypotheses

| Use case | Value bucket | Causal chain | Evidence | Confidence |
|---|---|---|---|---|
| Overflow inference | Risk Reduction | more eligible routes -> fewer hard failures -> higher service continuity | Inferred from working router fallback; network evidence missing | Medium-low |
| Open-model routing | Cost Reduction | match workload to lower-cost idle capacity -> reduce blended inference cost | Structural; cost inputs missing | Low |
| Private fabric | Risk Reduction | approved nodes + explicit policy -> more control over placement and provider exposure | Architecture defined; customer validation missing | Low |
| Provider participation | Revenue Acceleration | idle GPU windows -> measured accepted jobs -> new provider revenue | Structural; supply economics missing | Low |

## Revenue Model

### Managed network usage

Cloud Computing Oy buys or settles provider capacity and charges workload owners
for metered service. Revenue is usage; gross profit is the spread after provider
compensation, infrastructure, payment, support, and loss provisions.

### Platform subscriptions

Monthly tiers can cover policy administration, audit retention, team access,
budgets, analytics, dedicated routing, and support response.

### Private FACF deployments

Enterprise customers pay setup and recurring management fees for a private or
hybrid fabric connecting their own sites and approved partners.

### Provider verification and certification

Charge for optional onboarding, conformance testing, attestation integration,
and recurring verified-provider review. Payment must not buy a false trust claim;
published criteria and separation of review from sales are required.

### Support and integration

Paid architecture, runtime integration, migration, SLA support, and capacity
planning create services revenue while the network matures.

## Structural Unit Economics

```text
net revenue
= workload usage revenue
 + subscription revenue allocated to usage
 + service revenue allocated to period

gross contribution
= net revenue
 - provider compensation
 - broker/gateway infrastructure
 - networking and storage
 - payment and currency costs
 - support and incident cost
 - fraud, dispute, and service-credit provisions
```

Required low/base/high scenarios must use measured pilot inputs. No target margin
is claimed in this document.

## Go-to-Market Sequence

1. Use Cloud Computing Oy's own eligible non-sensitive workloads as design
   partners, not as proof of external demand.
2. Recruit 3–5 known capacity providers with complementary availability.
3. Run a no-customer-data technical pilot and publish measured service evidence.
4. Validate two buyer segments: AI software companies needing fallback capacity
   and organisations wanting a private EU fabric.
5. Sell a paid, bounded pilot with explicit models, data class, volume cap,
   support boundary, and success criteria.
6. Expand supply only after demand and unit economics justify it.

## Commercial Validation Metrics

- eligible request volume and temporal demand profile;
- buyer's current alternative cost and failure impact;
- realised provider compensation per input/output token;
- broker, network, support, and reconciliation cost;
- gross contribution per workload class;
- provider onboarding time and active-supply retention;
- buyer conversion, retained usage, and expansion;
- SLA credits, disputes, and fraud loss.

## Open Commercial Decisions

- Initial buyer segment and first paid workflow.
- Pricing basis: tokens, reserved capacity, subscription, or hybrid.
- Provider settlement timing and minimum payout.
- Broker margin versus transparent marketplace fee.
- VAT, cross-border provider status, and platform reporting obligations.
- Commercial name and trademark registration plan.

Owners: company leadership, product, legal/accounting, and pilot lead. Gate: all
must be resolved before a paid external pilot.
