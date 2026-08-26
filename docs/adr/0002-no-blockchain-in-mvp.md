# ADR 0002: No Blockchain in the MVP

- Status: Accepted
- Date: 2026-08-26

## Context

A decentralized compute market needs identity, metering, reputation, and settlement. A blockchain could implement parts of settlement, but it would also add key custody, regulatory, volatility, privacy, and usability questions before demand is validated.

## Decision

The MVP uses operator-approved identities, signed usage records, a conventional ledger, contracts, invoices, and ordinary payment rails. No token, proof-of-work, or blockchain consensus is required.

## Consequences

The system can focus on reliable workload execution and measurable unit economics. Settlement is initially operator-mediated. Future rails may be added behind the protocol's signed-meter interface without changing workload execution semantics.
