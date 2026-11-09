/** One configuration problem: the variable name and a short code. Never the value. */
export interface ConfigIssue {
  readonly field: string;
  readonly code: string;
}

/**
 * Raised when configuration is invalid. Carries field names and issue codes
 * only: never the rejected input values, so it is safe to print or log.
 */
export class ConfigError extends Error {
  readonly fields: readonly string[];
  readonly codes: readonly string[];

  constructor(issues: readonly ConfigIssue[]) {
    super(`Invalid configuration: ${issues.map((i) => `${i.field} (${i.code})`).join(', ')}`);
    this.name = 'ConfigError';
    this.fields = [...new Set(issues.map((i) => i.field))];
    this.codes = issues.map((i) => i.code);
  }
}
