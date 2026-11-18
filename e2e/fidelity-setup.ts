import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** Limpia la carpeta de capturas (ignorada por git) antes de cada corrida de `e2e:fidelity`. */
export default function globalSetup(): void {
  const dir = join(process.cwd(), 'test-results', 'fidelity');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}
