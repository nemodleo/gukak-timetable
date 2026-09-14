// Copies docs/manual/*.png into public/docs/manual/ so the in-app manual
// pages (/docs/admin, /docs/instructor, /docs/student) can serve the same
// screenshots GitHub renders straight from docs/*.md — without committing a
// second copy of the binaries to git. public/docs/ is git-ignored; this
// script (wired into predev/prebuild) regenerates it on every checkout.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const src = join(dir, "..", "docs", "manual");
const dest = join(dir, "..", "public", "docs", "manual");

if (!existsSync(src)) process.exit(0);
mkdirSync(dest, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith(".png"));
for (const f of files) copyFileSync(join(src, f), join(dest, f));
console.log(`copy-docs-assets: copied ${files.length} screenshots -> public/docs/manual/`);
