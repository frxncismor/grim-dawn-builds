import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { provideServerRendering, RenderMode, withRoutes } from '@angular/ssr';
import { LootFilterPreviewRoot, lootFilterPreviewProviders } from './preview.component';

export default (context: BootstrapContext) =>
  bootstrapApplication(
    LootFilterPreviewRoot,
    {
      providers: [
        ...lootFilterPreviewProviders,
        provideServerRendering(withRoutes([{ path: '**', renderMode: RenderMode.Prerender }])),
      ],
    },
    context,
  );
