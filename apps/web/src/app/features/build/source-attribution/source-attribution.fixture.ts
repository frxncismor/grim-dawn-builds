import type { LinkOnlyMetadata } from '@gd/domain';

/**
 * Synthetic adaptation metadata used only by the specs (plan §15.1, T-105).
 * It deliberately does not come from `content/`: no real guide, forum or author
 * is reproduced, and the gate is not bypassed because this is not stored data.
 */
export const sampleAdaptation: LinkOnlyMetadata = Object.freeze({
  source_url: 'https://foro.example.com/tema/guia-adaptada?p=42',
  original_title: 'Guía original de muestra',
  original_author: 'Autora de muestra',
  original_site: 'foro.example.com',
  retrieved_on: '2026-10-01',
  attribution_text:
    'Adaptación sintética de la guía original de muestra, con un permiso ficticio registrado.',
});
