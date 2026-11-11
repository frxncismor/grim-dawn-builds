import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/**
 * Ejecuta pasos de verificación en orden y se detiene en el primero que falle.
 * El ejecutor se inyecta para poder probar la secuencia sin lanzar procesos.
 *
 * @param {{ name: string, command: string }[]} steps
 * @param {(step: { name: string, command: string }) => Promise<number>} exec
 * @returns {Promise<{ ok: boolean, failedStep?: string, exitCode?: number }>}
 */
export async function runSteps(steps, exec) {
  for (const step of steps) {
    const exitCode = await exec(step);
    if (exitCode !== 0) {
      return { ok: false, failedStep: step.name, exitCode };
    }
  }
  return { ok: true };
}

/** Pasos locales de verificación (T-004). Sin CI ni secretos (hosting=local_first). */
export const VERIFY_STEPS = [
  { name: 'check-scope', command: 'pnpm run check:scope' },
  { name: 'check-boundaries', command: 'pnpm run check:boundaries' },
  { name: 'check-secrets', command: 'pnpm run check:secrets' },
  { name: 'check-ci-secrets', command: 'pnpm run check:ci-secrets' },
  { name: 'domain:build', command: 'pnpm --filter @gd/domain build' },
  { name: 'domain:typecheck', command: 'pnpm --filter @gd/domain typecheck' },
  { name: 'domain:lint', command: 'pnpm --filter @gd/domain lint' },
  { name: 'domain:test', command: 'pnpm --filter @gd/domain test' },
  { name: 'api:typecheck', command: 'pnpm --filter @gd/api typecheck' },
  { name: 'api:lint', command: 'pnpm --filter @gd/api lint' },
  { name: 'api:test', command: 'pnpm --filter @gd/api test' },
  { name: 'test:rotation', command: 'pnpm test:rotation' },
  { name: 'lint', command: 'pnpm lint' },
  { name: 'lint:md', command: 'pnpm lint:md' },
  { name: 'format', command: 'pnpm format:check' },
  { name: 'test', command: 'pnpm test' },
  { name: 'test:scripts', command: 'pnpm test:scripts' },
  { name: 'assets', command: 'pnpm assets:check' },
  { name: 'contrast', command: 'pnpm check:contrast' },
  { name: 'build', command: 'pnpm build' },
  { name: 'public-build', command: 'pnpm check:public-build' },
  // T-042: Lighthouse mide el artefacto de `build` (dist/), nunca `ng serve`;
  // por eso es el último paso y depende de que el build haya terminado.
  // Se mantiene fuera de `verify` hasta que T-145 corrija el TBT de /acerca,
  // /legal y /autores: un gate que falla por un defecto conocido dejaría el
  // `pnpm verify` rojo y ocultaría regresiones nuevas.
];

/** @param {{ command: string }} step @returns {Promise<number>} */
function runShell(step) {
  return new Promise((resolve) => {
    const child = spawn(step.command, { stdio: 'inherit', shell: true });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = await runSteps(VERIFY_STEPS, async (step) => {
    console.log(`\n== verify: ${step.name} ==`);
    return runShell(step);
  });
  if (!result.ok) {
    console.error(`\nverify FAILED at "${result.failedStep}" (exit ${result.exitCode})`);
    process.exit(result.exitCode ?? 1);
  }
  console.log('\nverify OK (local)');
}
