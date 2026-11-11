import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { provideServerRendering, RenderMode, withRoutes } from '@angular/ssr';
import { BuildSectionsPreviewRoot, buildSectionsPreviewProviders } from './preview.component';

export default (context: BootstrapContext) =>
  bootstrapApplication(
    BuildSectionsPreviewRoot,
    {
      providers: [
        ...buildSectionsPreviewProviders,
        provideServerRendering(withRoutes([{ path: '**', renderMode: RenderMode.Prerender }])),
      ],
    },
    context,
  );
