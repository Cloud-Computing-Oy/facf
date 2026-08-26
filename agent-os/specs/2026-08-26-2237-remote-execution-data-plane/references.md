# References for Remote Execution Data Plane

## mTLS control and lease negotiation

- **Location:** `src/control/mtls-control.js`
- **Relevance:** authenticated outbound connection, bounded correlation,
  disconnect handling, and content-free error logging.

## Provider lease authority

- **Location:** `src/control/agent-lease-authority.js`
- **Relevance:** least-privilege grant validation, local capacity authority,
  expiry, and idempotent lease requests.

## Broker retry and fallback

- **Location:** `src/core/broker.js`
- **Relevance:** provider attempts, lease lifecycle, bounded fallback, and the
  point where unknown remote execution outcomes must stop replay.

## Runtime providers

- **Location:** `src/provider/ollama-provider.js`, `src/provider/simulator.js`
- **Relevance:** existing `execute({ workload, lease })` contract and
  privacy-safe terminal result/meter shape.
