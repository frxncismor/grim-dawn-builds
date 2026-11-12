import { bootstrapApplication } from '@angular/platform-browser';
import { LootFilterPreviewRoot, lootFilterPreviewProviders } from './preview.component';

bootstrapApplication(LootFilterPreviewRoot, {
  providers: lootFilterPreviewProviders,
}).catch(() => console.error('No se pudo iniciar el preview del filtro de botín.'));
