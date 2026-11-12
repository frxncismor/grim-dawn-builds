import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { provideServerRendering, RenderMode, withRoutes } from '@angular/ssr';
import { DevotionMapPreviewRoot, devotionMapPreviewProviders } from './preview.component';

export default (context: BootstrapContext) =>
  bootstrapApplication(
    DevotionMapPreviewRoot,
    {
      providers: [
        ...devotionMapPreviewProviders,
        provideServerRendering(withRoutes([{ path: '**', renderMode: RenderMode.Prerender }])),
      ],
    },
    context,
  );
