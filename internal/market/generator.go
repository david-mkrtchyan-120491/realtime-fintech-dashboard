package market

import "errors"

type Trade struct {
	Symbol      string
	PriceCents  int
	Quantity    int
	BidCents    int
	AskCents    int
	BidQuantity int
	AskQuantity int
}

type Random interface {
	IntN(n int) int
}

type Generator struct {
	random        Random
	previousPrice map[string]int
}

func New(random Random) *Generator {
	return &Generator{random: random, previousPrice: make(map[string]int)}
}

func (g *Generator) Batch(symbols []string, size int) ([]Trade, error) {
	if len(symbols) == 0 || size < 1 {
		return nil, errors.New("a batch needs symbols and a positive size")
	}
	for _, symbol := range symbols {
		if symbol == "" {
			return nil, errors.New("symbols must not be empty")
		}
	}
	trades := make([]Trade, size)
	for i := range trades {
		trades[i] = g.Next(symbols[g.random.IntN(len(symbols))])
	}
	return trades, nil
}

func (g *Generator) Next(symbol string) Trade {
	previous, exists := g.previousPrice[symbol]
	if !exists {
		previous = 10_000
	}

	reference := max(2, previous+g.random.IntN(21)-10)
	bid := reference - 1
	ask := reference + 1 + g.random.IntN(5)
	price := bid
	if g.random.IntN(2) == 1 {
		price = ask
	}

	trade := Trade{
		Symbol:      symbol,
		PriceCents:  price,
		Quantity:    1 + g.random.IntN(100),
		BidCents:    bid,
		AskCents:    ask,
		BidQuantity: g.random.IntN(1_001),
		AskQuantity: g.random.IntN(1_001),
	}
	g.previousPrice[symbol] = price
	return trade
}
