import { AssetSchema, type Asset } from './schema.js';

export interface AssetIssue {
  /** Set when the problem is a manifest entry or a file path. */
  file?: string;
  /** Field path inside a manifest entry, when the problem is a field. */
  path?: string;
  message: string;
}

/**
 * Checks the asset manifest against the official-art files found on disk.
 * Official art may ship only when an approved manifest entry names that file.
 * When `fileHashes` (repo-relative path -> sha256) is supplied, every approved entry must have its
 * file on disk and, if it records a provenance sha256, the file must match it.
 * Pure: the caller supplies the file list and the hashes.
 */
export function checkAssetManifest(
  manifest: { assets: readonly unknown[] },
  officialFiles: readonly string[],
  fileHashes?: Readonly<Record<string, string>>,
): AssetIssue[] {
  const issues: AssetIssue[] = [];
  const seen = new Set<string>();
  const approvedPaths = new Set<string>();

  for (const raw of manifest.assets) {
    const result = AssetSchema.safeParse(raw);
    if (!result.success) {
      const slug = slugOf(raw) ?? '(sin slug)';
      for (const issue of result.error.issues) {
        issues.push({
          file: slug,
          path: issue.path.join('.'),
          message: issue.message,
        });
      }
      continue;
    }
    const asset: Asset = result.data;
    if (seen.has(asset.slug)) {
      issues.push({ file: asset.slug, message: `slug duplicado: ${asset.slug}` });
    }
    seen.add(asset.slug);
    if (asset.status === 'approved' && asset.file_path) {
      approvedPaths.add(asset.file_path);
      if (fileHashes) checkFile(asset, fileHashes, issues);
    }
  }

  for (const file of officialFiles) {
    if (!approvedPaths.has(file)) {
      issues.push({ file, message: 'arte oficial sin entrada aprobada en el manifiesto' });
    }
  }
  return issues;
}

function checkFile(
  asset: Asset,
  fileHashes: Readonly<Record<string, string>>,
  issues: AssetIssue[],
): void {
  const actual = asset.file_path ? fileHashes[asset.file_path] : undefined;
  if (actual === undefined) {
    issues.push({ file: asset.slug, path: 'file_path', message: 'el archivo aprobado no existe' });
  } else if (asset.provenance && asset.provenance.sha256 !== actual) {
    issues.push({
      file: asset.slug,
      path: 'provenance.sha256',
      message: 'el archivo no coincide con el sha256 del manifiesto',
    });
  }
}

function slugOf(raw: unknown): string | undefined {
  if (raw && typeof raw === 'object' && 'slug' in raw && typeof raw.slug === 'string') {
    return raw.slug;
  }
  return undefined;
}
