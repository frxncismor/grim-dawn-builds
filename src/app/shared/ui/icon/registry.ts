export const ICONS = {
  generic: 'Icono genérico',
  'mastery-generic': 'Maestría',
  'mastery-arcanista': 'Arcanista',
  'mastery-berserker': 'Berserker',
  'mastery-chaman': 'Chamán',
  'mastery-demoledor': 'Demoledor',
  'mastery-filo-nocturno': 'Filo Nocturno',
  'mastery-guardian-del-juramento': 'Guardián del Juramento',
  'mastery-inquisidor': 'Inquisidor',
  'mastery-nigromante': 'Nigromante',
  'mastery-ocultista': 'Ocultista',
  'mastery-soldado': 'Soldado',
  'damage-fisico': 'Físico',
  'damage-fuego': 'Fuego',
  'damage-frio': 'Frío',
  'damage-rayo': 'Rayo',
  'damage-acido': 'Ácido',
  'damage-vitalidad': 'Vitalidad',
  'damage-caos': 'Caos',
  'damage-eter': 'Éter',
  'damage-elemental': 'Elemental',
  'damage-sangrado': 'Sangrado',
  'damage-mascotas': 'Mascotas',
  'status-verificado': 'Verificado',
  'status-sin-verificar': 'Sin verificar',
  'status-placeholder': 'Pendiente de contenido',
  'review-borrador': 'Borrador',
  'review-en-revision': 'En revisión',
  'review-publicado': 'Publicado',
} as const;
export type IconName = keyof typeof ICONS;
/** The complete client-facing shape; never includes editorial asset provenance. */
export interface ResolvedIcon {
  readonly id: IconName;
  readonly src: string;
  readonly fallbackSrc: string;
}
export function fallbackIcon(name: string): ResolvedIcon {
  const id = Object.hasOwn(ICONS, name) ? (name as IconName) : 'generic';
  const src = `assets/icons/${id}.svg`;
  return { id, src, fallbackSrc: src };
}
export function isPublicAssetPath(path: string): boolean {
  return /^assets\/official\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.(?:svg|png|jpe?g|webp|avif)$/i.test(
    path,
  );
}
