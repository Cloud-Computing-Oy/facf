# Provider Guide

FACF providers contribute explicitly approved compute capacity. Installing an agent does not enroll a machine in the official managed network.

## Provider lifecycle

1. Install a signed FACF agent release on a dedicated host or isolated environment.
2. Configure one or more supported runtime adapters.
3. Enroll the provider identity with a selected network operator.
4. Advertise truthful capabilities, availability, location constraints, and price floors.
5. Complete verification and benchmark challenges required for the requested trust tier.
6. Accept bounded leases, execute only the granted workload, and emit signed status and meter events.
7. Maintain updates, incident contacts, and operational evidence.

## Minimum operational requirements

- supported operating system and accelerator drivers;
- isolated runtime processes and least-privilege agent account;
- outbound authenticated control connection; inbound public exposure is not required by default;
- accurate model and capacity inventory;
- disk, memory, thermal, and power safeguards;
- automatic credential rotation and security updates;
- clear local consent for power use, bandwidth use, and compensation terms.

## Laptop and desktop participation

Consumer devices can be useful for development, public-data jobs, burst capacity, and community-tier workloads. The agent must respect foreground use, battery state, thermal limits, quiet hours, bandwidth limits, and a user-controlled pause or exit. Business-confidential workloads should not be routed to ordinary consumer hosts.

## Compensation

The protocol can carry provider offers and signed usage evidence. Settlement rules, taxes, minimum payout, chargebacks, and currency are network-operator policies. Providers should evaluate electricity, hardware depreciation, bandwidth, and tax obligations before offering capacity.

## Removal

A provider can leave by stopping new offers and draining accepted leases. Operators may quarantine or revoke a provider for security, integrity, contractual, or sustained quality failures.
