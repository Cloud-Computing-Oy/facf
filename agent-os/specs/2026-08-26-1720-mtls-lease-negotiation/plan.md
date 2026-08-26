# mTLS Lease Negotiation Plan

## Task 1: Save spec documentation

Validation: `npm run check`.

## Task 2: Add broker request correlation

Outcome: the broker sends a validated lease request only to an active provider
connection and resolves one validated decision or a bounded timeout.

## Task 3: Add agent decision handling

Outcome: the agent invokes its local lease authority and returns either a grant
or a stable rejection code without exposing workload content or tokens in logs.

## Task 4: Prove the duplex flow

Validation: real ephemeral-CA mTLS tests for accepted grant, overlapping lease
rejection, inactive provider, timeout/disconnect, regressions, audit, and CI.

## Non-goals

Prompts, data-plane execution, streaming, broker retry orchestration,
certificate lifecycle, persistence, or production deployment.
