import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MarketTable } from '@components/market-table/market-table';
import type { MarketView } from '@view-models';

@Component({
  selector: 'app-market-watchlist',
  host: {
    class: 'market-watchlist-host'
  },
  templateUrl: './market-watchlist.html',
  styleUrl: './market-watchlist.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    MarketTable
  ]
})
export class MarketWatchlist {
  public readonly market = input.required<MarketView>();
  public readonly notice = input<string | null>(null);
}
