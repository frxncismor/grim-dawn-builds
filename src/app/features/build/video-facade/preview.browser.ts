import { bootstrapApplication } from '@angular/platform-browser';
import { VideoFacadePreviewRoot, videoFacadePreviewProviders } from './preview.component';

bootstrapApplication(VideoFacadePreviewRoot, {
  providers: videoFacadePreviewProviders,
}).catch(() =>
  console.error(
    $localize`:@@videoFacadePreview.bootstrap:No se pudo iniciar la vista de prueba de video.`,
  ),
);
