import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { provideServerRendering, RenderMode, withRoutes } from '@angular/ssr';
import { PurchaseStepperPreviewRoot, purchaseStepperPreviewProviders } from './preview.component';

export default (context: BootstrapContext) =>
  bootstrapApplication(
    PurchaseStepperPreviewRoot,
    {
      providers: [
        ...purchaseStepperPreviewProviders,
        provideServerRendering(withRoutes([{ path: '**', renderMode: RenderMode.Prerender }])),
      ],
    },
    context,
  );
