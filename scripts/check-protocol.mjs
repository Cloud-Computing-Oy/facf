import { readFile, readdir } from "node:fs/promises";
import { validateOffer, validateWorkload } from "../src/protocol/validate.js";

const root = new URL("../protocol/v0alpha1/", import.meta.url);
const expectedSchemas = ["capability", "lease", "meter", "offer", "result", "workload"];
const files = await readdir(root);
for (const name of expectedSchemas) {
  const filename = `${name}.schema.json`;
  if (!files.includes(filename)) throw new Error(`Missing protocol schema: ${filename}`);
  const schema = JSON.parse(await readFile(new URL(filename, root), "utf8"));
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") throw new Error(`${filename} must use JSON Schema 2020-12`);
  if (!schema.$id?.includes("/v0alpha1/")) throw new Error(`${filename} must have a v0alpha1 $id`);
  if (schema.type !== "object" || schema.additionalProperties !== false) throw new Error(`${filename} must be a closed object schema`);
}
validateWorkload(JSON.parse(await readFile(new URL("fixtures/workload.public.json", root), "utf8")));
validateOffer(JSON.parse(await readFile(new URL("fixtures/offer.laptop.json", root), "utf8")));
console.log(`Protocol validation passed (${expectedSchemas.length} schemas).`);
