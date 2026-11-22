package market

import (
	"fmt"
	"math/rand/v2"
	"testing"
)

type edgeRandom struct {
	upper bool
}

func (r edgeRandom) IntN(n int) int {
	if r.upper {
		return n - 1
	}

	return 0
}

func TestBatchReturnsRequestedSize(t *testing.T) {
	for _, count := range []int{1, 5, 50} {
		for _, size := range []int{1, 2, 100, 1_000} {
			t.Run(fmt.Sprintf("%d_symbols_%d_updates", count, size), func(t *testing.T) {
				symbols := make([]string, count)
				for i := range symbols {
					symbols[i] = fmt.Sprintf("SIM%02d", i+1)
				}
				generator := New(rand.New(rand.NewPCG(42, 17)))

				for batchIndex := 0; batchIndex < 3; batchIndex++ {
					trades, err := generator.Batch(symbols, size)
					if err != nil {
						t.Fatal(err)
					}
					if len(trades) != size {
						t.Fatalf("batch %d: got %d trades, want %d total", batchIndex, len(trades), size)
					}
				}
			})
		}
	}
}

func TestGeneratedValuesAreValid(t *testing.T) {
	cases := []struct {
		name   string
		random Random
	}{
		{name: "lowest_random_values", random: edgeRandom{}},
		{name: "highest_random_values", random: edgeRandom{upper: true}},
		{name: "fixed_seed", random: rand.New(rand.NewPCG(42, 17))},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			generator := New(test.random)
			allowed := map[string]bool{"ALFA": true, "BETA": true, "GAMMA": true}
			previous := make(map[string]int)

			for batchIndex := 0; batchIndex < 10; batchIndex++ {
				trades, err := generator.Batch([]string{"ALFA", "BETA", "GAMMA"}, 1_000)
				if err != nil {
					t.Fatal(err)
				}

				for _, trade := range trades {
					if !allowed[trade.Symbol] {
						t.Fatalf("unexpected symbol: %q", trade.Symbol)
					}
					assertValidTrade(t, trade)

					lastPrice, exists := previous[trade.Symbol]
					if !exists {
						lastPrice = 10_000
					}
					change := trade.PriceCents - lastPrice
					if change < -11 || change > 15 {
						t.Fatalf("%s price jumped from %d to %d", trade.Symbol, lastPrice, trade.PriceCents)
					}
					previous[trade.Symbol] = trade.PriceCents
				}
			}
		})
	}
}

func TestPricesEvolveIndependentlyAcrossCalls(t *testing.T) {
	generator := New(edgeRandom{})

	first, err := generator.Batch([]string{"ALFA"}, 2)
	if err != nil {
		t.Fatal(err)
	}
	if first[0].PriceCents != 9_989 || first[1].PriceCents != 9_978 {
		t.Fatalf("ALFA prices should evolve within a batch: %+v", first)
	}

	beta := generator.Next("BETA")
	if beta.PriceCents != 9_989 {
		t.Fatalf("BETA should start independently, got %d", beta.PriceCents)
	}

	second, err := generator.Batch([]string{"ALFA"}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if second[0].PriceCents != 9_967 {
		t.Fatalf("ALFA should retain its last price between calls, got %d", second[0].PriceCents)
	}
}

func TestTradeExecutesAtBothSidesOfTheQuote(t *testing.T) {
	bidTrade := New(edgeRandom{}).Next("ALFA")
	if bidTrade.PriceCents != bidTrade.BidCents || bidTrade.Quantity != 1 {
		t.Fatalf("lowest random values should select the bid and a positive quantity: %+v", bidTrade)
	}
	if bidTrade.BidQuantity != 0 || bidTrade.AskQuantity != 0 {
		t.Fatalf("empty books must be possible: %+v", bidTrade)
	}

	askTrade := New(edgeRandom{upper: true}).Next("ALFA")
	if askTrade.PriceCents != askTrade.AskCents || askTrade.Quantity != 100 {
		t.Fatalf("highest random values should select the ask: %+v", askTrade)
	}
	assertValidTrade(t, bidTrade)
	assertValidTrade(t, askTrade)
}

func TestPricesStayPositiveAtTheLowerBoundary(t *testing.T) {
	generator := New(edgeRandom{})
	var latest Trade

	for i := 0; i < 2_000; i++ {
		latest = generator.Next("ALFA")
		assertValidTrade(t, latest)
	}

	if latest.PriceCents != 1 {
		t.Fatalf("expected to exercise the one-cent price floor, got %d", latest.PriceCents)
	}
}

func TestBatchRejectsInvalidArguments(t *testing.T) {
	cases := []struct {
		name    string
		symbols []string
		size    int
	}{
		{name: "no_symbols", symbols: nil, size: 1},
		{name: "empty_symbols", symbols: []string{}, size: 1},
		{name: "empty_symbol", symbols: []string{"ALFA", ""}, size: 1},
		{name: "zero_size", symbols: []string{"ALFA"}, size: 0},
		{name: "negative_size", symbols: []string{"ALFA"}, size: -1},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			trades, err := New(edgeRandom{}).Batch(test.symbols, test.size)

			if err == nil || trades != nil {
				t.Fatalf("expected an error and no trades, got %v, %v", trades, err)
			}
		})
	}
}

func assertValidTrade(t *testing.T, trade Trade) {
	t.Helper()

	if trade.PriceCents <= 0 || trade.BidCents <= 0 || trade.AskCents <= trade.BidCents {
		t.Fatalf("prices must stay positive with bid below ask: %+v", trade)
	}
	if trade.PriceCents != trade.BidCents && trade.PriceCents != trade.AskCents {
		t.Fatalf("trade must execute at the bid or ask: %+v", trade)
	}
	if trade.Quantity <= 0 {
		t.Fatalf("trade quantity must be positive: %+v", trade)
	}
	if trade.BidQuantity < 0 || trade.AskQuantity < 0 {
		t.Fatalf("book quantities must be nonnegative: %+v", trade)
	}
}
