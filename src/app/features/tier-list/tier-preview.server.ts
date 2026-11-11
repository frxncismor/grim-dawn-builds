import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { provideServerRendering, RenderMode, withRoutes } from '@angular/ssr';
import { TierPreviewRoot, tierPreviewProviders } from './tier-preview.component';
export default (context: BootstrapContext) =>
  bootstrapApplication(
    TierPreviewRoot,
    {
      providers: [
        ...tierPreviewProviders,
        provideServerRendering(withRoutes([{ path: '**', renderMode: RenderMode.Prerender }])),
      ],
    },
    context,
  );
