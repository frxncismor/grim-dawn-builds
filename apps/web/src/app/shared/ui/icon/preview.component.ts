import { Component, signal } from '@angular/core';
import { provideRouter, RouterOutlet } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { Icon } from './icon';
import { ICONS, type ResolvedIcon } from './registry';

/** Isolated verification surface; never referenced from application routes. */
@Component({
  selector: 'gd-icon-preview',
  imports: [Icon],
  template: `
    <main>
      <h1 i18n="@@iconPreview.title">Iconos propios</h1>
      <p i18n="@@iconPreview.description">
        Geometría local para maestrías, daño y estados. Prueba visual aislada.
      </p>
      @for (group of groups; track group.title) {
        <section [attr.aria-label]="group.title">
          <h2>{{ group.title }}</h2>
          <ul>
            @for (icon of group.icons; track icon.id) {
              <li>
                <gd-icon [name]="icon.id" /><span>{{ icon.label }}</span>
              </li>
            }
          </ul>
        </section>
      }
      <section aria-labelledby="state-title">
        <h2 id="state-title" i18n="@@iconPreview.states">Tamaños y estados</h2>
        <ul>
          <li>
            <gd-icon
              id="normal"
              name="damage-rayo"
              label="Daño de rayo"
              i18n-label="@@iconPreview.rayo"
            /><span i18n="@@iconPreview.labelled">Nombre accesible, tamaño normal</span>
          </li>
          <li>
            <gd-icon id="large" name="damage-rayo" size="large" /><span i18n="@@iconPreview.large"
              >Decorativo, tamaño grande</span
            >
          </li>
          <li>
            <gd-icon id="approved" name="damage-rayo" [source]="approved" /><span
              i18n="@@iconPreview.approved"
              >Activo propio de prueba</span
            >
          </li>
          <li>
            <gd-icon id="unknown" name="no-existe" /><span i18n="@@iconPreview.unknown"
              >Alternativa genérica</span
            >
          </li>
          <li>
            <gd-icon id="failure" name="damage-rayo" size="large" [source]="failure()" /><span
              i18n="@@iconPreview.failure"
              >Alternativa al fallar la imagen</span
            >
          </li>
        </ul>
        <button
          type="button"
          (click)="simulateFailure()"
          aria-controls="failure"
          i18n="@@iconPreview.simulate"
        >
          Simular fallo del recurso
        </button>
        <p i18n="@@iconPreview.truth">
          El recurso de prueba es propio. No es arte oficial ni acredita derechos sobre activos del
          juego.
        </p>
      </section>
    </main>
  `,
  styles: `
    main {
      max-inline-size: var(--page-max);
      margin-inline: auto;
      padding: var(--space-6) var(--space-5);
    }
    h1,
    h2 {
      font-family: var(--font-display);
      font-weight: var(--weight-display);
      line-height: var(--line-heading);
    }
    h1 {
      font-size: var(--text-heading);
      margin: 0 0 var(--space-4);
    }
    h2 {
      font-size: var(--text-large);
      margin: 0 0 var(--space-4);
    }
    p {
      max-inline-size: var(--reading-measure);
    }
    section {
      margin-block-start: var(--space-7);
    }
    ul {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, calc(var(--space-8) * 4)), 1fr));
      gap: var(--space-4) var(--space-6);
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      border-block-end: 1px solid var(--color-line);
      padding-block: var(--space-3);
    }
    button {
      color: var(--color-bone);
      background: var(--color-panel);
      border: 1px solid var(--color-ash);
      padding: var(--space-3) var(--space-4);
      font: inherit;
      cursor: pointer;
    }
    button:hover {
      background: var(--color-panel-2);
    }
  `,
})
export class IconPreview {
  readonly groups = [
    { title: $localize`:@@iconPreview.masteries:Maestrías`, prefix: 'mastery-' },
    { title: $localize`:@@iconPreview.damage:Tipos de daño`, prefix: 'damage-' },
    { title: $localize`:@@iconPreview.status:Estado del contenido`, prefix: 'status-' },
    { title: $localize`:@@iconPreview.review:Revisión editorial`, prefix: 'review-' },
  ].map((group) => ({
    ...group,
    icons: Object.entries(ICONS)
      .filter(([id]) => id.startsWith(group.prefix))
      .map(([id, label]) => ({ id, label })),
  }));
  readonly approved: ResolvedIcon = {
    id: 'damage-rayo',
    src: 'assets/official/approved-preview.svg',
    fallbackSrc: 'assets/icons/damage-rayo.svg',
  };
  readonly failure = signal<ResolvedIcon | null>(null);
  simulateFailure(): void {
    this.failure.set({ ...this.approved, src: 'assets/official/missing-preview.svg' });
  }
}
@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class IconPreviewRoot {}
export const previewProviders = [
  provideRouter([{ path: '', component: IconPreview }]),
  provideClientHydration(withEventReplay()),
];
