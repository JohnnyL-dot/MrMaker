# DMA Trading Cockpit — Changelog

---

## v1.2.0 — 2026-05-14

### Ingående filer
| Fil | Version | Beskrivning |
|-----|---------|-------------|
| `index.html` (bundle) | 1.2.0 | Komplett single-file bundle (HTML + CSS + JS inbakat) |

> Från och med v1.2.0 distribueras appen som en enda self-contained HTML-fil.
> Separata `style.css` och `app.js` används ej längre.

### Nyheter
- **₿ Krypto-flik** — Live-kurser för 10 kryptovalutor (BTC, ETH, SOL, XRP, ADA, AVAX, LINK, DOT, DOGE, UNI) i SEK via CoinGecko gratis-API
  - Tabell med rank, logotyp, kurs, 24h-förändring, hög/låg, market cap, volym, ATH och avstånd från ATH
  - Klickbar OHLC-candlestick-graf per mynt (1d / 7d / 30d)
  - Marknadsöversikt: BTC/ETH-dominans, antal vinnare/förlorare, total volym
  - Auto-uppdatering var 60:e sekund (anpassat till CoinGecko free tier: 30 req/min)
- **Versionsnummer i logotypen** — "DMAcockpit v1.2.0" visas i toppraden
- **VERSION-objekt i JS** — `VERSION.app`, `.html`, `.js`, `.css`, `.date`

---

## v1.1.0 — 2026-05-14

### Ingående filer
| Fil | Version | Beskrivning |
|-----|---------|-------------|
| `index.html` (bundle) | 1.1.0 | Single-file bundle med Shadow Trading |

### Nyheter
- **⬡ Shadow Trading-flik** — Komplett fiktiv handelsmotor
  - Orderformulär med KÖP/SÄLJ-toggle, antal, pris, stop-loss och target
  - Livekurs och automatisk ATR-baserad stop/target-förfyllning
  - Ordervärdesvalidering mot tillgängligt fiktivt kapital (100 000 kr start)
  - Öppna positioner med live P&L i kr och % — Stäng-knapp per position
  - Positionslinjer (entry, stop, target) ritade direkt i instrumentgrafen
  - Handelshistorik med alla avslutade affärer + R/R
  - Portfolio-equity-kurva
  - CSV-export av handelshistorik
  - Toast-notifieringar vid köp/sälj/stäng
  - Återställ-knapp för att nollställa hela shadow-portföljen
- **Yahoo Finance live-data** — Riktiga kurser för alla 12 svenska aktier (15 min fördröjning)
  - Batch-hämtning av quotes var 15:e sekund
  - Intradag OHLCV-bars (5m) per instrument
  - Live/fallback-statusindikator i toppraden
  - Grön prick `●` i topptickers vid live-data
  - Automatisk fallback till simulerad data vid API-fel

---

## v1.0.0 — MVP 1 (initial release)

### Ingående filer
| Fil | Version | Beskrivning |
|-----|---------|-------------|
| `index.html` | 1.0.0 | HTML-struktur, alla vyer |
| `style.css`  | 1.0.0 | Mörkt terminal-tema, responsiv layout |
| `app.js`     | 1.0.0 | Datamodell, indikatorer, signalmotor, UI-logik |

### Funktioner
- Dashboard med live-tickerrad, KPI-widgets, candlestick-diagram (Canvas), EMA9/21, RSI/MACD/VWAP/ATR/BB
- Signalvy med score 0–100 (trend 40%, volym 20%, sentiment 20%, risk 20%), filtrering och modal
- Instrumentvy med sök, sektorfilter, RSI, MACD-riktning, score
- Riskvy med gauge, riskparametrar, sektorpaj, VaR 95%/99%, risklogg
- Backtestvy — EMA crossover-strategi, equity-kurva, trade-historik
- Nyhetsvy — simulerade nyheter med NLP-sentiment, käll- och fritextsökning
- Paper trading — öppna/stäng fiktiva positioner från signalmodalen
- Mörkt/ljust tema, responsiv layout, realtidsuppdatering var 2:a sekund
- All data simulerad (ingen live-källa i denna version)

---

*Versionsnumrering följer Semantic Versioning: MAJOR.MINOR.PATCH*
*MAJOR = bryta bakåtkompatibilitet | MINOR = ny funktion | PATCH = buggfix*
