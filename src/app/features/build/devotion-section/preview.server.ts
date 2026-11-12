import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { provideServerRendering, RenderMode, withRoutes } from '@angular/ssr';
import { DevotionSectionPreviewRoot, devotionSectionPreviewProviders } from './preview.component';

export default (context: BootstrapContext) =>
  bootstrapApplication(
    DevotionSectionPreviewRoot,
    {
      providers: [
        ...devotionSectionPreviewProviders,
        provideServerRendering(withRoutes([{ path: '**', renderMode: RenderMode.Prerender }])),
      ],
    },
    context,
  );
