import { bootstrapApplication } from '@angular/platform-browser';
import { SkillTreePreviewRoot, skillTreePreviewProviders } from './preview.component';

bootstrapApplication(SkillTreePreviewRoot, { providers: skillTreePreviewProviders }).catch(() =>
  console.error('No se pudo iniciar el preview del árbol de habilidades.'),
);
