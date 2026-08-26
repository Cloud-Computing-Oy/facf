# Glossary

- **Agent:** Software running in a provider domain that advertises capacity and executes granted work.
- **Broker:** Control-plane service that matches eligible workloads to provider offers.
- **Capability:** A signed description of models, hardware, limits, location, and trust evidence.
- **Cell:** A provider-side execution environment, potentially a single machine or an internal cluster.
- **Client:** An application or organization submitting a workload.
- **Execution grant:** A short-lived authorization binding a workload to a provider and resource limit.
- **Fabric:** A federation of independently administered compute cells using compatible control protocols.
- **Lease:** Time-bounded reservation between broker and provider for one workload attempt.
- **Managed network:** An operated FACF service with enrollment, policy, monitoring, billing, and support.
- **Meter event:** Signed evidence of measured workload consumption.
- **Offer:** A provider's availability and commercial constraints for a capability.
- **Private fabric:** A deployment whose membership and policies are controlled by one customer or consortium.
- **Provider:** A person or organization making compute capacity available.
- **Trust tier:** Operator-defined eligibility class based on verification and operating controls.
- **Whole-job federation:** Routing a complete request or bounded batch to one execution cell instead of splitting individual model layers across unreliable networks.
