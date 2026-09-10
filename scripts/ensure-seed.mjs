// Guarantees src/data/seed-2026.json exists before dev / build / test.
//
// The real seed holds actual student names and is never committed. Only
// seed-2026.example.json (a tiny anonymised placeholder) lives in git; this
// script copies it into place on a fresh checkout. `make seed` overwrites the
// copy with the real data locally — it stays git-ignored and untracked.
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const seed = join(dir, "..", "src", "data", "seed-2026.json");
const example = join(dir, "..", "src", "data", "seed-2026.example.json");

if (!existsSync(seed)) {
  copyFileSync(example, seed);
  console.log("ensure-seed: created src/data/seed-2026.json from the example placeholder");
}
