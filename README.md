# DMA Trading Cockpit — MVP 1

Beslutsstöd för kortsiktig handel (daytrading). Byggd enligt kravspecifikation v2.

## 🚀 Snabbstart (GitHub Pages)

1. Skapa ett nytt GitHub-repository
2. Ladda upp de tre filerna: `index.html`, `style.css`, `app.js`
3. Gå till **Settings → Pages → Source: main branch / root**
4. Din app är live på `https://<användarnamn>.github.io/<repo>/`

## 📋 MVP 1 — Implementerade funktioner

### Dashboard
- Live-tickerrad med 6 instrument
- KPI-widgets: P&L, signaler, positioner, trades, drawdown
- Candlestick-diagram med EMA9/EMA21 (rendererat direkt på Canvas)
- Tekniska indikatorer: RSI, MACD, VWAP, ATR, Bollinger Bands
- Toppignaler (sidopanel)
- Positionstabell med live P&L
- Nyhetsflöde

### Signalvy
- Signalkort med Score 0–100 (40% trend, 20% volym, 20% sentiment, 20% risk)
- Confidence score
- Prisnivåer: trigger, stop-loss, mål 1 & 2
- Risk/Reward-förhållande
- Förklaring: "Varför genererades signalen?"
- Alternativa scenarier
- Filtrering på riktning, score, risknivå

### Signaldetalj (modal)
- Alla prisnivåer
- Tekniska indikatorer
- Datakällor + tidsstämpel
- Öppna paper trade direkt

### Instrumentvy
- Tabell med alla instrument
- RSI, MACD-riktning, score, aktuell signal
- Sök + sektorfilter

### Riskvy
- Visuell riskbudget-gauge
- Risk-parametrar: max risk/trade, daglig förlust, antal trades, exponering
- Sektorexponering (paj-diagram)
- VaR 95%/99%, Expected Shortfall, Sharpe, Beta
- Risklogg

### Backtestvy
- EMA9/EMA21 crossover-strategi
- Konfigurerbart: courtage, slippage, kapital, datum
- Equity-kurva (Canvas)
- Trade-historik, totalavkastning, win rate, Sharpe, max drawdown

### Nyhetsvy
- 30 simulerade nyhetsartiklar
- NLP-sentiment: positiv / neutral / negativ
- Filter på källa (Di, Reuters, Bloomberg, Twitter, Reddit)
- Fritextsökning

### Övrigt
- Paper trading (öppna/stäng positioner)
- Mörkt/ljust tema
- Responsiv layout
- Realtidsuppdatering var 2:a sekund

## 🗺 Vägkarta

| Version | Innehåll |
|---------|----------|
| MVP 0 ✅ | Dashboard skeleton, simulerad data |
| MVP 1 ✅ | Signalmotor, backtest, paper trading |
| MVP 2 | Broker API-integration (Avanza/Nordnet/IBKR) |
| MVP 3 | Live DMA-orderhantering, FIX-protokoll |
| MVP 4 | AI/ML-signalklassificering, anomaly detection |

## ⚠️ Viktigt

All data i denna version är **simulerad**. Appen är ett beslutsstödssystem
och ska inte användas för live-handel utan broker-integration och riskgodkännande.
Se kravdokument för compliance-krav (MAR/MiFID II).

## 🏗 Teknisk stack

- Ren HTML5 / CSS3 / Vanilla JavaScript
- Inga externa beroenden (ingen React, ingen d3, inget npm)
- Canvas-baserade diagram (inget Chart.js)
- 100% statisk — fungerar direkt på GitHub Pages

## 📁 Filstruktur

```
dma-trading/
├── index.html    — Komplett HTML-struktur, alla vyer
├── style.css     — Mörkt terminal-tema, responsiv layout
├── app.js        — Datamodell, indikatorer, signalmotor, UI-logik
└── README.md     — Denna fil
```
