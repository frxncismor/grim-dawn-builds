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
  { name: 'lint', command: 'npm run lint' },
  { name: 'lint:md', command: 'npm run lint:md' },
  { name: 'format', command: 'npm run format:check' },
  { name: 'test', command: 'npm test' },
  { name: 'test:scripts', command: 'npm run test:scripts' },
  { name: 'assets', command: 'npm run assets:check' },
  { name: 'build', command: 'npm run build' },
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
