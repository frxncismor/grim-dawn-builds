type Environment = Readonly<Record<string, string | undefined>>;

/** Closed public modes. Development draft previews are separate from this path. */
export function createPublicBuildEnv(
  input: Environment,
  mode: 'fixture' | 'release',
): Record<string, string> {
  if (mode !== 'fixture' && mode !== 'release')
    throw new Error('public-build: invalid-environment');
  const output: Record<string, string> = {};
  const osKeys = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP']);
  for (const [key, value] of Object.entries(input))
    if (value !== undefined && osKeys.has(key.toUpperCase())) output[key] = value;
  for (const key of ['BASE_URL', 'API_BASE_URL']) {
    const value = input[key];
    if (value === undefined) continue;
    try {
      const url = new URL(value);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
    } catch {
      throw new Error('public-build: invalid-environment');
    }
    output[key] = value;
  }
  return {
    ...output,
    CONTENT_SOURCE: mode === 'fixture' ? 'fixture' : 'api',
    BUILD_MODE: mode === 'fixture' ? 'local' : 'release',
    INCLUDE_DRAFTS: 'false',
    NODE_ENV: 'production',
    NG_BUILD_MAX_WORKERS: '2',
  };
}
