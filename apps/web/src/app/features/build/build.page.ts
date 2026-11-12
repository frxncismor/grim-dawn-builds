import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { LinkOnlyMetadata, PublicBuild } from '@gd/domain';
import { SeoService, type JsonLdRecord } from '../../core/seo/seo.service';
import { BuildAttribution } from './attribution/build-attribution';
import { DevotionSection } from './devotion-section/devotion-section';
import { LootFilter } from './loot-filter/loot-filter';
import { PurchaseStepper, type PurchaseStepSelection } from './purchase-stepper/purchase-stepper';
import { BuildSections } from './sections/build-sections';
import { SourceAttribution } from './source-attribution/source-attribution';
import { BuildToc } from './toc/build-toc';
import { VideoFacade } from './video-facade/video-facade';
import { SkillTree } from '../../shared/svg/skill-tree/skill-tree';

type SkillNode = PublicBuild['skill_nodes'][number];
type Mastery = PublicBuild['masteries'][number];
type DevotionStep = PublicBuild['devotion_steps'][number];

/**
 * Public, normalized projection produced by the T-020 resolver. It never carries
 * private rights, review or evidence fields: the page only renders what it receives.
 *
 * `adaptation` is the public, factual metadata of a third-party adaptation
 * (`LinkOnlyMetadata`, T-107). It stays optional and lives only in the app model:
 * the domain schema is untouched, and T-108 will feed it from the public database
 * views once the publication gate allows the native mode. When present, the page
 * renders `gd-source-attribution` and adds its original URL to `isBasedOn`.
 */
export type BuildPageContent = PublicBuild & {
  readonly authorIsPlaceholder: boolean;
  readonly draft: boolean;
  readonly adaptation?: LinkOnlyMetadata | null;
};

export interface SkillTreeSlot {
  readonly treeId: string;
  readonly mastery: Mastery;
  readonly nodes: readonly SkillNode[];
}

/** Author slug reserved for unconfirmed identities; it never becomes a public link. */
const PLACEHOLDER_AUTHOR_SLUG = 'por-confirmar';
const SITE_NAME = 'Grim Dawn Builds';
const TREE_SUFFIXES = ['a', 'b'] as const;
const HOME_LABEL = $localize`:@@buildPage.breadcrumbHome:Home`;

/** Only plain HTTP(S) URLs without credentials become structured-data URLs. */
function publicHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

@Component({
  selector: 'gd-build-page',
  standalone: true,
  imports: [
    BuildSections,
    SkillTree,
    PurchaseStepper,
    LootFilter,
    DevotionSection,
    VideoFacade,
    BuildAttribution,
    BuildToc,
    NgTemplateOutlet,
    SourceAttribution,
  ],
  templateUrl: './build.page.html',
  styleUrl: './build.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildPage {
  private readonly seo = inject(SeoService);

  readonly content = input.required<BuildPageContent>();
  readonly activeIds = signal<readonly string[]>([]);
  readonly activeStepPosition = linkedSignal<string, number | undefined>({
    source: () => this.content().slug,
    computation: () => undefined,
  });

  readonly treeSlots = computed<SkillTreeSlot[]>(() =>
    this.content().masteries.map((mastery, index) => ({
      treeId: `${this.content().slug}-tree-${TREE_SUFFIXES[index] ?? index + 1}`,
      mastery,
      nodes: this.content().skill_nodes.filter((node) => node.mastery_slug === mastery.slug),
    })),
  );
  readonly devotionMapId = computed(() => `${this.content().slug}-devotion-map`);
  readonly orderedDevotionSteps = computed<DevotionStep[]>(() =>
    [...this.content().devotion_steps].sort((left, right) => left.position - right.position),
  );
  readonly devotionIntroductions = computed(() =>
    [...this.content().notes]
      .filter((note) => note.kind === 'general' && note.label === 'Ruta de devoción')
      .sort((left, right) => left.position - right.position),
  );
  readonly hasVideo = computed(() => (this.content().video_url ?? '').trim().length > 0);

  constructor() {
    effect(() => {
      const content = this.content();
      this.seo.setPage({
        title: content.title,
        description: content.summary,
        path: `/builds/${content.slug}`,
        type: 'article',
        robots: content.draft ? 'noindex,follow' : 'index,follow',
        structuredData: [this.articleRecord(content), this.breadcrumbRecord(content)],
      });
    });
  }

  onSelectionChange(selection: PurchaseStepSelection): void {
    this.activeIds.set(selection.activeIds);
  }

  onDevotionStepChange(position: number): void {
    this.activeStepPosition.set(position);
  }

  nodeStatusLabel(status: SkillNode['status']): string {
    switch (status) {
      case 'recomendada':
        return $localize`:@@buildPage.statusRecommended:Recommended`;
      case 'meta':
        return $localize`:@@buildPage.statusMeta:Meta`;
      case 'omitir':
        return $localize`:@@buildPage.statusSkip:Skip`;
    }
  }

  verificationLabel(verification: DevotionStep['verification']): string {
    return verification === 'verificado'
      ? $localize`:@@buildPage.verified:Verified`
      : $localize`:@@buildPage.unverified:Unverified`;
  }

  /** Public Article data only: drafts never claim authorship or publication dates. */
  private articleRecord(content: BuildPageContent): JsonLdRecord {
    const record: JsonLdRecord = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: content.title,
      description: content.summary,
      inLanguage: content.locale,
      mainEntityOfPage: this.seo.canonical(`/builds/${content.slug}`),
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: this.seo.canonical('/'),
      },
    };

    if (!content.draft) {
      const authorUrl = publicHttpUrl(content.author.url);
      if (!content.authorIsPlaceholder && content.author.slug !== PLACEHOLDER_AUTHOR_SLUG) {
        record['author'] = authorUrl
          ? { '@type': 'Person', name: content.author.display_name, url: authorUrl }
          : { '@type': 'Person', name: content.author.display_name };
      }
      if (content.published_at) record['datePublished'] = content.published_at;
    }

    const basedOn = content.sources
      .map((source) => publicHttpUrl(source.url))
      .filter((url): url is string => url !== null);
    // FR-29/AC-21: an adaptation also names its original in structured data.
    // The same URL cited as a source is not repeated, and unsafe URLs never
    // enter `isBasedOn`; without an adaptation nothing changes.
    const adaptedFrom = content.adaptation ? publicHttpUrl(content.adaptation.source_url) : null;
    if (adaptedFrom && !basedOn.includes(adaptedFrom)) basedOn.push(adaptedFrom);
    if (basedOn.length) record['isBasedOn'] = basedOn;

    if (content.sources.length) {
      record['citation'] = content.sources.map((source) => ({
        '@type': 'CreativeWork',
        name: source.title,
        author: { '@type': 'Person', name: source.author_name },
      }));
    }

    // `license` is a URL in schema.org: a textual permission note is published as
    // citation metadata instead of being turned into an invented license link.
    const license = content.sources
      .map((source) => publicHttpUrl(source.license_note))
      .find((url): url is string => url !== null);
    if (license) record['license'] = license;

    return record;
  }

  private breadcrumbRecord(content: BuildPageContent): JsonLdRecord {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: HOME_LABEL,
          item: this.seo.canonical('/'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: content.title,
          item: this.seo.canonical(`/builds/${content.slug}`),
        },
      ],
    };
  }
}
