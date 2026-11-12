import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { provideServerRendering, RenderMode, withRoutes } from '@angular/ssr';
import { BuildPagePreviewRoot, buildPagePreviewProviders } from './preview.component';

export default (context: BootstrapContext) =>
  bootstrapApplication(
    BuildPagePreviewRoot,
    {
      providers: [
        ...buildPagePreviewProviders,
        provideServerRendering(withRoutes([{ path: '**', renderMode: RenderMode.Prerender }])),
      ],
    },
    context,
  );
