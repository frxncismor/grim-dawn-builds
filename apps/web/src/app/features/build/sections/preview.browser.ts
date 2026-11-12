import { bootstrapApplication } from '@angular/platform-browser';
import { BuildSectionsPreviewRoot, buildSectionsPreviewProviders } from './preview.component';

bootstrapApplication(BuildSectionsPreviewRoot, { providers: buildSectionsPreviewProviders }).catch(
  () => console.error('No se pudo iniciar el preview de secciones.'),
);
