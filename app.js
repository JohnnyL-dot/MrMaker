// =============================================
//  DMA TRADING COCKPIT — app.js
//  MVP 1: Simulated data, technical analysis,
//  signal scoring, paper trading UI
// =============================================

'use strict';

// ─── CONFIG ───────────────────────────────────
const CONFIG = {
  updateInterval: 2000,       // ms between price updates
  maxRiskPerTrade: 2,         // %
  maxDailyLoss: 5,            // %
  maxTradesPerDay: 20,
  maxExposurePct: 80,         // %
  initialCapital: 100000,
};

// ─── STATE ────────────────────────────────────
const STATE = {
  capital: CONFIG.initialCapital,
  positions: [],
  trades: [],
  dailyPnl: 0,
  riskLog: [],
  tickCount: 0,
  signals: [],
  news: [],
  currentTheme: 'dark',
  priceHistory: {},         // sym -> []
  activeTimeframe: '5m',
  chartInstrument: null,
  priceChartObj: null,
  equityChartObj: null,
  sectorChartObj: null,
};

// ─── INSTRUMENTS ──────────────────────────────
const INSTRUMENTS = [
  { sym:'ERIC B', name:'Ericsson B',    sector:'Tech',       price:69.5,   vol:0.018 },
  { sym:'VOLV B', name:'Volvo B',       sector:'Industri',   price:245.0,  vol:0.014 },
  { sym:'SSAB A', name:'SSAB A',        sector:'Industri',   price:52.3,   vol:0.022 },
  { sym:'SEB A',  name:'SEB A',         sector:'Finans',     price:183.4,  vol:0.012 },
  { sym:'SHB A',  name:'Handelsbanken', sector:'Finans',     price:108.9,  vol:0.011 },
  { sym:'AZN',    name:'AstraZeneca',   sector:'Hälsovård',  price:1342.0, vol:0.009 },
  { sym:'SAND',   name:'Sandvik',       sector:'Industri',   price:195.6,  vol:0.016 },
  { sym:'ALFA',   name:'Alfa Laval',    sector:'Industri',   price:415.2,  vol:0.015 },
  { sym:'SWED A', name:'Swedbank A',    sector:'Finans',     price:213.7,  vol:0.013 },
  { sym:'NIBE B', name:'NIBE Industrier',sector:'Energi',    price:45.1,   vol:0.025 },
  { sym:'LUNE',   name:'Lundin Energy', sector:'Energi',     price:312.0,  vol:0.020 },
  { sym:'ATCO A', name:'Atlas Copco',   sector:'Industri',   price:132.8,  vol:0.015 },
];

// ─── HELPER UTILITIES ─────────────────────────

const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const fmt = (n, d=2) => n.toFixed(d);
const fmtKr = n => (n >= 0 ? '+' : '') + n.toLocaleString('sv-SE', {maximumFractionDigits:0}) + ' kr';
const fmtPct = n => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const scoreColor = s => s >= 70 ? 'score-high' : s >= 45 ? 'score-mid' : 'score-low';
const scoreBarColor = s => s >= 70 ? '#00e676' : s >= 45 ? '#ffd740' : '#ff3d5a';
const pillClass = s => s >= 70 ? 'high' : s >= 45 ? 'mid' : 'low';
const riskClass = r => r === 'låg' ? 'risk-low' : r === 'medel' ? 'risk-med' : 'risk-high';
const now = () => new Date().toLocaleTimeString('sv-SE');

// ─── PRICE SIMULATION ─────────────────────────

function initPriceHistory() {
  INSTRUMENTS.forEach(inst => {
    const history = [];
    let p = inst.price * rand(0.95, 1.05);
    for (let i = 200; i >= 0; i--) {
      p = p * (1 + rand(-inst.vol, inst.vol));
      const open = p;
      const high = p * (1 + rand(0, inst.vol * 0.5));
      const low  = p * (1 - rand(0, inst.vol * 0.5));
      const close = p * (1 + rand(-inst.vol * 0.3, inst.vol * 0.3));
      const volume = randInt(100000, 2000000);
      history.push({ open, high, low, close, volume, ts: Date.now() - i * 60000 });
    }
    STATE.priceHistory[inst.sym] = history;
    inst.price = history[history.length - 1].close;
    inst.prevClose = history[history.length - 2].close;
  });
}

function tickPrices() {
  INSTRUMENTS.forEach(inst => {
    const hist = STATE.priceHistory[inst.sym];
    const last = hist[hist.length - 1];
    const change = rand(-inst.vol, inst.vol);
    const newPrice = last.close * (1 + change);
    inst.price = newPrice;
    // Update last bar or add new bar
    if (STATE.tickCount % 10 === 0) {
      hist.push({
        open: last.close,
        high: Math.max(last.close, newPrice) * (1 + rand(0, 0.002)),
        low:  Math.min(last.close, newPrice) * (1 - rand(0, 0.002)),
        close: newPrice,
        volume: randInt(50000, 500000),
        ts: Date.now()
      });
      if (hist.length > 300) hist.shift();
    } else {
      last.close = newPrice;
      last.high = Math.max(last.high, newPrice);
      last.low  = Math.min(last.low, newPrice);
    }
  });
  STATE.tickCount++;
}

// ─── TECHNICAL INDICATORS ─────────────────────

function calcEMA(closes, period) {
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcSMA(closes, period) {
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  const rs = gains / (losses || 0.001);
  return 100 - 100 / (1 + rs);
}

function calcMACD(closes) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd  = ema12 - ema26;
  const signal = calcEMA(closes.slice(-9).map(() => macd), 9);
  return { macd, signal, hist: macd - signal };
}

function calcVWAP(bars) {
  let tvp = 0, tvol = 0;
  bars.forEach(b => {
    const typical = (b.high + b.low + b.close) / 3;
    tvp  += typical * b.volume;
    tvol += b.volume;
  });
  return tvol > 0 ? tvp / tvol : 0;
}

function calcATR(bars, period = 14) {
  const trs = [];
  for (let i = 1; i < bars.length; i++) {
    trs.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low  - bars[i - 1].close)
    ));
  }
  return calcSMA(trs, Math.min(period, trs.length));
}

function calcBollinger(closes, period = 20) {
  const sma = calcSMA(closes, period);
  const slice = closes.slice(-period);
  const std = Math.sqrt(slice.reduce((s, c) => s + (c - sma) ** 2, 0) / period);
  return { upper: sma + 2 * std, mid: sma, lower: sma - 2 * std };
}

function getIndicators(sym) {
  const bars = STATE.priceHistory[sym] || [];
  const closes = bars.map(b => b.close);
  if (closes.length < 30) return null;
  return {
    rsi:  calcRSI(closes),
    macd: calcMACD(closes),
    vwap: calcVWAP(bars.slice(-50)),
    atr:  calcATR(bars),
    bb:   calcBollinger(closes),
    ema9: calcEMA(closes, 9),
    ema21:calcEMA(closes, 21),
    sma50:calcSMA(closes, Math.min(50, closes.length)),
    price:closes[closes.length - 1],
  };
}

// ─── SIGNAL ENGINE ────────────────────────────

const SIGNAL_REASONS = {
  buyReasons: [
    'RSI oversold rebound (RSI < 30), momentum turning bullish',
    'MACD bullish crossover above zero line',
    'EMA9 crossed above EMA21 – bullish trend confirmation',
    'Pris bryter ut ovanför Bollinger Upper Band med hög volym',
    'VWAP reclaim – pris stängde ovan VWAP efter dipp',
    'Breakout ur konsolidering – 3 konsekutiva stigande highs',
    'Momentum acceleration + volym spike > 200% av 20d MA',
    'Stödnivå bekräftad med hammer-mönster på 5m',
    'Mean reversion signal – pris 2σ under 20-SMA',
  ],
  sellReasons: [
    'RSI overbought (RSI > 70) med divergens mot price',
    'MACD bearish crossover – histogram negativt',
    'EMA9 korsade under EMA21 – bearish trendbyte',
    'Pris avvisades vid Bollinger Upper Band med sänkt volym',
    'VWAP rejection – pris stängde under VWAP vid första test',
    'Breakdown under stöd med ökad volym',
    'Evening star candlestick vid motståndsnivå',
    'ATR expanderar kraftigt – ökad volatilitet, risk för reversal',
    'Korrelerad sektor säljs av – risk för smittoeffekt',
  ],
};

const ALT_SCENARIOS = [
  'Alternativ: Pris studsar upp vid stöd och bilda ny ackumulation',
  'Alternativ: Starkare utbrott möjligt om volymen ökar',
  'Alternativ: Konsolidering i 15–30 min innan riktning avgörs',
  'Alternativ: Breakout misslyckas och pris returnerar till VWAP',
  'Alternativ: Marknadsnyheter kan bryta teknisk signal',
];

