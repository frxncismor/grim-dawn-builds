import { bootstrapApplication } from '@angular/platform-browser';
import { IconPreviewRoot, previewProviders } from './preview.component';
bootstrapApplication(IconPreviewRoot, { providers: previewProviders }).catch(() =>
  console.error('No se pudo iniciar el preview de iconos.'),
);
