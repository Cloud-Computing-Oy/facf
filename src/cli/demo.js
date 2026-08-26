#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Broker } from "../core/broker.js";
import { LeaseStore } from "../core/lease-store.js";
import { SimulatedProvider } from "../provider/simulator.js";

const fixture = async (name) => JSON.parse(await readFile(new URL(`../../protocol/v0alpha1/fixtures/${name}`, import.meta.url), "utf8"));
const workload = await fixture("workload.public.json");
const offer = await fixture("offer.laptop.json");
const clock = () => new Date("2026-08-26T08:00:00.000Z");
let id = 0;
const idFactory = () => `demo-id-${++id}`;

console.log("FACF Phase 0 simulator — not a production network\n");

const localProvider = new SimulatedProvider({ offer, responseText: "Executed on the laptop-style FACF provider.", clock, idFactory });
const localBroker = new Broker({ leaseStore: new LeaseStore({ clock, idFactory }), clock, idFactory });
const local = await localBroker.run(workload, [localProvider.advertise()], new Map([[offer.providerId, localProvider]]));
print("Scenario 1: eligible local provider", local);

const unavailableProvider = new SimulatedProvider({ offer, failureCode: "runtime_unreachable", clock, idFactory });
const fallback = {
  providerId: "cloud-fallback",
  capability: { region: "EU", trustTier: "community", dataClasses: ["public", "synthetic"], maxPriceEur: 0.03 },
  async execute() {
    return { text: "Executed through bounded cloud fallback.", usage: { inputTokens: 12, outputTokens: 8 }, priceEur: 0.02 };
  }
};
const fallbackBroker = new Broker({ leaseStore: new LeaseStore({ clock, idFactory }), fallback, clock, idFactory });
const cloud = await fallbackBroker.run({ ...workload, workloadId: "workload-demo-002" }, [unavailableProvider.advertise()], new Map([[offer.providerId, unavailableProvider]]));
print("Scenario 2: provider loss with cloud fallback", cloud);

function print(title, execution) {
  console.log(title);
  console.log(JSON.stringify({ route: execution.route, providerId: execution.providerId, output: execution.result.output.text, meter: execution.meter, failures: execution.failures ?? [] }, null, 2));
  console.log();
}

void fileURLToPath;
