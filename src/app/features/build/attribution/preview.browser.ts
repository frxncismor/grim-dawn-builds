import { bootstrapApplication } from '@angular/platform-browser';
import { BuildMetaPreviewRoot, buildMetaPreviewProviders } from './preview.component';

bootstrapApplication(BuildMetaPreviewRoot, {
  providers: buildMetaPreviewProviders,
}).catch(() =>
  console.error(
    $localize`:@@buildMetaPreview.bootstrap:No se pudo iniciar la vista de prueba de metadatos.`,
  ),
);
