import { bootstrapApplication } from '@angular/platform-browser';
import { BuildPagePreviewRoot, buildPagePreviewProviders } from './preview.component';

bootstrapApplication(BuildPagePreviewRoot, {
  providers: buildPagePreviewProviders,
}).catch(() =>
  console.error(
    $localize`:@@buildPagePreview.bootstrap:No se pudo iniciar la vista de prueba de la página de guía.`,
  ),
);
