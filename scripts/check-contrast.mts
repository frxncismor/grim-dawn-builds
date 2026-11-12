import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function luminance(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex))
    throw new Error('Se requiere un color hexadecimal de seis dígitos.');
  const values = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
}

/** WCAG relative luminance. Never round this result before comparing a threshold. */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function checkTokenContrast(css: string) {
  const colors = new Map<string, string>();
  for (const match of css.matchAll(/(--color-[a-z0-9-]+)\s*:\s*(#[0-9a-f]{6})\s*;/gi)) {
    if (colors.has(match[1]!)) throw new Error('Color declarado más de una vez.');
    colors.set(match[1]!, match[2]!);
  }
  const color = (name: string) => {
    const result = colors.get(name);
    if (!result) throw new Error('Falta un token de color requerido.');
    return result;
  };
  return ['bone', 'ash', 'storm', 'ember'].flatMap((foreground) =>
    ['soot', 'panel', 'panel-2'].map((background) => {
      const ratio = contrastRatio(color(`--color-${foreground}`), color(`--color-${background}`));
      return { foreground, background, ratio, pass: ratio >= 4.5 };
    }),
  );
}

async function main(argv: string[]): Promise<number> {
  try {
    if (argv.length && (argv.length !== 2 || argv[0] !== '--file'))
      throw new Error('Argumento desconocido.');
    const css = await readFile(resolve(argv[1] ?? 'apps/web/src/styles/tokens.css'), 'utf8');
    const checks = checkTokenContrast(css);
    for (const check of checks)
      console.log(
        `${check.foreground}/${check.background}: ${check.ratio.toFixed(3)}:1 ${check.pass ? 'OK' : 'FALLÓ'}`,
      );
    if (checks.some((check) => !check.pass)) return 1;
    console.log(`check:contrast OK (${checks.length} pares, mínimo 4.5:1 sin redondear)`);
    return 0;
  } catch {
    console.error('check:contrast FALLÓ: revisa argumentos y tokens de color.');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = await main(process.argv.slice(2));
