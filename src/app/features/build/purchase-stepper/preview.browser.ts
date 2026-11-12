import { bootstrapApplication } from '@angular/platform-browser';
import { PurchaseStepperPreviewRoot, purchaseStepperPreviewProviders } from './preview.component';

bootstrapApplication(PurchaseStepperPreviewRoot, {
  providers: purchaseStepperPreviewProviders,
}).catch(() => console.error('No se pudo iniciar el preview del orden de compra.'));