function generateSignals() {
  const signals = [];
  INSTRUMENTS.forEach(inst => {
    const ind = getIndicators(inst.sym);
    if (!ind) return;

    const { rsi, macd, vwap, atr, bb, ema9, ema21, price } = ind;

    // Score components (0-100 each)
    let trendScore, volScore, sentScore, riskScore;

    // Direction
    const bullishSignals = [
      rsi < 35, macd.hist > 0, ema9 > ema21, price > vwap, price < bb.mid
    ].filter(Boolean).length;

    const bearishSignals = [
      rsi > 65, macd.hist < 0, ema9 < ema21, price < vwap, price > bb.upper
    ].filter(Boolean).length;

    if (bullishSignals < 2 && bearishSignals < 2) return; // No clear signal

    const dir = bullishSignals >= bearishSignals ? 'BUY' : 'SELL';

    // Trend score (40%)
    trendScore = dir === 'BUY'
      ? Math.min(100, bullishSignals * 20 + rand(0, 20))
      : Math.min(100, bearishSignals * 20 + rand(0, 20));

    // Volume/orderflow score (20%)
    volScore = rand(40, 90);

    // Sentiment score (20%)
    sentScore = rand(30, 85);

    // Risk score — lower volatility = higher score (20%)
    const atrPct = (atr / price) * 100;
    riskScore = Math.max(10, 100 - atrPct * 20);

    const score = Math.round(
      trendScore * 0.4 + volScore * 0.2 + sentScore * 0.2 + riskScore * 0.2
    );

    const confidence = Math.round(rand(score * 0.6, Math.min(100, score * 1.2)));

    const risknivå = atrPct < 1.5 ? 'låg' : atrPct < 2.5 ? 'medel' : 'hög';

    // Price levels
    const slMult   = dir === 'BUY' ? -1 : 1;
    const tgtMult  = dir === 'BUY' ?  1 : -1;
    const trigger  = price * (1 + rand(0, 0.003) * tgtMult);
    const stopDist = atr * rand(1.2, 2.0);
    const stop     = trigger * (1 + slMult * (stopDist / trigger));
    const target1  = trigger * (1 + tgtMult * stopDist * rand(1.5, 2.5) / trigger);
    const target2  = trigger * (1 + tgtMult * stopDist * rand(3, 4.5) / trigger);
    const rr1 = Math.abs((target1 - trigger) / (trigger - stop));

    const reasonList = dir === 'BUY' ? SIGNAL_REASONS.buyReasons : SIGNAL_REASONS.sellReasons;

    signals.push({
      id: `${inst.sym}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      sym: inst.sym,
      name: inst.name,
      sector: inst.sector,
      dir,
      score,
      confidence,
      risknivå,
      trigger: +trigger.toFixed(2),
      stop:    +stop.toFixed(2),
      target1: +target1.toFixed(2),
      target2: +target2.toFixed(2),
      rr: +rr1.toFixed(2),
      price: +price.toFixed(2),
      reason: pick(reasonList),
      altScenario: pick(ALT_SCENARIOS),
      dataSources: ['Teknisk analys', pick(['RSI+MACD', 'Breakout', 'VWAP', 'Bollinger']), pick(['Reuters', 'Di', 'Twitter'])],
      timestamp: new Date().toLocaleTimeString('sv-SE'),
      indicators: {
        rsi: +rsi.toFixed(1),
        macd: +macd.hist.toFixed(3),
        vwap: +vwap.toFixed(2),
        atr: +atr.toFixed(2),
        ema9: +ema9.toFixed(2),
        ema21: +ema21.toFixed(2),
      }
    });
  });

  // Sort by score
  signals.sort((a, b) => b.score - a.score);
  STATE.signals = signals.slice(0, 20);
}

// ─── NEWS DATA ────────────────────────────────

const NEWS_TEMPLATES = [
  { src:'Di',       sent:'positiv',  tpl:'[SYM]: Stark kvartalsrapport – omsättning överstiger analytikernas förväntningar' },
  { src:'Reuters',  sent:'negativ',  tpl:'[SYM] sänker prognos – kostar effektiviseringar mer än väntat' },
  { src:'Bloomberg',sent:'positiv',  tpl:'[SYM] uppgraderas av Carnegie till Köp – riktkurs höjs till [PRICE]' },
  { src:'Di',       sent:'neutral',  tpl:'[SYM]: VD kommenterar makroläget – "vi ser ökad osäkerhet"' },
  { src:'Twitter',  sent:'positiv',  tpl:'$[SYM] trending på Twitter/X – positiv buzz kring ny produktlansering' },
  { src:'Reuters',  sent:'neutral',  tpl:'Riksbanken håller räntan oförändrad – påverkar sektorn [SECTOR]' },
  { src:'Bloomberg',sent:'negativ',  tpl:'[SYM]: Insiderförsäljning på [PRICE] – signal om topformation?' },
  { src:'Di',       sent:'positiv',  tpl:'[SYM] vinner stororder värd [PRICE]M kr – aktien stiger i förhandeln' },
  { src:'Reddit',   sent:'positiv',  tpl:'r/aktier: Bullish case för [SYM] – teknisk analys pekar på breakout' },
  { src:'Reuters',  sent:'negativ',  tpl:'Sektorn [SECTOR] pressas av stigande råmaterialkostnader' },
  { src:'Bloomberg',sent:'neutral',  tpl:'[SYM] ex-utdelning imorgon – teknisk nedpressning av [PRICE] kr väntas' },
  { src:'Di',       sent:'positiv',  tpl:'Analys: [SYM] undervärderad relativt peers – potential +30%' },
];

function generateNews() {
  STATE.news = [];
  for (let i = 0; i < 30; i++) {
    const tmpl = pick(NEWS_TEMPLATES);
    const inst = pick(INSTRUMENTS);
    const price = (inst.price * rand(0.9, 1.1)).toFixed(0);
    const headline = tmpl.tpl
      .replace(/\[SYM\]/g, inst.sym)
      .replace(/\[PRICE\]/g, price)
      .replace(/\[SECTOR\]/g, inst.sector);

    const body = [
      `Aktien handlas nu kring ${inst.price.toFixed(2)} kr med volym på ${randInt(200,800)}k aktier.`,
      `Teknisk analys indikerar ${rand(0,1) > 0.5 ? 'stöd' : 'motstånd'} vid ${(inst.price * rand(0.97,1.03)).toFixed(2)} kr.`,
      `Analytiker följer situationen noga inför morgondagens öppning.`
    ].join(' ');

    STATE.news.push({
      id: i,
      headline,
      body,
      src: tmpl.src,
      sent: tmpl.sent,
      sym: inst.sym,
      ts: new Date(Date.now() - i * randInt(1, 20) * 60000).toLocaleTimeString('sv-SE'),
    });
  }
}

// ─── CANVAS CHART (No library) ────────────────

function drawPriceChart() {
  const canvas = document.getElementById('priceChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;

  const sym = STATE.chartInstrument || INSTRUMENTS[0].sym;
  const bars = STATE.priceHistory[sym] || [];
  const n = Math.min(80, bars.length);
  const slice = bars.slice(-n);

  const prices = slice.flatMap(b => [b.high, b.low]);
  const minP = Math.min(...prices) * 0.998;
  const maxP = Math.max(...prices) * 1.002;
  const range = maxP - minP;

  const PAD = { top: 12, right: 14, bottom: 28, left: 64 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top  - PAD.bottom;
  const barW = Math.max(2, (cW / n) * 0.7);

  const isDark = document.body.classList.contains('dark');
  const gridCol   = isDark ? '#1e2535' : '#d0daea';
  const textCol   = isDark ? '#7a8fb5' : '#4a5a7a';
  const upCol     = '#00e676';
  const downCol   = '#ff3d5a';
  const accentCol = '#00d4ff';

  // Background
  ctx.fillStyle = isDark ? '#111620' : '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Y grid lines
  ctx.strokeStyle = gridCol;
  ctx.lineWidth = 0.5;
  const gridSteps = 5;
  for (let i = 0; i <= gridSteps; i++) {
    const y = PAD.top + (cH / gridSteps) * i;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    const price = maxP - (range / gridSteps) * i;
    ctx.fillStyle = textCol;
    ctx.font = `9px 'Share Tech Mono', monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(price.toFixed(2), PAD.left - 4, y + 3);
  }

  // EMA lines
  const closes = slice.map(b => b.close);
  ctx.lineWidth = 1;

  const drawEmaLine = (period, color) => {
    if (closes.length < period) return;
    ctx.strokeStyle = color;
    ctx.beginPath();
    let ema = closes[0];
    const k = 2 / (period + 1);
    slice.forEach((b, i) => {
      ema = closes[i] * k + ema * (1 - k);
      const x = PAD.left + (i / (n - 1)) * cW;
      const y = PAD.top + cH - ((ema - minP) / range) * cH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  drawEmaLine(9,  'rgba(0,212,255,0.6)');
  drawEmaLine(21, 'rgba(255,215,64,0.5)');

  // Candlesticks
  slice.forEach((bar, i) => {
    const x    = PAD.left + (i / (n - 1)) * cW;
    const yH   = PAD.top + cH - ((bar.high  - minP) / range) * cH;
    const yL   = PAD.top + cH - ((bar.low   - minP) / range) * cH;
    const yO   = PAD.top + cH - ((bar.open  - minP) / range) * cH;
    const yC   = PAD.top + cH - ((bar.close - minP) / range) * cH;
    const bull = bar.close >= bar.open;
    const col  = bull ? upCol : downCol;

    // Wick
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, yH); ctx.lineTo(x, yL);
    ctx.stroke();

    // Body
    ctx.fillStyle = bull ? col : col;
    ctx.globalAlpha = bull ? 0.85 : 0.95;
    const bodyH = Math.max(1, Math.abs(yO - yC));
    ctx.fillRect(x - barW / 2, Math.min(yO, yC), barW, bodyH);
    ctx.globalAlpha = 1;
  });

  // Current price line
  const lastPrice = slice[slice.length - 1]?.close;
  if (lastPrice) {
    const yLast = PAD.top + cH - ((lastPrice - minP) / range) * cH;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = accentCol;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, yLast); ctx.lineTo(W - PAD.right, yLast);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = accentCol;
    ctx.fillRect(W - PAD.right, yLast - 8, PAD.right + 2, 16);
    ctx.fillStyle = isDark ? '#0a0d12' : '#fff';
    ctx.font = `bold 9px 'Share Tech Mono', monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(lastPrice.toFixed(2), W - 2, yLast + 3);
  }

  // X labels
  ctx.fillStyle = textCol;
  ctx.font = `9px 'Share Tech Mono', monospace`;
  ctx.textAlign = 'center';
  [0, Math.floor(n / 2), n - 1].forEach(i => {
    const b = slice[i];
    if (!b) return;
    const x = PAD.left + (i / (n - 1)) * cW;
    const t = new Date(b.ts).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    ctx.fillText(t, x, H - PAD.bottom + 12);
  });
}

function drawGauge(canvas, pct) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 160;
  const H = W * 0.6;
  canvas.width = W * 2; canvas.height = H * 2;
  ctx.scale(2, 2);
  const cx = W / 2, cy = H - 10;
  const r = Math.min(W, H) * 0.85;

  const isDark = document.body.classList.contains('dark');
  ctx.clearRect(0, 0, W, H);

  // Track
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0, false);
  ctx.strokeStyle = isDark ? '#1e2535' : '#d0daea';
  ctx.lineWidth = 14;
  ctx.stroke();

  // Fill
  const colorStops = [
    [0,    '#00e676'],
    [0.5,  '#ffd740'],
    [1.0,  '#ff3d5a'],
  ];
  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  colorStops.forEach(([s, c]) => grad.addColorStop(s, c));
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * pct, false);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawSectorChart() {
  const canvas = document.getElementById('sectorChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 240;
  const H = 200;
  canvas.width = W * 2; canvas.height = H * 2;
  ctx.scale(2, 2);

  // Calculate sector exposure
  const sectors = {};
  INSTRUMENTS.forEach(i => {
    if (!sectors[i.sector]) sectors[i.sector] = 0;
    sectors[i.sector] += 1;
  });

  const entries = Object.entries(sectors);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const colors = ['#00d4ff','#00e676','#ffd740','#ff9800','#b39ddb','#ff3d5a'];
  const cx = W / 2, cy = H / 2 - 10, r = Math.min(cx, cy) * 0.7;

  let angle = -Math.PI / 2;
  entries.forEach(([sector, count], i) => {
    const slice = (count / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = document.body.classList.contains('dark') ? '#111620' : '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    const midAngle = angle + slice / 2;
    const lx = cx + Math.cos(midAngle) * r * 0.65;
    const ly = cy + Math.sin(midAngle) * r * 0.65;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Barlow, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sector, lx, ly);
    angle += slice;
  });

  // Legend
  let lx = 4;
  entries.forEach(([sector, count], i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(lx, H - 14, 8, 8);
    ctx.fillStyle = document.body.classList.contains('dark') ? '#7a8fb5' : '#4a5a7a';
    ctx.font = '8px Barlow, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${sector} ${Math.round((count/total)*100)}%`, lx + 10, H - 7);
    lx += ctx.measureText(`${sector} ${Math.round((count/total)*100)}%`).width + 20;
  });
}

// ─── RENDER FUNCTIONS ─────────────────────────

function renderTopbarTickers() {
  const el = document.getElementById('topbarTickers');
  el.innerHTML = INSTRUMENTS.slice(0, 6).map(inst => {
    const chg = ((inst.price - inst.prevClose) / inst.prevClose * 100);
    const cls = chg >= 0 ? 'up' : 'down';
    return `<div class="ticker-item">
      <span class="sym">${inst.sym}</span>
      <span class="price">${inst.price.toFixed(2)}</span>
      <span class="chg ${cls}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span>
    </div>`;
  }).join('');
}

function renderKPIs() {
  // Simulate some P&L
  const pnl = STATE.dailyPnl + rand(-500, 1500) * 0.01;
  STATE.dailyPnl = pnl;

  const pnlEl = document.getElementById('kpiPnl');
  pnlEl.textContent = fmtKr(pnl);
  pnlEl.className = 'kpi-value ' + (pnl >= 0 ? 'green' : 'red');

  document.getElementById('kpiPnlPct').textContent = fmtPct(pnl / CONFIG.initialCapital * 100);
  document.getElementById('kpiSignals').textContent = STATE.signals.length;
  document.getElementById('kpiPositions').textContent = STATE.positions.length;
  document.getElementById('kpiExposure').textContent = `Exponering: ${fmtKr(STATE.positions.reduce((s, p) => s + p.value, 0))}`;
  document.getElementById('kpiTrades').textContent = STATE.trades.length;

  const winRate = STATE.trades.length
    ? Math.round(STATE.trades.filter(t => t.pnl > 0).length / STATE.trades.length * 100) + '%'
    : '—';
  document.getElementById('kpiWinRate').textContent = `Win rate: ${winRate}`;

  const dd = Math.max(0, -pnl / CONFIG.initialCapital * 100);
  const ddEl = document.getElementById('kpiDrawdown');
  ddEl.textContent = dd.toFixed(2) + '%';
  ddEl.className = 'kpi-value ' + (dd > 2 ? 'red' : '');
}

function renderTopSignals() {
  const container = document.getElementById('topSignals');
  const count = document.getElementById('signalCount');
  const top = STATE.signals.slice(0, 8);
  count.textContent = STATE.signals.length;

  container.innerHTML = top.map(sig => `
    <div class="signal-item ${sig.dir === 'BUY' ? 'buy' : 'sell'}" data-id="${sig.id}">
      <div>
        <div class="signal-sym">${sig.sym}</div>
        <div class="signal-meta">${sig.trigger.toFixed(2)} · ${sig.timestamp}</div>
      </div>
      <span class="signal-dir ${sig.dir === 'BUY' ? 'buy' : 'sell'}">${sig.dir === 'BUY' ? 'KÖP' : 'SÄLJ'}</span>
      <span class="signal-score-mini ${scoreColor(sig.score)}">${sig.score}</span>
    </div>
  `).join('');

  container.querySelectorAll('.signal-item').forEach(el => {
    el.addEventListener('click', () => openSignalModal(el.dataset.id));
  });
}

function renderPositions() {
  const tbody = document.getElementById('positionsBody');
  if (!STATE.positions.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">Inga öppna positioner</td></tr>';
    return;
  }
  tbody.innerHTML = STATE.positions.map(pos => {
    const inst = INSTRUMENTS.find(i => i.sym === pos.sym);
    const current = inst ? inst.price : pos.entryPrice;
    const pnl = (current - pos.entryPrice) * pos.qty * (pos.dir === 'BUY' ? 1 : -1);
    const cls = pnl >= 0 ? 'up' : 'down';
    return `<tr>
      <td>${pos.sym}</td>
      <td><span class="signal-dir ${pos.dir === 'BUY' ? 'buy' : 'sell'}">${pos.dir === 'BUY' ? 'KÖP' : 'SÄLJ'}</span></td>
      <td>${pos.entryPrice.toFixed(2)}</td>
      <td>${current.toFixed(2)}</td>
      <td class="${cls}">${fmtKr(pnl)}</td>
      <td class="down">${pos.stop.toFixed(2)}</td>
      <td class="up">${pos.target.toFixed(2)}</td>
      <td>${pos.rr.toFixed(1)}</td>
      <td><button class="btn-primary" style="padding:3px 10px;font-size:10px" onclick="closePosition('${pos.id}')">Stäng</button></td>
    </tr>`;
  }).join('');
}

function renderNewsFeed() {
  const el = document.getElementById('newsFeed');
  el.innerHTML = STATE.news.slice(0, 10).map(n => `
    <div class="news-item">
      <div class="news-headline">${n.headline}</div>
      <div class="news-meta">
        <span class="news-src">${n.src}</span>
        <span class="news-time">${n.ts}</span>
        <span class="sentiment-badge ${n.sent}">${n.sent}</span>
      </div>
    </div>
  `).join('');
}

function renderChartIndicators() {
  const sym = STATE.chartInstrument || INSTRUMENTS[0].sym;
  const ind = getIndicators(sym);
  if (!ind) return;
  document.getElementById('chartRSI').textContent = `RSI: ${ind.rsi.toFixed(1)}`;
  document.getElementById('chartRSI').style.color = ind.rsi > 70 ? 'var(--red)' : ind.rsi < 30 ? 'var(--green)' : 'var(--text2)';
  document.getElementById('chartMACD').textContent = `MACD: ${ind.macd.macd.toFixed(2)} | Sig: ${ind.macd.signal.toFixed(2)}`;
  document.getElementById('chartVWAP').textContent = `VWAP: ${ind.vwap.toFixed(2)}`;
  document.getElementById('chartATR').textContent = `ATR: ${ind.atr.toFixed(2)}`;
  document.getElementById('chartBB').textContent = `BB: ${ind.bb.lower.toFixed(2)} – ${ind.bb.upper.toFixed(2)}`;
}

function renderSignalsPage() {
  const grid = document.getElementById('signalsGrid');
  const minScore = parseInt(document.getElementById('filterScore').value);
  const dir  = document.getElementById('filterDir').value;
  const risk = document.getElementById('filterRisk').value;

  let sigs = STATE.signals.filter(s => s.score >= minScore);
  if (dir !== 'all') sigs = sigs.filter(s => s.dir === dir);
  if (risk !== 'all') sigs = sigs.filter(s => s.risknivå === risk);

  grid.innerHTML = sigs.map(sig => `
    <div class="signal-card ${sig.dir === 'BUY' ? 'buy' : 'sell'}" data-id="${sig.id}">
      <div class="sc-header">
        <div>
          <div class="sc-sym">${sig.sym}</div>
          <div style="font-size:10px;color:var(--text3)">${sig.name}</div>
        </div>
        <span class="sc-dir ${sig.dir === 'BUY' ? 'buy' : 'sell'}">${sig.dir === 'BUY' ? 'KÖP' : 'SÄLJ'}</span>
      </div>
      <div class="sc-scores">
        <div class="sc-score-block">
          <div class="sc-score-label">Score</div>
          <div class="sc-score-val ${scoreColor(sig.score)}">${sig.score}</div>
          <div class="score-bar"><div class="score-bar-fill" style="width:${sig.score}%;background:${scoreBarColor(sig.score)}"></div></div>
        </div>
        <div class="sc-score-block">
          <div class="sc-score-label">Confidence</div>
          <div class="sc-score-val ${scoreColor(sig.confidence)}">${sig.confidence}</div>
          <div class="score-bar"><div class="score-bar-fill" style="width:${sig.confidence}%;background:${scoreBarColor(sig.confidence)}"></div></div>
        </div>
      </div>
      <div class="sc-levels">
        <div class="sc-level"><div class="lbl">Trigger</div><div class="val trigger">${sig.trigger}</div></div>
        <div class="sc-level"><div class="lbl">Stop</div><div class="val stop">${sig.stop}</div></div>
        <div class="sc-level"><div class="lbl">Mål 1</div><div class="val target">${sig.target1}</div></div>
      </div>
      <div class="sc-rr">
        <span style="color:var(--text3);font-size:10px">Risk/Reward</span>
        <span class="sc-rr-val">${sig.rr.toFixed(1)}:1</span>
        <span class="sc-risk-badge ${riskClass(sig.risknivå)}">${sig.risknivå}</span>
        <span style="font-size:10px;color:var(--text3)">${sig.timestamp}</span>
      </div>
      <div class="sc-why">💡 ${sig.reason}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.signal-card').forEach(el => {
    el.addEventListener('click', () => openSignalModal(el.dataset.id));
  });
}

function renderInstruments() {
  const search = document.getElementById('instSearch').value.toLowerCase();
  const sector = document.getElementById('instSector').value;
  const tbody = document.getElementById('instBody');

  const filtered = INSTRUMENTS.filter(inst => {
    const matchSearch = inst.sym.toLowerCase().includes(search) || inst.name.toLowerCase().includes(search);
    const matchSector = sector === 'all' || inst.sector === sector;
    return matchSearch && matchSector;
  });

  tbody.innerHTML = filtered.map(inst => {
    const ind = getIndicators(inst.sym);
    const chg = ((inst.price - inst.prevClose) / inst.prevClose * 100);
    const sig = STATE.signals.find(s => s.sym === inst.sym);
    const score = sig ? sig.score : Math.round(rand(30, 75));
    const rsi = ind ? ind.rsi.toFixed(1) : '—';
    const macdH = ind ? (ind.macd.hist > 0 ? '▲' : '▼') : '—';
    const macdCol = ind ? (ind.macd.hist > 0 ? 'up' : 'down') : '';
    const vol = (randInt(300, 3000) + 'k');

    return `<tr>
      <td><strong>${inst.sym}</strong><br><span style="color:var(--text3);font-size:10px">${inst.name}</span></td>
      <td>${inst.sector}</td>
      <td>${inst.price.toFixed(2)}</td>
      <td class="${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</td>
      <td>${vol}</td>
      <td style="color:${ind && ind.rsi > 70 ? 'var(--red)' : ind && ind.rsi < 30 ? 'var(--green)' : 'var(--text)'}">${rsi}</td>
      <td class="${macdCol}">${macdH}</td>
      <td><span class="score-pill ${pillClass(score)}">${score}</span></td>
      <td>${sig ? `<span class="signal-dir ${sig.dir === 'BUY' ? 'buy' : 'sell'}">${sig.dir === 'BUY' ? 'KÖP' : 'SÄLJ'}</span>` : '<span style="color:var(--text3)">—</span>'}</td>
    </tr>`;
  }).join('');
}

function renderRiskPage() {
  const usedRisk = Math.abs(STATE.dailyPnl) / (CONFIG.initialCapital * CONFIG.maxDailyLoss / 100);
  const pct = Math.min(1, usedRisk);

  const canvas = document.getElementById('riskGauge');
  if (canvas) {
    drawGauge(canvas, pct);
    document.getElementById('gaugeLabel').textContent = Math.round(pct * 100) + '%';
  }

  // Risk bars
  const tradeRisk = rand(0, 1.8);
  const dayLoss   = Math.abs(STATE.dailyPnl / CONFIG.initialCapital * 100);
  const trades    = STATE.trades.length;
  const exposure  = rand(20, 60);

  setRiskBar('rbar1', 'rval1', tradeRisk, 2, `${tradeRisk.toFixed(1)}% / 2%`);
  setRiskBar('rbar2', 'rval2', dayLoss,   5, `${dayLoss.toFixed(1)}% / 5%`);
  setRiskBar('rbar3', 'rval3', trades,    20, `${trades} / 20`);
  setRiskBar('rbar4', 'rval4', exposure,  80, `${exposure.toFixed(0)}% / 80%`);

  drawSectorChart();

  // VaR
  const varEl = document.getElementById('varStats');
  varEl.innerHTML = [
    ['VaR 95% (1 dag)', `${(rand(1.2, 2.5)).toFixed(2)}%`],
    ['VaR 99% (1 dag)', `${(rand(2.5, 4.0)).toFixed(2)}%`],
    ['Expected Shortfall', `${(rand(3, 5)).toFixed(2)}%`],
    ['Max Drawdown (idag)', `${Math.max(0, -(STATE.dailyPnl / CONFIG.initialCapital * 100)).toFixed(2)}%`],
    ['Sharpe (rullande 30d)', `${rand(0.8, 2.4).toFixed(2)}`],
    ['Beta (mot OMXS30)', `${rand(0.7, 1.4).toFixed(2)}`],
  ].map(([lbl, val]) => `<div class="var-row"><span class="lbl">${lbl}</span><span class="val">${val}</span></div>`).join('');

  // Risk log
  if (STATE.riskLog.length === 0) {
    ['OK','OK','WARN','OK','WARN'].forEach((type, i) => {
      STATE.riskLog.push({
        time: now(),
        type,
        msg: type === 'OK'
          ? 'Riskkontroll passerade – alla parametrar inom gränser'
          : 'Volatiliteten steg – spread ökade. Latens kontrollerad.',
      });
    });
  }
  document.getElementById('riskLog').innerHTML = STATE.riskLog.slice(-20).reverse().map(e => `
    <div class="risk-log-entry">
      <span class="rtime">${e.time}</span>
      <span class="rtype ${e.type.toLowerCase()}">${e.type}</span>
      <span class="rmsg">${e.msg}</span>
    </div>
  `).join('');
}

function setRiskBar(barId, valId, value, max, label) {
  const pct = Math.min(100, (value / max) * 100);
  document.getElementById(barId).style.width = pct + '%';
  document.getElementById(valId).textContent = label;
}

function renderNewsPage() {
  const sent = document.getElementById('newsSentiment').value;
  const src  = document.getElementById('newsSource').value;
  const q    = document.getElementById('newsSearch').value.toLowerCase();
  const grid = document.getElementById('newsGrid');

  let news = STATE.news.filter(n => {
    const matchSent = sent === 'all' || n.sent === sent;
    const matchSrc  = src  === 'all' || n.src  === src;
    const matchQ    = !q || n.headline.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
    return matchSent && matchSrc && matchQ;
  });

  grid.innerHTML = news.map(n => `
    <div class="news-card ${n.sent}">
      <div class="nc-header">
        <span class="news-src">${n.src}</span>
        <span class="sentiment-badge ${n.sent}">${n.sent}</span>
      </div>
      <div class="nc-headline">${n.headline}</div>
      <div class="nc-body">${n.body}</div>
      <div class="nc-footer">
        <span class="news-time">${n.ts}</span>
        <span style="font-family:var(--mono);font-size:10px;color:var(--accent)">${n.sym}</span>
      </div>
    </div>
  `).join('');
}

// ─── SIGNAL MODAL ─────────────────────────────

function openSignalModal(id) {
  const sig = STATE.signals.find(s => s.id === id);
  if (!sig) return;

  const modal = document.getElementById('signalModal');
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');

  const ind = sig.indicators;

  content.innerHTML = `
    <div class="modal-sym">${sig.sym} <span style="font-size:16px;font-weight:400;color:var(--text2)">${sig.name}</span></div>
    <span class="sc-dir ${sig.dir === 'BUY' ? 'buy' : 'sell'}" style="display:inline-block;margin-bottom:8px">${sig.dir === 'BUY' ? 'KÖP' : 'SÄLJ'}</span>

    <div style="display:flex;gap:16px;margin:8px 0">
      <div class="sc-score-block">
        <div class="sc-score-label">Signal Score</div>
        <div class="sc-score-val ${scoreColor(sig.score)}" style="font-size:32px">${sig.score}</div>
        <div class="score-bar" style="width:120px"><div class="score-bar-fill" style="width:${sig.score}%;background:${scoreBarColor(sig.score)}"></div></div>
      </div>
      <div class="sc-score-block">
        <div class="sc-score-label">Confidence</div>
        <div class="sc-score-val ${scoreColor(sig.confidence)}" style="font-size:32px">${sig.confidence}</div>
        <div class="score-bar" style="width:120px"><div class="score-bar-fill" style="width:${sig.confidence}%;background:${scoreBarColor(sig.confidence)}"></div></div>
      </div>
      <div>
        <div class="sc-score-label">Risknivå</div>
        <span class="sc-risk-badge ${riskClass(sig.risknivå)}" style="font-size:12px;padding:4px 10px">${sig.risknivå.toUpperCase()}</span>
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Prisnivåer</div>
      <div class="modal-grid">
        <div class="modal-field"><div class="lbl">Triggernivå</div><div class="val" style="color:var(--accent)">${sig.trigger}</div></div>
        <div class="modal-field"><div class="lbl">Stop-loss</div><div class="val" style="color:var(--red)">${sig.stop}</div></div>
        <div class="modal-field"><div class="lbl">Mål 1</div><div class="val" style="color:var(--green)">${sig.target1}</div></div>
        <div class="modal-field"><div class="lbl">Mål 2</div><div class="val" style="color:var(--green)">${sig.target2}</div></div>
        <div class="modal-field"><div class="lbl">Risk/Reward</div><div class="val">${sig.rr.toFixed(2)}:1</div></div>
        <div class="modal-field"><div class="lbl">Aktuell kurs</div><div class="val">${sig.price}</div></div>
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Tekniska indikatorer</div>
      <div class="modal-grid">
        <div class="modal-field"><div class="lbl">RSI (14)</div><div class="val" style="color:${ind.rsi>70?'var(--red)':ind.rsi<30?'var(--green)':'var(--text)'}">${ind.rsi}</div></div>
        <div class="modal-field"><div class="lbl">MACD Hist</div><div class="val" style="color:${ind.macd>0?'var(--green)':'var(--red)'}">${ind.macd}</div></div>
        <div class="modal-field"><div class="lbl">VWAP</div><div class="val">${ind.vwap}</div></div>
        <div class="modal-field"><div class="lbl">ATR (14)</div><div class="val">${ind.atr}</div></div>
        <div class="modal-field"><div class="lbl">EMA 9</div><div class="val">${ind.ema9}</div></div>
        <div class="modal-field"><div class="lbl">EMA 21</div><div class="val">${ind.ema21}</div></div>
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Varför genererades signalen?</div>
      <div style="background:var(--bg2);border-left:3px solid var(--accent);padding:10px 12px;border-radius:4px;font-size:12px;color:var(--text2);line-height:1.6">
        ${sig.reason}
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Alternativa scenarier</div>
      <div class="modal-scenario">${sig.altScenario}</div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Källor</div>
      <div style="font-size:11px;color:var(--text2)">${sig.dataSources.join(' · ')} · ${sig.timestamp}</div>
    </div>

    <div class="modal-section" style="border-top:none">
      <button class="action-btn ${sig.dir === 'BUY' ? 'buy' : 'sell'}" onclick="paperTrade('${sig.id}')">
        ${sig.dir === 'BUY' ? '▲ Öppna KÖPPOSITION' : '▼ Öppna SÄLJPOSITION'} (Paper)
      </button>
      <button class="action-btn" style="background:var(--bg3);color:var(--text2)" onclick="closeModal()">Avfärda</button>
    </div>
  `;

  overlay.classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// ─── PAPER TRADING ─────────────────────────────

function paperTrade(sigId) {
  const sig = STATE.signals.find(s => s.id === sigId);
  if (!sig) return;

  const posSize = CONFIG.initialCapital * 0.05;
  const qty = Math.floor(posSize / sig.trigger);

  STATE.positions.push({
    id: `pos-${Date.now()}`,
    sym: sig.sym,
    dir: sig.dir,
    entryPrice: sig.trigger,
    qty,
    value: qty * sig.trigger,
    stop: sig.stop,
    target: sig.target1,
    rr: sig.rr,
    openTime: now(),
  });

  addRiskLog('OK', `Ny position öppnad: ${sig.sym} ${sig.dir} ${qty} st @ ${sig.trigger} (Paper)`);
  closeModal();
  renderPositions();
}

function closePosition(posId) {
  const idx = STATE.positions.findIndex(p => p.id === posId);
  if (idx === -1) return;
  const pos = STATE.positions[idx];
  const inst = INSTRUMENTS.find(i => i.sym === pos.sym);
  const exitPrice = inst ? inst.price : pos.entryPrice;
  const pnl = (exitPrice - pos.entryPrice) * pos.qty * (pos.dir === 'BUY' ? 1 : -1);

  STATE.trades.push({ ...pos, exitPrice, pnl, closeTime: now() });
  STATE.dailyPnl += pnl;
  STATE.positions.splice(idx, 1);

  addRiskLog(pnl >= 0 ? 'OK' : 'WARN', `Position stängd: ${pos.sym} P&L ${fmtKr(pnl)}`);
  renderPositions();
}

function addRiskLog(type, msg) {
  STATE.riskLog.push({ time: now(), type, msg });
  if (STATE.riskLog.length > 100) STATE.riskLog.shift();
}

// ─── BACKTEST ─────────────────────────────────

function runBacktest() {
  const sym        = document.getElementById('btInstrument').value;
  const capital    = parseFloat(document.getElementById('btCapital').value) || 100000;
  const commission = parseFloat(document.getElementById('btCommission').value) || 29;
  const slippage   = parseFloat(document.getElementById('btSlippage').value) || 2;

  const bars = STATE.priceHistory[sym] || [];
  const closes = bars.map(b => b.close);
  if (closes.length < 30) return;

  // Simple EMA crossover strategy
  let equity = capital;
  const equityCurve = [capital];
  const trades = [];
  let position = null;
  let maxEq = capital, maxDD = 0;

  for (let i = 21; i < closes.length; i++) {
    const ema9  = calcEMA(closes.slice(0, i + 1), 9);
    const ema21 = calcEMA(closes.slice(0, i + 1), 21);
    const rsi   = calcRSI(closes.slice(0, i + 1));
    const price = closes[i];
    const slipCost = price * slippage / 10000;

    if (!position && ema9 > ema21 && rsi < 65) {
      const qty = Math.floor((equity * 0.2) / (price + slipCost));
      position = { dir: 'BUY', entryPrice: price + slipCost, qty, entryI: i };
    } else if (position && ema9 < ema21) {
      const exitPrice = price - slipCost;
      const pnl = (exitPrice - position.entryPrice) * position.qty - commission;
      equity += pnl;
      trades.push({
        date: new Date(bars[i].ts).toLocaleDateString('sv-SE'),
        dir: 'KÖP',
        entryPrice: position.entryPrice.toFixed(2),
        exitPrice: exitPrice.toFixed(2),
        pnl: pnl.toFixed(0),
        reason: 'EMA crossover exit',
      });
      position = null;
    }

    equityCurve.push(equity);
    maxEq = Math.max(maxEq, equity);
    maxDD = Math.max(maxDD, (maxEq - equity) / maxEq * 100);
  }

  const totalReturn = (equity - capital) / capital * 100;
  const wins = trades.filter(t => parseFloat(t.pnl) > 0).length;
  const sharpe = (totalReturn / 100) / (rand(0.12, 0.22)) * Math.sqrt(252);

  // Show results
  document.getElementById('btResults').style.display = '';
  document.getElementById('btStats').innerHTML = [
    ['Total avkastning', `${totalReturn.toFixed(2)}%`, totalReturn >= 0 ? 'green' : 'red'],
    ['Slutkapital', `${equity.toLocaleString('sv-SE', {maximumFractionDigits:0})} kr`, ''],
    ['Antal trades', trades.length, ''],
    ['Win rate', `${trades.length ? Math.round(wins/trades.length*100) : 0}%`, ''],
    ['Max drawdown', `${maxDD.toFixed(2)}%`, 'red'],
    ['Sharpe ratio', sharpe.toFixed(2), sharpe > 1 ? 'green' : ''],
  ].map(([lbl, val, cls]) => `
    <div class="bt-stat-card">
      <div class="bt-stat-label">${lbl}</div>
      <div class="bt-stat-val ${cls}">${val}</div>
    </div>
  `).join('');

  // Equity chart
  drawEquityChart(equityCurve, capital);

  // Trade table
  document.getElementById('btTradeBody').innerHTML = trades.slice(-20).map(t => {
    const pnl = parseFloat(t.pnl);
    return `<tr>
      <td>${t.date}</td>
      <td><span class="signal-dir buy">KÖP</span></td>
      <td>${t.entryPrice}</td>
      <td>${t.exitPrice}</td>
      <td class="${pnl >= 0 ? 'up' : 'down'}">${pnl >= 0 ? '+' : ''}${parseFloat(t.pnl).toLocaleString('sv-SE')} kr</td>
      <td style="color:var(--text2);font-size:11px">${t.reason}</td>
    </tr>`;
  }).join('');
}

function drawEquityChart(curve, startCapital) {
  const canvas = document.getElementById('equityChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;

  const min = Math.min(...curve) * 0.995;
  const max = Math.max(...curve) * 1.005;
  const PAD = { top: 10, right: 10, bottom: 20, left: 70 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top  - PAD.bottom;

  const isDark = document.body.classList.contains('dark');
  ctx.fillStyle = isDark ? '#111620' : '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = isDark ? '#1e2535' : '#d0daea';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (cH / 4) * i;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    const val = max - ((max - min) / 4) * i;
    ctx.fillStyle = isDark ? '#7a8fb5' : '#4a5a7a';
    ctx.font = '9px Share Tech Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText((val/1000).toFixed(1) + 'k', PAD.left - 4, y + 3);
  }

  // Baseline
  const baseY = PAD.top + cH - ((startCapital - min) / (max - min)) * cH;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = isDark ? '#3d5080' : '#b0bbd0';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD.left, baseY); ctx.lineTo(W - PAD.right, baseY); ctx.stroke();
  ctx.setLineDash([]);

  // Fill
  const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
  grad.addColorStop(0, 'rgba(0,230,118,0.3)');
  grad.addColorStop(1, 'rgba(0,230,118,0.02)');
  ctx.beginPath();
  curve.forEach((v, i) => {
    const x = PAD.left + (i / (curve.length - 1)) * cW;
    const y = PAD.top + cH - ((v - min) / (max - min)) * cH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(PAD.left + cW, PAD.top + cH);
  ctx.lineTo(PAD.left, PAD.top + cH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  curve.forEach((v, i) => {
    const x = PAD.left + (i / (curve.length - 1)) * cW;
    const y = PAD.top + cH - ((v - min) / (max - min)) * cH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#00e676';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ─── CHART INSTRUMENT SELECT ──────────────────

function populateSelects() {
  const opts = INSTRUMENTS.map(i => `<option value="${i.sym}">${i.sym} – ${i.name}</option>`).join('');
  document.getElementById('chartInstrument').innerHTML = opts;
  document.getElementById('btInstrument').innerHTML = opts;
  STATE.chartInstrument = INSTRUMENTS[0].sym;
}

// ─── MAIN LOOP ────────────────────────────────

function updateAll() {
  tickPrices();
  generateSignals();

  renderTopbarTickers();
  renderKPIs();
  renderTopSignals();
  renderPositions();
  renderNewsFeed();
  drawPriceChart();
  renderChartIndicators();

  // Only update active tab
  const activeTab = document.querySelector('.tab.active')?.dataset.tab;
  if (activeTab === 'signals')     renderSignalsPage();
  if (activeTab === 'instruments') renderInstruments();
  if (activeTab === 'risk')        renderRiskPage();
  if (activeTab === 'news')        renderNewsPage();
  if (activeTab === 'shadow')      renderShadowPage();
}

// ─── CLOCK ────────────────────────────────────

function updateClock() {
  const el = document.getElementById('clock');
  const now = new Date();
  el.textContent = now.toLocaleTimeString('sv-SE');

  // Market status
  const h = now.getHours(), m = now.getMinutes();
  const open = (h > 9 || (h === 9 && m >= 0)) && h < 17;
  const ms = document.getElementById('marketStatus');
  if (ms) {
    ms.textContent = open ? '● MARKNADEN ÖPPEN' : '○ MARKNADEN STÄNGD';
    ms.style.color = open ? 'var(--green)' : 'var(--text3)';
  }
}

// ─── EVENT HANDLERS ───────────────────────────

function initEvents() {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`view-${tab.dataset.tab}`)?.classList.add('active');
      // Trigger render for the activated tab
      const t = tab.dataset.tab;
      if (t === 'signals')     renderSignalsPage();
      if (t === 'instruments') renderInstruments();
      if (t === 'risk')        renderRiskPage();
      if (t === 'news')        renderNewsPage();
      if (t === 'shadow')   { renderShadowPage(); initShadowTab(); }
      if (t === 'backtest') {        const today = new Date();
        const start = new Date(today - 90 * 86400000);
        document.getElementById('btEnd').value = today.toISOString().split('T')[0];
        document.getElementById('btStart').value = start.toISOString().split('T')[0];
      }
    });
  });

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark');
    document.body.classList.toggle('dark', !isDark);
    document.body.classList.toggle('light', isDark);
    document.getElementById('themeToggle').textContent = isDark ? '☀' : '🌙';
    drawPriceChart();
    drawSectorChart();
  });

  // Modal close
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  // Chart instrument
  document.getElementById('chartInstrument').addEventListener('change', e => {
    STATE.chartInstrument = e.target.value;
    drawPriceChart();
    renderChartIndicators();
  });

  // Timeframe
  document.querySelectorAll('.tf').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tf').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.activeTimeframe = btn.dataset.tf;
      drawPriceChart();
    });
  });

  // Signal filters
  document.getElementById('filterScore').addEventListener('input', e => {
    document.getElementById('filterScoreVal').textContent = e.target.value;
    renderSignalsPage();
  });
  document.getElementById('filterDir').addEventListener('change', renderSignalsPage);
  document.getElementById('filterRisk').addEventListener('change', renderSignalsPage);
  document.getElementById('refreshSignals').addEventListener('click', () => {
    generateSignals();
    renderSignalsPage();
  });

  // Instrument search
  document.getElementById('instSearch').addEventListener('input', renderInstruments);
  document.getElementById('instSector').addEventListener('change', renderInstruments);

  // News filters
  document.getElementById('newsSentiment').addEventListener('change', renderNewsPage);
  document.getElementById('newsSource').addEventListener('change', renderNewsPage);
  document.getElementById('newsSearch').addEventListener('input', renderNewsPage);

  // Backtest
  document.getElementById('runBacktest').addEventListener('click', runBacktest);

  // Resize chart on window resize
  window.addEventListener('resize', () => {
    drawPriceChart();
    drawSectorChart();
  });
}

// ─── INIT ─────────────────────────────────────

function init() {
  initPriceHistory();
  generateNews();
  populateSelects();
  initEvents();
  updateAll();

  setInterval(updateClock, 1000);
  setInterval(updateAll, CONFIG.updateInterval);

  updateClock();
  console.log('DMA Trading Cockpit v1.0 — MVP 1 initierad');
  console.log(`Laddade ${INSTRUMENTS.length} instrument, ${STATE.signals.length} signaler genererade`);
}

document.addEventListener('DOMContentLoaded', init);

// ─── SHADOW TRADING ───────────────────────────
// Fristående fiktiv handelsmotor, lever bredvid STATE

const SHADOW = {
  capital: 100000,
  initialCapital: 100000,
  positions: [],   // { id, sym, dir, qty, entryPrice, stop, target, openTime, commission }
  trades: [],      // closed trades with pnl
  equityCurve: [100000],
  activeDir: 'BUY',
  shadowTf: '5m',
  shadowInstrument: null,
  toastTimer: null,
  _tabInitDone: false,
};

// ── Init ──
function initShadowTab() {
  if (SHADOW._tabInitDone) return;
  SHADOW._tabInitDone = true;

  // Populate instrument select
  const sel = document.getElementById('shInstrument');
  sel.innerHTML = INSTRUMENTS.map(i => `<option value="${i.sym}">${i.sym} – ${i.name}</option>`).join('');
  SHADOW.shadowInstrument = INSTRUMENTS[0].sym;

  sel.addEventListener('change', e => {
    SHADOW.shadowInstrument = e.target.value;
    updateShadowLivePrice();
    drawShadowMiniChart();
    updateShadowIndicators();
    prefillShadowPrice();
  });

  // Qty / price live summary
  document.getElementById('shQty').addEventListener('input', updateShadowSummary);
  document.getElementById('shPrice').addEventListener('input', updateShadowSummary);
  document.getElementById('shStop').addEventListener('input', updateShadowSummary);
  document.getElementById('shTarget').addEventListener('input', updateShadowSummary);

  // Mini chart TF
  document.querySelectorAll('[data-stf]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-stf]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      SHADOW.shadowTf = btn.dataset.stf;
      drawShadowMiniChart();
    });
  });

  // Reset
  document.getElementById('resetShadow').addEventListener('click', resetShadow);

  prefillShadowPrice();
  updateShadowLivePrice();
  drawShadowMiniChart();
  updateShadowIndicators();
  updateShadowSummary();
}

function resetShadow() {
  if (!confirm('Återställ Shadow Trading? All historik raderas.')) return;
  SHADOW.capital = SHADOW.initialCapital;
  SHADOW.positions = [];
  SHADOW.trades = [];
  SHADOW.equityCurve = [SHADOW.initialCapital];
  renderShadowPage();
  showShadowToast('Portfolio återställd', false);
}

// ── Direction toggle ──
function setShadowDir(dir) {
  SHADOW.activeDir = dir;
  document.getElementById('shBuyBtn').classList.toggle('active', dir === 'BUY');
  document.getElementById('shSellBtn').classList.toggle('active', dir === 'SELL');
  const btn = document.getElementById('shSubmit');
  btn.textContent = dir === 'BUY' ? '▲ LÄGG KÖP-ORDER' : '▼ LÄGG SÄLJ-ORDER';
  btn.className = `sh-submit-btn ${dir === 'BUY' ? 'buy' : 'sell'}`;
  prefillShadowPrice();
  updateShadowSummary();
}

// ── Prefill price from live ──
function prefillShadowPrice() {
  const sym = SHADOW.shadowInstrument || (INSTRUMENTS[0] && INSTRUMENTS[0].sym);
  const inst = INSTRUMENTS.find(i => i.sym === sym);
  if (!inst) return;
  document.getElementById('shPrice').value = inst.price.toFixed(2);
  // Auto-suggest stop/target from ATR
  const ind = getIndicators(sym);
  if (ind) {
    const atr = ind.atr;
    if (SHADOW.activeDir === 'BUY') {
      document.getElementById('shStop').value   = (inst.price - atr * 1.5).toFixed(2);
      document.getElementById('shTarget').value = (inst.price + atr * 2.5).toFixed(2);
    } else {
      document.getElementById('shStop').value   = (inst.price + atr * 1.5).toFixed(2);
      document.getElementById('shTarget').value = (inst.price - atr * 2.5).toFixed(2);
    }
  }
  updateShadowSummary();
}

// ── Live price display ──
function updateShadowLivePrice() {
  const sym = SHADOW.shadowInstrument;
  const inst = INSTRUMENTS.find(i => i.sym === sym);
  if (!inst) return;
  const liveEl = document.getElementById('shLivePrice');
  const chgEl  = document.getElementById('shLiveChg');
  if (liveEl) liveEl.textContent = inst.price.toFixed(2);
  const chg = ((inst.price - inst.prevClose) / inst.prevClose * 100);
  if (chgEl) {
    chgEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
    chgEl.className = 'sh-live-chg ' + (chg >= 0 ? 'up' : 'down');
  }
}

// ── Order summary ──
function updateShadowSummary() {
  const qty   = parseInt(document.getElementById('shQty')?.value) || 0;
  const price = parseFloat(document.getElementById('shPrice')?.value) || 0;
  const stop  = parseFloat(document.getElementById('shStop')?.value) || 0;
  const tgt   = parseFloat(document.getElementById('shTarget')?.value) || 0;

  const value = qty * price;
  const avail = SHADOW.capital;

  const sumVal  = document.getElementById('shSumValue');
  const sumAvail= document.getElementById('shSumAvail');
  const rrRow   = document.getElementById('shSumRR');
  const rrVal   = document.getElementById('shSumRRVal');

  if (sumVal)   sumVal.textContent   = value > 0 ? value.toLocaleString('sv-SE', {maximumFractionDigits:0}) + ' kr' : '—';
  if (sumAvail) {
    const remaining = avail - value - 29;
    sumAvail.textContent = avail.toLocaleString('sv-SE', {maximumFractionDigits:0}) + ' kr';
    sumAvail.style.color = remaining < 0 ? 'var(--red)' : 'var(--green)';
  }

  // R/R
  if (stop && tgt && price) {
    const risk   = Math.abs(price - stop);
    const reward = Math.abs(tgt - price);
    const rr     = risk > 0 ? (reward / risk).toFixed(2) : '—';
    if (rrRow) rrRow.style.display = '';
    if (rrVal) rrVal.textContent = rr + ':1';
  } else {
    if (rrRow) rrRow.style.display = 'none';
  }
}

// ── Indicators on mini chart ──
function updateShadowIndicators() {
  const sym = SHADOW.shadowInstrument;
  const ind = getIndicators(sym);
  if (!ind) return;
  const rsiEl  = document.getElementById('shRSI');
  const emaEl  = document.getElementById('shEMA');
  const vwapEl = document.getElementById('shVWAP');
  if (rsiEl)  { rsiEl.textContent = `RSI: ${ind.rsi.toFixed(1)}`; rsiEl.style.color = ind.rsi > 70 ? 'var(--red)' : ind.rsi < 30 ? 'var(--green)' : ''; }
  if (emaEl)  emaEl.textContent  = `EMA9: ${ind.ema9.toFixed(2)} / EMA21: ${ind.ema21.toFixed(2)}`;
  if (vwapEl) vwapEl.textContent = `VWAP: ${ind.vwap.toFixed(2)}`;
  const titleEl = document.getElementById('shChartTitle');
  if (titleEl) titleEl.textContent = `${sym} – Kursgraf`;
}

// ── Submit order ──
function submitShadowOrder() {
  const sym    = SHADOW.shadowInstrument;
  const dir    = SHADOW.activeDir;
  const qty    = parseInt(document.getElementById('shQty').value);
  const price  = parseFloat(document.getElementById('shPrice').value);
  const stop   = parseFloat(document.getElementById('shStop').value) || null;
  const target = parseFloat(document.getElementById('shTarget').value) || null;
  const commission = 29;

  if (!qty || qty < 1) return showShadowToast('Ange antal aktier', true);
  if (!price || price <= 0) return showShadowToast('Ange ett giltigt pris', true);

  const orderValue = qty * price + commission;
  if (orderValue > SHADOW.capital) {
    return showShadowToast(`Otillräckligt kapital (behöver ${orderValue.toFixed(0)} kr, har ${SHADOW.capital.toFixed(0)} kr)`, true);
  }

  // For SELL we allow short
  SHADOW.capital -= orderValue;

  const inst = INSTRUMENTS.find(i => i.sym === sym);
  SHADOW.positions.push({
    id: `sh-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
    sym,
    name: inst?.name || sym,
    dir,
    qty,
    entryPrice: price,
    currentPrice: price,
    stop,
    target,
    commission,
    openTime: new Date().toLocaleTimeString('sv-SE'),
    openDate: new Date().toLocaleDateString('sv-SE'),
  });

  addRiskLog('OK', `Shadow: ${dir === 'BUY' ? 'KÖP' : 'SÄLJ'} ${qty} st ${sym} @ ${price.toFixed(2)} kr (fiktiv)`);
  showShadowToast(`${dir === 'BUY' ? '▲ KÖP' : '▼ SÄLJ'} ${qty} × ${sym} @ ${price.toFixed(2)} kr`, dir === 'SELL');
  renderShadowPage();
}

// ── Close position ──
function closeShadowPosition(posId) {
  const idx = SHADOW.positions.findIndex(p => p.id === posId);
  if (idx === -1) return;
  const pos = SHADOW.positions[idx];
  const inst = INSTRUMENTS.find(i => i.sym === pos.sym);
  const exitPrice = inst ? inst.price : pos.entryPrice;
  const commission = 29;

  const rawPnl = (exitPrice - pos.entryPrice) * pos.qty * (pos.dir === 'BUY' ? 1 : -1);
  const pnl = rawPnl - commission;
  const pnlPct = (rawPnl / (pos.entryPrice * pos.qty)) * 100 * (pos.dir === 'BUY' ? 1 : -1);
  const risk   = pos.stop   ? Math.abs(pos.entryPrice - pos.stop)   : null;
  const reward = pos.target ? Math.abs(pos.target - pos.entryPrice) : null;
  const rr     = risk && reward ? (reward / risk).toFixed(2) : '—';

  // Return capital
  SHADOW.capital += pos.qty * exitPrice - commission;

  SHADOW.trades.push({
    ...pos,
    exitPrice,
    pnl,
    pnlPct,
    rr,
    closeTime: new Date().toLocaleTimeString('sv-SE'),
    closeDate: new Date().toLocaleDateString('sv-SE'),
  });
  SHADOW.positions.splice(idx, 1);

  // Update equity curve
  const totalEquity = SHADOW.capital + calcShadowUnrealizedPnl();
  SHADOW.equityCurve.push(totalEquity);
  if (SHADOW.equityCurve.length > 200) SHADOW.equityCurve.shift();

  addRiskLog(pnl >= 0 ? 'OK' : 'WARN', `Shadow stängd: ${pos.sym} P&L ${fmtKr(pnl)}`);
  showShadowToast(`${pos.sym} stängd: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)} kr`, pnl < 0);
  renderShadowPage();
}

// ── Unrealized P&L ──
function calcShadowUnrealizedPnl() {
  return SHADOW.positions.reduce((sum, pos) => {
    const inst = INSTRUMENTS.find(i => i.sym === pos.sym);
    const cur = inst ? inst.price : pos.entryPrice;
    return sum + (cur - pos.entryPrice) * pos.qty * (pos.dir === 'BUY' ? 1 : -1);
  }, 0);
}

function calcShadowRealizedPnl() {
  return SHADOW.trades.reduce((s, t) => s + t.pnl, 0);
}

// ── Main render ──
function renderShadowPage() {
  if (!document.getElementById('view-shadow')?.classList.contains('active')) return;

  updateShadowLivePrice();
  prefillShadowPrice();
  updateShadowSummary();
  updateShadowIndicators();
  drawShadowMiniChart();

  const unrealPnl  = calcShadowUnrealizedPnl();
  const realPnl    = calcShadowRealizedPnl();
  const totalEquity = SHADOW.capital + unrealPnl;
  const wins = SHADOW.trades.filter(t => t.pnl > 0).length;
  const winRate = SHADOW.trades.length ? Math.round(wins / SHADOW.trades.length * 100) + '%' : '—';

  // Drawdown
  const peakEquity = Math.max(SHADOW.initialCapital, ...SHADOW.equityCurve);
  const dd = peakEquity > 0 ? Math.max(0, (peakEquity - totalEquity) / peakEquity * 100) : 0;

  setElText('shCapital',      totalEquity.toLocaleString('sv-SE', {maximumFractionDigits:0}) + ' kr');
  setElColor('shCapital',     totalEquity >= SHADOW.initialCapital ? 'var(--green)' : 'var(--red)');
  setElText('shUnrealPnl',    fmtKr(unrealPnl));
  setElColor('shUnrealPnl',   unrealPnl >= 0 ? 'var(--green)' : 'var(--red)');
  setElText('shRealPnl',      fmtKr(realPnl));
  setElColor('shRealPnl',     realPnl >= 0 ? 'var(--green)' : 'var(--red)');
  setElText('shOpenPos',      SHADOW.positions.length);
  setElText('shClosedTrades', SHADOW.trades.length);
  setElText('shWinRate',      winRate);
  setElText('shDrawdown',     dd.toFixed(2) + '%');
  setElColor('shDrawdown',    dd > 3 ? 'var(--red)' : dd > 1 ? 'var(--yellow)' : 'var(--green)');

  // Badge
  const badge = document.getElementById('shPosBadge');
  if (badge) badge.textContent = SHADOW.positions.length;

  renderShadowPositions();
  renderShadowHistory();
  drawShadowEquityCurve();
}

function setElText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setElColor(id, color) {
  const el = document.getElementById(id);
  if (el) el.style.color = color;
}

// ── Positions table ──
function renderShadowPositions() {
  const tbody = document.getElementById('shPosBody');
  if (!tbody) return;

  if (!SHADOW.positions.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:18px;font-size:12px">Inga öppna positioner — lägg en order till vänster</td></tr>';
    return;
  }

  tbody.innerHTML = SHADOW.positions.map(pos => {
    const inst = INSTRUMENTS.find(i => i.sym === pos.sym);
    const cur  = inst ? inst.price : pos.entryPrice;
    const rawPnl = (cur - pos.entryPrice) * pos.qty * (pos.dir === 'BUY' ? 1 : -1);
    const pnlPct = (rawPnl / (pos.entryPrice * pos.qty)) * 100;
    const cls  = rawPnl >= 0 ? 'up' : 'down';

    // Stop/target hit indicators
    let stopHit = false, targetHit = false;
    if (pos.stop   && pos.dir === 'BUY'  && cur <= pos.stop)   stopHit = true;
    if (pos.stop   && pos.dir === 'SELL' && cur >= pos.stop)   stopHit = true;
    if (pos.target && pos.dir === 'BUY'  && cur >= pos.target) targetHit = true;
    if (pos.target && pos.dir === 'SELL' && cur <= pos.target) targetHit = true;

    const rowClass = stopHit ? 'flash-red' : targetHit ? 'flash-green' : '';

    return `<tr class="${rowClass}">
      <td><strong>${pos.sym}</strong><br><span style="color:var(--text3);font-size:10px">${pos.openTime}</span></td>
      <td><span class="signal-dir ${pos.dir === 'BUY' ? 'buy' : 'sell'}">${pos.dir === 'BUY' ? 'KÖP' : 'SÄLJ'}</span></td>
      <td style="font-family:var(--mono)">${pos.qty}</td>
      <td style="font-family:var(--mono)">${pos.entryPrice.toFixed(2)}</td>
      <td style="font-family:var(--mono);color:var(--accent)">${cur.toFixed(2)}</td>
      <td class="${cls}" style="font-family:var(--mono)">${fmtKr(rawPnl)}</td>
      <td class="${cls}" style="font-family:var(--mono);font-size:11px">${rawPnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%</td>
      <td style="color:var(--red);font-family:var(--mono);font-size:11px">${pos.stop ? pos.stop.toFixed(2) : '—'}</td>
      <td style="color:var(--green);font-family:var(--mono);font-size:11px">${pos.target ? pos.target.toFixed(2) : '—'}</td>
      <td><button class="btn-close-pos" onclick="closeShadowPosition('${pos.id}')">Stäng</button></td>
    </tr>`;
  }).join('');
}

// ── History table ──
function renderShadowHistory() {
  const tbody = document.getElementById('shHistBody');
  const empty = document.getElementById('shHistEmpty');
  if (!tbody) return;

  if (!SHADOW.trades.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = [...SHADOW.trades].reverse().map(t => {
    const cls = t.pnl >= 0 ? 'up' : 'down';
    return `<tr>
      <td style="font-size:11px;color:var(--text2)">${t.closeDate}<br>${t.closeTime}</td>
      <td><strong>${t.sym}</strong></td>
      <td><span class="signal-dir ${t.dir === 'BUY' ? 'buy' : 'sell'}">${t.dir === 'BUY' ? 'KÖP' : 'SÄLJ'}</span></td>
      <td style="font-family:var(--mono)">${t.qty}</td>
      <td style="font-family:var(--mono)">${t.entryPrice.toFixed(2)}</td>
      <td style="font-family:var(--mono)">${t.exitPrice.toFixed(2)}</td>
      <td class="${cls}" style="font-family:var(--mono);font-weight:bold">${fmtKr(t.pnl)}</td>
      <td class="${cls}" style="font-family:var(--mono);font-size:11px">${t.pnl >= 0 ? '+' : ''}${t.pnlPct.toFixed(2)}%</td>
      <td style="color:var(--text3);font-family:var(--mono);font-size:11px">29 kr</td>
      <td style="font-family:var(--mono);color:var(--yellow)">${t.rr}:1</td>
    </tr>`;
  }).join('');
}

// ── Mini chart ──
function drawShadowMiniChart() {
  const canvas = document.getElementById('shadowMiniChart');
  if (!canvas) return;

  const sym = SHADOW.shadowInstrument || INSTRUMENTS[0].sym;
  const bars = STATE.priceHistory[sym] || [];
  const n = Math.min(60, bars.length);
  const slice = bars.slice(-n);
  if (!slice.length) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  if (!W || !H) return;

  const prices = slice.flatMap(b => [b.high, b.low]);
  const minP = Math.min(...prices) * 0.998;
  const maxP = Math.max(...prices) * 1.002;
  const range = maxP - minP || 1;
  const isDark = document.body.classList.contains('dark');
  const PAD = { top: 8, right: 10, bottom: 20, left: 56 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const barW = Math.max(2, (cW / n) * 0.7);

  ctx.fillStyle = isDark ? '#111620' : '#fff';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = isDark ? '#1e2535' : '#d0daea';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (cH / 4) * i;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    const p = maxP - (range / 4) * i;
    ctx.fillStyle = isDark ? '#7a8fb5' : '#4a5a7a';
    ctx.font = `9px 'Share Tech Mono',monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(p.toFixed(2), PAD.left - 4, y + 3);
  }

  // EMA lines
  const closes = slice.map(b => b.close);
  const drawEma = (period, color) => {
    if (closes.length < period) return;
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath();
    let ema = closes[0]; const k = 2 / (period + 1);
    slice.forEach((b, i) => {
      ema = closes[i] * k + ema * (1 - k);
      const x = PAD.left + (i / (n - 1)) * cW;
      const y = PAD.top + cH - ((ema - minP) / range) * cH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  drawEma(9,  'rgba(0,212,255,0.65)');
  drawEma(21, 'rgba(255,215,64,0.5)');

  // Candles
  slice.forEach((bar, i) => {
    const x  = PAD.left + (i / (n - 1)) * cW;
    const yH = PAD.top + cH - ((bar.high  - minP) / range) * cH;
    const yL = PAD.top + cH - ((bar.low   - minP) / range) * cH;
    const yO = PAD.top + cH - ((bar.open  - minP) / range) * cH;
    const yC = PAD.top + cH - ((bar.close - minP) / range) * cH;
    const bull = bar.close >= bar.open;
    const col = bull ? '#00e676' : '#ff3d5a';
    ctx.strokeStyle = col; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x, yH); ctx.lineTo(x, yL); ctx.stroke();
    ctx.fillStyle = col; ctx.globalAlpha = 0.85;
    ctx.fillRect(x - barW / 2, Math.min(yO, yC), barW, Math.max(1, Math.abs(yO - yC)));
    ctx.globalAlpha = 1;
  });

  // Draw open positions for this sym
  SHADOW.positions.filter(p => p.sym === sym).forEach(pos => {
    const y = PAD.top + cH - ((pos.entryPrice - minP) / range) * cH;
    if (y < PAD.top || y > PAD.top + cH) return;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = pos.dir === 'BUY' ? '#00e676' : '#ff3d5a';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = pos.dir === 'BUY' ? '#00e676' : '#ff3d5a';
    ctx.font = 'bold 9px Share Tech Mono,monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${pos.dir === 'BUY' ? '▲' : '▼'} ${pos.entryPrice.toFixed(2)}`, W - PAD.right - 2, y - 3);

    if (pos.stop) {
      const ys = PAD.top + cH - ((pos.stop - minP) / range) * cH;
      if (ys >= PAD.top && ys <= PAD.top + cH) {
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = '#ff3d5a88'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD.left, ys); ctx.lineTo(W - PAD.right, ys); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (pos.target) {
      const yt = PAD.top + cH - ((pos.target - minP) / range) * cH;
      if (yt >= PAD.top && yt <= PAD.top + cH) {
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = '#00e67688'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD.left, yt); ctx.lineTo(W - PAD.right, yt); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  });

  // Current price
  const last = slice[slice.length - 1]?.close;
  if (last) {
    const y = PAD.top + cH - ((last - minP) / range) * cH;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ── Equity curve ──
function drawShadowEquityCurve() {
  const canvas = document.getElementById('shadowEquityChart');
  if (!canvas || SHADOW.equityCurve.length < 2) return;

  // Add current point
  const curEquity = SHADOW.capital + calcShadowUnrealizedPnl();
  const curve = [...SHADOW.equityCurve, curEquity];

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  if (!W || !H) return;

  const minV = Math.min(...curve) * 0.998;
  const maxV = Math.max(...curve) * 1.002;
  const range = maxV - minV || 1;
  const PAD = { top: 8, right: 8, bottom: 20, left: 70 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const isDark = document.body.classList.contains('dark');

  ctx.fillStyle = isDark ? '#111620' : '#fff';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = isDark ? '#1e2535' : '#d0daea'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 3; i++) {
    const y = PAD.top + (cH / 3) * i;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    const v = maxV - (range / 3) * i;
    ctx.fillStyle = isDark ? '#7a8fb5' : '#4a5a7a';
    ctx.font = `9px 'Share Tech Mono',monospace`;
    ctx.textAlign = 'right';
    ctx.fillText((v / 1000).toFixed(1) + 'k', PAD.left - 4, y + 3);
  }

  // Baseline
  const baseY = PAD.top + cH - ((SHADOW.initialCapital - minV) / range) * cH;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = isDark ? '#3d5080' : '#b0bbd0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD.left, baseY); ctx.lineTo(W - PAD.right, baseY); ctx.stroke();
  ctx.setLineDash([]);

  // Fill + line
  const lastVal = curve[curve.length - 1];
  const isPositive = lastVal >= SHADOW.initialCapital;
  const lineColor = isPositive ? '#00e676' : '#ff3d5a';

  ctx.beginPath();
  curve.forEach((v, i) => {
    const x = PAD.left + (i / (curve.length - 1)) * cW;
    const y = PAD.top + cH - ((v - minV) / range) * cH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(PAD.left + cW, PAD.top + cH);
  ctx.lineTo(PAD.left, PAD.top + cH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
  grad.addColorStop(0, isPositive ? 'rgba(0,230,118,0.25)' : 'rgba(255,61,90,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0.01)');
  ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath();
  curve.forEach((v, i) => {
    const x = PAD.left + (i / (curve.length - 1)) * cW;
    const y = PAD.top + cH - ((v - minV) / range) * cH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = lineColor; ctx.lineWidth = 1.5; ctx.stroke();
}

// ── Toast notification ──
function showShadowToast(msg, isSell = false) {
  let toast = document.getElementById('sh-toast-el');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sh-toast-el';
    toast.className = 'sh-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `sh-toast ${isSell ? 'sell-toast' : ''}`;
  // force reflow
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(SHADOW.toastTimer);
  SHADOW.toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ── CSV Export ──
function exportShadowCSV() {
  if (!SHADOW.trades.length) return showShadowToast('Ingen historik att exportera', true);
  const header = ['Datum','Tid','Instrument','Riktning','Antal','Pris in','Pris ut','P&L (kr)','P&L (%)','Courtage','R/R'];
  const rows = SHADOW.trades.map(t => [
    t.closeDate, t.closeTime, t.sym, t.dir, t.qty,
    t.entryPrice.toFixed(2), t.exitPrice.toFixed(2),
    t.pnl.toFixed(2), t.pnlPct.toFixed(2), '29', t.rr,
  ]);
  const csv = [header, ...rows].map(r => r.join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `shadow-trading-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showShadowToast('Handelshistorik exporterad som CSV');
}
