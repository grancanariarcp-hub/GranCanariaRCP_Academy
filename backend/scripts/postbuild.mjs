// Copies non-TS runtime assets that tsc doesn't handle into dist/.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const assets = [['src/db/schema.sql', 'dist/db/schema.sql']];

// Imágenes que se incrustan en los PDF (logotipo de los diplomas).
for (const f of readdirSync('src/assets')) {
  assets.push([join('src/assets', f), join('dist/assets', f)]);
}

// Include every migration .sql file.
for (const f of readdirSync('src/db/migrations').filter((n) => n.endsWith('.sql'))) {
  assets.push([join('src/db/migrations', f), join('dist/db/migrations', f)]);
}

for (const [from, to] of assets) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`[postbuild] copied ${from} -> ${to}`);
}
