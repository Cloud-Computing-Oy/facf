# Product Mission

## Problem

Useful AI compute is fragmented across laptops, workstations, private servers,
cloud accounts, and data centres. Much of that capacity is idle, yet safely
sharing it is difficult. Hardware and model capabilities vary, nodes appear and
disappear, data policies differ, and neither advertised capacity nor completed
work can be trusted without evidence.

Application developers need one predictable interface instead of custom
integrations for every provider. Capacity owners need strict control over when
their machines participate, which workloads they accept, and how consumption is
measured.

## Target Users

### Initial users

- AI application teams that can use public or non-sensitive open-model inference.
- Organisations with intermittently idle NVIDIA GPU capacity.
- Infrastructure teams operating trusted private or partner GPU cells.
- Open-source developers building schedulers, runtimes, and verification tools.

### Later users

- Independent community capacity providers.
- Buyers of asynchronous AI batch capacity.
- Regulated organisations using verified or confidential-compute provider
  classes after those controls are independently validated.

## Solution

FACF provides an open broker–agent protocol and reference implementation for
federating independent AI compute cells. Provider agents advertise short-lived,
measured capabilities over outbound authenticated connections. A broker filters
and scores eligible cells, acquires a capacity lease, dispatches a whole request
or job, records metering evidence, and applies bounded fallback.

FACF is differentiated by:

- treating trust and data classification as routing requirements;
- keeping provider cells operationally independent;
- separating real-time inference from retryable asynchronous work;
- using standard runtimes such as Ollama and vLLM rather than replacing them;
- giving resource owners explicit limits and a local kill switch;
- postponing permissionless payments until useful work can be verified;
- designing an open protocol independently of one hosted broker.

## Mission Statement

Make independently owned AI compute safely discoverable, schedulable, and
measurable through an open protocol—without hiding the limits of distributed
systems or the trust placed in compute providers.

## Commercial Mission

Enable Cloud Computing Oy to operate the most trusted and useful FACF network by
combining open adoption with verified supply, customer demand, policy-aware
routing, metering, billing, support, and accountable service operations.

## Success Measures

- Three independently operated pilot cells.
- At least 95% successful completion for eligible test workloads.
- Bounded fallback when a laptop or server disappears.
- No double allocation of a leased slot.
- Enforced model, region, trust, price, and data-class policies.
- Complete provider control over availability and resource limits.
- A reproducible installation and demo.
- A finance-ready pilot case based on measured demand, cost, and margin.
