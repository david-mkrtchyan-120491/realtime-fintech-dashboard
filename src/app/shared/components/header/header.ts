import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MarketControlsDirective } from '@directives';

@Component({
  selector: 'app-header',
  host: {
    class: 'app-header-host'
  },
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    MarketControlsDirective
  ]
})
export class Header {}
