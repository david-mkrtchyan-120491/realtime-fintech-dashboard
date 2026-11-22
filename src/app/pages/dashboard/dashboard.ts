import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MarketWatchlist } from '@components/market-watchlist/market-watchlist';
import { MarketDirective } from '@directives';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MarketDirective,
    MarketWatchlist
  ]
})
export class Dashboard {}
