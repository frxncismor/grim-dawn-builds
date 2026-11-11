import { bootstrapApplication } from '@angular/platform-browser';
import { DevotionSectionPreviewRoot, devotionSectionPreviewProviders } from './preview.component';

bootstrapApplication(DevotionSectionPreviewRoot, {
  providers: devotionSectionPreviewProviders,
}).catch(() => console.error('No se pudo iniciar el preview de la ruta de devoción.'));
