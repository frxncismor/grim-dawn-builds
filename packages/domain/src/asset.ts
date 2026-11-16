import { ICON_ID_PATTERN } from './mastery-tree.js';
import { AssetSchema, type Asset } from './schema.js';

/** Repo path of a derived skill icon, relative to `apps/web`; named by its public id only. */
export function skillIconFilePath(iconId: string): string {
  return `public/assets/skill-icons/${iconId}.png`;
}

const ICON_RIGHTS_HOLDER = 'Crate Entertainment';
const ICON_LICENSE = 'tolerancia_de_facto_sin_permiso';
const ICON_PROOF = 'specs/004-rediseno-ui-grim-dawn/research.md#r10';
export const SKILL_ICON_SIZE = 32;

/**
 * One manifest entry per skill icon (constitution 1.11.0 §VII, research.md §R10). Applies on top of
 * `AssetSchema` to entries whose slug is an icon id; a pending entry only needs the common shape.
 */
export const SkillIconAssetSchema = AssetSchema.superRefine((asset, ctx) => {
  const fail = (path: string[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  if (!ICON_ID_PATTERN.test(asset.slug)) fail(['slug'], 'el slug de un icono es su icon_id');
  if (asset.file_path && asset.file_path !== skillIconFilePath(asset.slug))
    fail(['file_path'], 'la ruta debe derivarse del icon_id');
  if (asset.status !== 'approved') return;
  if (asset.rights_holder !== ICON_RIGHTS_HOLDER)
    fail(['rights_holder'], `rights_holder debe ser ${ICON_RIGHTS_HOLDER}`);
  if (asset.license_or_permission !== ICON_LICENSE)
    fail(['license_or_permission'], `license_or_permission debe ser ${ICON_LICENSE}`);
  if (asset.proof_ref !== ICON_PROOF) fail(['proof_ref'], `proof_ref debe ser ${ICON_PROOF}`);
  if (!asset.provenance) {
    fail(['provenance'], 'un icono aprobado requiere su procedencia con sha256');
  } else if (
    asset.provenance.width !== SKILL_ICON_SIZE ||
    asset.provenance.height !== SKILL_ICON_SIZE
  ) {
    fail(['provenance'], `un icono mide ${SKILL_ICON_SIZE} x ${SKILL_ICON_SIZE}`);
  }
});

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
    const result = (isIconSlug(slugOf(raw)) ? SkillIconAssetSchema : AssetSchema).safeParse(raw);
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

function isIconSlug(slug: string | undefined): boolean {
  return slug !== undefined && ICON_ID_PATTERN.test(slug);
}
