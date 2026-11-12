import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteLayout } from './shared/ui/layout/site-layout';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteLayout],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
