// Copies non-TS runtime assets that tsc doesn't handle into dist/.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const assets = [['src/db/schema.sql', 'dist/db/schema.sql']];

for (const [from, to] of assets) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`[postbuild] copied ${from} -> ${to}`);
}
