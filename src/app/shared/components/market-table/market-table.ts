import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PriceDirection } from '@enums';
import type { StockDisplay } from '@view-models';

@Component({
  selector: 'app-market-table',
  host: {
    class: 'market-table-host'
  },
  templateUrl: './market-table.html',
  styleUrl: './market-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DecimalPipe,
    PercentPipe
  ]
})
export class MarketTable {
  public readonly rows = input.required<readonly StockDisplay[]>();
  protected readonly direction = PriceDirection;
}
