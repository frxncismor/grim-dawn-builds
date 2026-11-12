import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { provideServerRendering, RenderMode, withRoutes } from '@angular/ssr';
import { VideoFacadePreviewRoot, videoFacadePreviewProviders } from './preview.component';

export default (context: BootstrapContext) =>
  bootstrapApplication(
    VideoFacadePreviewRoot,
    {
      providers: [
        ...videoFacadePreviewProviders,
        provideServerRendering(withRoutes([{ path: '**', renderMode: RenderMode.Prerender }])),
      ],
    },
    context,
  );
