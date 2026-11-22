//go:build js && wasm

package main

import (
	"math/rand/v2"
	"syscall/js"

	"realtime-fintech-dashboard/internal/market"
)

func main() {
	generator := market.New(rand.New(rand.NewPCG(rand.Uint64(), rand.Uint64())))
	nextBatch := js.FuncOf(func(_ js.Value, args []js.Value) any {
		if len(args) != 2 || !js.Global().Get("Array").Call("isArray", args[0]).Bool() || args[1].Type() != js.TypeNumber {
			return map[string]any{"error": "A symbol array and whole-number batch size are required."}
		}
		size := args[1].Int()
		if float64(size) != args[1].Float() || size < 1 {
			return map[string]any{"error": "Batch size must be a positive whole number."}
		}
		symbols := make([]string, args[0].Length())
		for i := range symbols {
			value := args[0].Index(i)
			if value.Type() != js.TypeString {
				return map[string]any{"error": "Each symbol must be a string."}
			}
			symbols[i] = value.String()
		}
		trades, err := generator.Batch(symbols, size)
		if err != nil {
			return map[string]any{"error": err.Error()}
		}
		batch := make([]any, len(trades))
		for i, trade := range trades {
			batch[i] = map[string]any{
				"symbol":      trade.Symbol,
				"priceCents":  trade.PriceCents,
				"quantity":    trade.Quantity,
				"bidCents":    trade.BidCents,
				"askCents":    trade.AskCents,
				"bidQuantity": trade.BidQuantity,
				"askQuantity": trade.AskQuantity,
			}
		}
		return batch
	})
	defer nextBatch.Release()
	js.Global().Set("marketNextBatch", nextBatch)
	js.Global().Call("marketReady")
	select {}
}
