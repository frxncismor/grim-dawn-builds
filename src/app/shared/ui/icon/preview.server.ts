import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { provideServerRendering, RenderMode, withRoutes } from '@angular/ssr';
import { IconPreviewRoot, previewProviders } from './preview.component';
export default (context: BootstrapContext) =>
  bootstrapApplication(
    IconPreviewRoot,
    {
      providers: [
        ...previewProviders,
        provideServerRendering(withRoutes([{ path: '**', renderMode: RenderMode.Prerender }])),
      ],
    },
    context,
  );
