import { bootstrapApplication } from '@angular/platform-browser';
import { DevotionMapPreviewRoot, devotionMapPreviewProviders } from './preview.component';

bootstrapApplication(DevotionMapPreviewRoot, { providers: devotionMapPreviewProviders }).catch(() =>
  console.error('No se pudo iniciar el preview del mapa de devociones.'),
);
