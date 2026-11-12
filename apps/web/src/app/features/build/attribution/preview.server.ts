import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { provideServerRendering, RenderMode, withRoutes } from '@angular/ssr';
import { BuildMetaPreviewRoot, buildMetaPreviewProviders } from './preview.component';

export default (context: BootstrapContext) =>
  bootstrapApplication(
    BuildMetaPreviewRoot,
    {
      providers: [
        ...buildMetaPreviewProviders,
        provideServerRendering(withRoutes([{ path: '**', renderMode: RenderMode.Prerender }])),
      ],
    },
    context,
  );
