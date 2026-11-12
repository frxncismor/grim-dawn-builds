import { bootstrapApplication } from '@angular/platform-browser';
import { TierPreviewRoot, tierPreviewProviders } from './tier-preview.component';
bootstrapApplication(TierPreviewRoot, { providers: tierPreviewProviders }).catch(() =>
  console.error('No se pudo iniciar el preview del catálogo.'),
);
