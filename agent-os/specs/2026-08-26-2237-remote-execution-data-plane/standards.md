# Standards for Remote Execution Data Plane

The repository has no Agent OS standards index. These existing project rules
apply:

- Protocol payloads are closed objects using JSON Schema 2020-12 and matching
  runtime semantic validation.
- Unknown identity, correlation, grant, policy, or binding fails closed with a
  stable content-free code.
- Workload and result bodies never enter default logs or meter metadata.
- Network messages, timeouts, pending operations, and replay caches are bounded.
- A remote execution with an unknown terminal outcome is never automatically
  replayed on another provider.
- Existing local and control-plane behavior remains backward compatible.
- Every failure rule has a deterministic automated test.
