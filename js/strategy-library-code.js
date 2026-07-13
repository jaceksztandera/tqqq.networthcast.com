// Custom-strategy code for the Strategy Library. Each value is a pure object
// literal per the app's custom-strategy contract: { name, params, run(data, p) }.
// Self-contained (the sandbox worker evals each in isolation — no shared helpers).
// Verified over 1990–2025 / 2000–2008 / 2010–2025 via scratchpad/verify3.js.
//
// Browser: exposes window.STRATEGY_CODE. Node: module.exports (for the backtest).
const CODE = {};

// #1 Faber 10-month: QQQ vs 200-SMA checked ONLY on the last trading day of each month.
CODE[1] = `{
  name: "Faber 10-mo / 200-day (monthly) → TQQQ/cash",
  params: [{ id: "window", label: "SMA window (days)", options: [150, 200, 250], default: 200 }],
  run(data, p) {
    const log = [], W = p.window, sig = data.qqq, lev = data.tqqq;
    let cash = p.initial, sh = 0, invested = false, prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      const px = lev[i];
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (monthEnd) {
        let sum = 0, n = 0;
        for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (sig[k] > 0) { sum += sig[k]; n++; } }
        const sma = n ? sum / n : 0, bull = sma > 0 && sig[i] > sma;
        if (bull && !invested && px > 0) { sh = cash / px; cash = 0; invested = true; action = "buy"; }
        else if (!bull && invested) { cash = sh * px; sh = 0; invested = false; action = "sell"; }
      }
      if (invested && cash > 0 && px > 0) { sh += cash / px; cash = 0; }
      if (contributed > 0 || action === "buy" || action === "sell" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #2 Gayed LRS 3×: SPY vs 200-SMA daily → SPXL (3× S&P) else cash.
CODE[2] = `{
  name: "Gayed LRS 3× — SPY 200SMA → SPXL/cash",
  params: [{ id: "window", label: "SMA window (days)", options: [150, 200, 250], default: 200 }],
  run(data, p) {
    const log = [], W = p.window, sig = data.spy, lev = data.spxl;
    let cash = p.initial, sh = 0, invested = false, prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (sig[k] > 0) { sum += sig[k]; n++; } }
      const sma = n ? sum / n : 0, px = lev[i], bull = sma > 0 && sig[i] > sma;
      if (bull && !invested && px > 0) { sh = cash / px; cash = 0; invested = true; action = "buy"; }
      else if (!bull && invested) { cash = sh * px; sh = 0; invested = false; action = "sell"; }
      else if (invested && cash > 0 && px > 0) { sh += cash / px; cash = 0; }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "sell" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #3 Gayed LRS 2×: SPY vs 200-SMA daily → SSO (2× S&P) else cash.
CODE[3] = `{
  name: "Gayed LRS 2× — SPY 200SMA → SSO/cash",
  params: [{ id: "window", label: "SMA window (days)", options: [150, 200, 250], default: 200 }],
  run(data, p) {
    const log = [], W = p.window, sig = data.spy, lev = data.sso;
    let cash = p.initial, sh = 0, invested = false, prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (sig[k] > 0) { sum += sig[k]; n++; } }
      const sma = n ? sum / n : 0, px = lev[i], bull = sma > 0 && sig[i] > sma;
      if (bull && !invested && px > 0) { sh = cash / px; cash = 0; invested = true; action = "buy"; }
      else if (!bull && invested) { cash = sh * px; sh = 0; invested = false; action = "sell"; }
      else if (invested && cash > 0 && px > 0) { sh += cash / px; cash = 0; }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "sell" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #8 Siegel ±band: SPY vs 200-SMA symmetric band → TQQQ/cash.
CODE[8] = `{
  name: "Siegel ±band SPY 200SMA → TQQQ/cash",
  params: [{ id: "band", label: "Band (% around SMA)", options: [0, 1, 2, 3], default: 1 },
           { id: "window", label: "SMA window", options: [150, 200, 250], default: 200 }],
  run(data, p) {
    const log = [], W = p.window, sig = data.spy, lev = data.tqqq, up = 1 + p.band / 100, dn = 1 - p.band / 100;
    let cash = p.initial, sh = 0, invested = false, prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (sig[k] > 0) { sum += sig[k]; n++; } }
      const sma = n ? sum / n : 0, px = lev[i], s = sig[i];
      if (sma > 0 && s > 0) {
        if (!invested && s >= sma * up && px > 0) { sh = cash / px; cash = 0; invested = true; action = "buy"; }
        else if (invested && s <= sma * dn) { cash = sh * px; sh = 0; invested = false; action = "sell"; }
      }
      if (invested && cash > 0 && px > 0) { sh += cash / px; cash = 0; }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "sell" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #9 Canonical (SPY signal) 200-SMA → TQQQ/cash.
CODE[9] = `{
  name: "Canonical SPY 200SMA → TQQQ/cash",
  params: [{ id: "signal", label: "Signal", options: ["spy", "qqq"], default: "spy" },
           { id: "window", label: "SMA window", options: [100, 150, 200, 250], default: 200 }],
  run(data, p) {
    const log = [], W = p.window, sig = data[p.signal], lev = data.tqqq;
    let cash = p.initial, sh = 0, invested = false, prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (sig[k] > 0) { sum += sig[k]; n++; } }
      const sma = n ? sum / n : 0, px = lev[i], bull = sma > 0 && sig[i] > sma;
      if (bull && !invested && px > 0) { sh = cash / px; cash = 0; invested = true; action = "buy"; }
      else if (!bull && invested) { cash = sh * px; sh = 0; invested = false; action = "sell"; }
      else if (invested && cash > 0 && px > 0) { sh += cash / px; cash = 0; }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "sell" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #10 Canonical QQQ 200SMA → TQQQ else cash.
CODE[10] = `{
  name: "QQQ 200-day SMA → TQQQ else cash",
  params: [{ id: "signal", label: "Signal asset", options: ["qqq", "spy"], default: "qqq" },
           { id: "lev", label: "Leveraged ETF", options: ["tqqq", "qld", "sso", "spxl"], default: "tqqq" },
           { id: "window", label: "SMA window (days)", options: [100, 150, 200, 250], default: 200 }],
  run(data, p) {
    const log = [], W = p.window, sig = data[p.signal], lev = data[p.lev];
    let cash = p.initial, sh = 0, invested = false, prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (sig[k] > 0) { sum += sig[k]; n++; } }
      const sma = n ? sum / n : 0, px = lev[i], bull = sma > 0 && sig[i] > sma;
      if (bull && !invested && px > 0) { sh = cash / px; cash = 0; invested = true; action = "buy"; }
      else if (!bull && invested) { cash = sh * px; sh = 0; invested = false; action = "sell"; }
      else if (invested && cash > 0 && px > 0) { sh += cash / px; cash = 0; }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "sell" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #11 SPY 200SMA → UPRO (SPXL 3× S&P) else cash.
CODE[11] = `{
  name: "SPY 200SMA → UPRO (SPXL) / cash",
  params: [{ id: "window", label: "SMA window", options: [150, 200, 250], default: 200 }],
  run(data, p) {
    const log = [], W = p.window, sig = data.spy, lev = data.spxl;
    let cash = p.initial, sh = 0, invested = false, prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (sig[k] > 0) { sum += sig[k]; n++; } }
      const sma = n ? sum / n : 0, px = lev[i], bull = sma > 0 && sig[i] > sma;
      if (bull && !invested && px > 0) { sh = cash / px; cash = 0; invested = true; action = "buy"; }
      else if (!bull && invested) { cash = sh * px; sh = 0; invested = false; action = "sell"; }
      else if (invested && cash > 0 && px > 0) { sh += cash / px; cash = 0; }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "sell" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #12 SSO own-price 200SMA → SSO else cash.
CODE[12] = `{
  name: "SSO own 200SMA → SSO/cash (2×)",
  params: [{ id: "window", label: "SMA window", options: [150, 200, 250], default: 200 }],
  run(data, p) {
    const log = [], W = p.window, lev = data.sso;
    let cash = p.initial, sh = 0, invested = false, prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (lev[k] > 0) { sum += lev[k]; n++; } }
      const sma = n ? sum / n : 0, px = lev[i], bull = sma > 0 && px > sma;
      if (bull && !invested && px > 0) { sh = cash / px; cash = 0; invested = true; action = "buy"; }
      else if (!bull && invested) { cash = sh * px; sh = 0; invested = false; action = "sell"; }
      else if (invested && cash > 0 && px > 0) { sh += cash / px; cash = 0; }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "sell" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #13 Hollywood SPY 200SMA +4/-3 → TQQQ/QQQ.
CODE[13] = `{
  name: "Hollywood SPY 200SMA +4/-3 → TQQQ/QQQ",
  params: [{ id: "entry", label: "Enter band (% above)", options: [0, 2, 3, 4, 5], default: 4 },
           { id: "exit", label: "Exit band (% below)", options: [0, 2, 3, 4, 5], default: 3 },
           { id: "window", label: "SMA window", options: [100, 150, 200, 250], default: 200 }],
  run(data, p) {
    const log = [], W = p.window, sig = data.spy, up = 1 + p.entry / 100, dn = 1 - p.exit / 100;
    let cash = p.initial, shT = 0, shQ = 0, state = "qqq", prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (sig[k] > 0) { sum += sig[k]; n++; } }
      const sma = n ? sum / n : 0, px = sig[i];
      if (sma > 0 && px > 0) { if (px >= sma * up) state = "tqqq"; else if (px <= sma * dn) state = "qqq"; }
      const pxT = data.tqqq[i], pxQ = data.qqq[i], cur = shT > 0 ? "tqqq" : (shQ > 0 ? "qqq" : "none");
      if (state !== cur && pxT > 0 && pxQ > 0) {
        cash += shT * pxT + shQ * pxQ; shT = 0; shQ = 0;
        if (state === "tqqq") shT = cash / pxT; else shQ = cash / pxQ;
        cash = 0; action = state === "tqqq" ? "buy TQQQ" : "derisk QQQ";
      } else if (cash > 0) {
        if (state === "tqqq" && pxT > 0) { shT += cash / pxT; cash = 0; }
        else if (state === "qqq" && pxQ > 0) { shQ += cash / pxQ; cash = 0; }
      }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action.indexOf("buy") === 0 || action.indexOf("derisk") === 0 || monthEnd)
        log.push({ date: data.dates[i], value: shT * pxT + shQ * pxQ + cash, price: pxT, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #15 Composer: QQQ 200-SMA trend AND RSI(14) not overbought → TQQQ else cash.
CODE[15] = `{
  name: "Composer 200MA + RSI trend → TQQQ/cash",
  params: [{ id: "rsiMax", label: "Max RSI(14) to hold", options: [60, 70, 80, 100], default: 80 },
           { id: "window", label: "SMA window", options: [150, 200, 250], default: 200 }],
  run(data, p) {
    const log = [], W = p.window, RW = 14, sig = data.qqq, lev = data.tqqq;
    const seed = Math.max(1, p.startIdx - 60);
    let ag = 0, al = 0;
    for (let i = seed; i < seed + RW && i <= p.startIdx; i++) { const d = sig[i] - sig[i - 1]; if (d > 0) ag += d; else al -= d; }
    ag /= RW; al /= RW;
    for (let i = seed + RW; i < p.startIdx; i++) { const d = sig[i] - sig[i - 1], g = d > 0 ? d : 0, l = d < 0 ? -d : 0; ag = (ag * (RW - 1) + g) / RW; al = (al * (RW - 1) + l) / RW; }
    let cash = p.initial, sh = 0, invested = false, prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      const d = sig[i] - sig[i - 1], g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
      ag = (ag * (RW - 1) + g) / RW; al = (al * (RW - 1) + l) / RW;
      const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (sig[k] > 0) { sum += sig[k]; n++; } }
      const sma = n ? sum / n : 0, px = lev[i], bull = sma > 0 && sig[i] > sma && rsi < p.rsiMax;
      if (bull && !invested && px > 0) { sh = cash / px; cash = 0; invested = true; action = "buy"; }
      else if (!bull && invested) { cash = sh * px; sh = 0; invested = false; action = "sell"; }
      else if (invested && cash > 0 && px > 0) { sh += cash / px; cash = 0; }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "sell" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #17 MACD(12/26/9) on QQQ → TQQQ/cash + trailing stop.
CODE[17] = `{
  name: "MACD(12/26) → TQQQ/cash (+trailing stop)",
  params: [{ id: "trail", label: "Trailing stop (% from peak)", options: [0, 20, 30, 40], default: 30 }],
  run(data, p) {
    const log = [], sig = data.qqq, lev = data.tqqq;
    const seed = Math.max(0, p.startIdx - 60);
    let e12 = sig[seed] || 0, e26 = sig[seed] || 0, macd = 0, signal = 0;
    const k12 = 2 / 13, k26 = 2 / 27, k9 = 2 / 10;
    for (let i = seed + 1; i < p.startIdx; i++) { if (sig[i] > 0) { e12 += k12 * (sig[i] - e12); e26 += k26 * (sig[i] - e26); macd = e12 - e26; signal += k9 * (macd - signal); } }
    let cash = p.initial, sh = 0, invested = false, prevMonth = null, peak = 0;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4)), trail = p.trail / 100;
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      const s = sig[i], px = lev[i];
      if (s > 0) { e12 += k12 * (s - e12); e26 += k26 * (s - e26); macd = e12 - e26; signal += k9 * (macd - signal); }
      const bull = macd > signal && macd > 0;
      if (invested && px > peak) peak = px;
      const stopped = invested && trail > 0 && px > 0 && px < peak * (1 - trail);
      if (bull && !invested && px > 0) { sh = cash / px; cash = 0; invested = true; peak = px; action = "buy"; }
      else if ((!bull || stopped) && invested) { cash = sh * px; sh = 0; invested = false; action = stopped ? "stop" : "sell"; }
      else if (invested && cash > 0 && px > 0) { sh += cash / px; cash = 0; }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "sell" || action === "stop" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #18 40-week SMA crossover: QQQ vs 200-day SMA checked WEEKLY (last trading day of ISO week).
CODE[18] = `{
  name: "40-week SMA (weekly) → TQQQ/cash",
  params: [{ id: "window", label: "SMA window (days)", options: [150, 200, 250], default: 200 }],
  run(data, p) {
    const log = [], W = p.window, sig = data.qqq, lev = data.tqqq;
    let cash = p.initial, sh = 0, invested = false, prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    const dow = (ds) => new Date(Date.UTC(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8, 10))).getUTCDay();
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      const px = lev[i];
      const weekEnd = i === p.endIdx || dow(data.dates[i + 1]) <= dow(data.dates[i]);
      if (weekEnd) {
        let sum = 0, n = 0;
        for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (sig[k] > 0) { sum += sig[k]; n++; } }
        const sma = n ? sum / n : 0, bull = sma > 0 && sig[i] > sma;
        if (bull && !invested && px > 0) { sh = cash / px; cash = 0; invested = true; action = "buy"; }
        else if (!bull && invested) { cash = sh * px; sh = 0; invested = false; action = "sell"; }
      }
      if (invested && cash > 0 && px > 0) { sh += cash / px; cash = 0; }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "sell" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #19 Golden/Death cross 50/200 on QQQ → TQQQ/cash.
CODE[19] = `{
  name: "Golden/Death Cross 50/200 → TQQQ/cash",
  params: [{ id: "fast", label: "Fast SMA", options: [20, 50, 100], default: 50 },
           { id: "slow", label: "Slow SMA", options: [150, 200, 250], default: 200 }],
  run(data, p) {
    const log = [], F = p.fast, S = p.slow, sig = data.qqq, lev = data.tqqq;
    let cash = p.initial, sh = 0, invested = false, prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      let sf = 0, nf = 0; for (let k = Math.max(0, i - F + 1); k <= i; k++) { if (sig[k] > 0) { sf += sig[k]; nf++; } }
      let ss = 0, ns = 0; for (let k = Math.max(0, i - S + 1); k <= i; k++) { if (sig[k] > 0) { ss += sig[k]; ns++; } }
      const maF = nf ? sf / nf : 0, maS = ns ? ss / ns : 0, px = lev[i], bull = maS > 0 && maF > maS;
      if (bull && !invested && px > 0) { sh = cash / px; cash = 0; invested = true; action = "buy"; }
      else if (!bull && invested) { cash = sh * px; sh = 0; invested = false; action = "sell"; }
      else if (invested && cash > 0 && px > 0) { sh += cash / px; cash = 0; }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "sell" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #20 Volatility targeting: hold TQQQ scaled so trailing vol ≈ target; rest cash. Rebalance monthly.
CODE[20] = `{
  name: "Vol-target TQQQ (scale to target vol)",
  params: [{ id: "target", label: "Target vol (%/yr)", options: [15, 20, 25, 30], default: 25 },
           { id: "lookback", label: "Vol lookback (days)", options: [20, 40, 60], default: 20 }],
  run(data, p) {
    const log = [], lev = data.tqqq, L = p.lookback, tgt = p.target / 100;
    let cash = p.initial, sh = 0, prevMonth = null, w = 0;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      const px = lev[i], newMonth = prevMonth === null || month !== prevMonth;
      prevMonth = month;
      if (newMonth && px > 0) {
        let m = 0, c = 0; const r = [];
        for (let k = Math.max(1, i - L + 1); k <= i; k++) { if (lev[k] > 0 && lev[k - 1] > 0) { const ret = lev[k] / lev[k - 1] - 1; r.push(ret); m += ret; c++; } }
        m = c ? m / c : 0; let v = 0; for (const x of r) v += (x - m) * (x - m); v = c ? Math.sqrt(v / c) * Math.sqrt(252) : 0;
        const targetW = v > 0 ? Math.max(0, Math.min(1, tgt / v)) : 0;
        const total = sh * px + cash;
        sh = (total * targetW) / px; cash = total - sh * px; w = targetW; action = "rebalance";
      }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "rebalance" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action, weight: w });
    }
    return { log };
  }
}`;

// #22 Connors RSI(2) dip-buy within a 200-SMA uptrend.
CODE[22] = `{
  name: "Connors RSI(2) dip-buy (200SMA trend)",
  params: [{ id: "buy", label: "Buy RSI(2) below", options: [5, 10, 15], default: 10 },
           { id: "sell", label: "Sell RSI(2) above", options: [60, 70, 80], default: 70 }],
  run(data, p) {
    const log = [], W = 200, RW = 2, sig = data.qqq, lev = data.tqqq;
    const seed = Math.max(1, p.startIdx - 30);
    let ag = 0, al = 0;
    for (let i = seed; i < seed + RW && i <= p.startIdx; i++) { const d = sig[i] - sig[i - 1]; if (d > 0) ag += d; else al -= d; }
    ag /= RW; al /= RW;
    for (let i = seed + RW; i < p.startIdx; i++) { const d = sig[i] - sig[i - 1], g = d > 0 ? d : 0, l = d < 0 ? -d : 0; ag = (ag * (RW - 1) + g) / RW; al = (al * (RW - 1) + l) / RW; }
    let cash = p.initial, sh = 0, invested = false, prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      const d = sig[i] - sig[i - 1], g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
      ag = (ag * (RW - 1) + g) / RW; al = (al * (RW - 1) + l) / RW;
      const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (sig[k] > 0) { sum += sig[k]; n++; } }
      const sma = n ? sum / n : 0, px = lev[i], up = sma > 0 && sig[i] > sma;
      if (up && !invested && rsi < p.buy && px > 0) { sh = cash / px; cash = 0; invested = true; action = "buy"; }
      else if (invested && (!up || rsi > p.sell)) { cash = sh * px; sh = 0; invested = false; action = "sell"; }
      else if (invested && cash > 0 && px > 0) { sh += cash / px; cash = 0; }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "sell" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #23 TFTLT: QQQ 200SMA → TQQQ, RSI(10) overheat exit + cool-gate re-entry.
CODE[23] = `{
  name: "TFTLT: 200SMA + RSI(10) overheat/cool",
  params: [{ id: "oh", label: "Overheat exit RSI(10) ≥", options: [60, 70, 80, 100], default: 80 },
           { id: "cool", label: "Cool-gate re-entry RSI(10) <", options: [40, 50, 60, 100], default: 60 }],
  run(data, p) {
    const log = [], W = 200, RW = 10, sig = data.qqq, lev = data.tqqq;
    const seed = Math.max(1, p.startIdx - 40);
    let ag = 0, al = 0;
    for (let i = seed; i < seed + RW && i <= p.startIdx; i++) { const d = sig[i] - sig[i - 1]; if (d > 0) ag += d; else al -= d; }
    ag /= RW; al /= RW;
    for (let i = seed + RW; i < p.startIdx; i++) { const d = sig[i] - sig[i - 1], g = d > 0 ? d : 0, l = d < 0 ? -d : 0; ag = (ag * (RW - 1) + g) / RW; al = (al * (RW - 1) + l) / RW; }
    let cash = p.initial, sh = 0, invested = false, prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      const d = sig[i] - sig[i - 1], g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
      ag = (ag * (RW - 1) + g) / RW; al = (al * (RW - 1) + l) / RW;
      const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (sig[k] > 0) { sum += sig[k]; n++; } }
      const sma = n ? sum / n : 0, px = lev[i], up = sma > 0 && sig[i] > sma;
      const wantIn = up && rsi < p.oh && (invested || rsi < p.cool);
      if (wantIn && !invested && px > 0) { sh = cash / px; cash = 0; invested = true; action = "buy"; }
      else if (!wantIn && invested) { cash = sh * px; sh = 0; invested = false; action = "sell"; }
      else if (invested && cash > 0 && px > 0) { sh += cash / px; cash = 0; }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "sell" || monthEnd)
        log.push({ date: data.dates[i], value: sh * px + cash, price: px, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #24 200SMA + Bodyguard (delever to QQQ, GTFO to cash).
CODE[24] = `{
  name: "200SMA + Bodyguard (delever/GTFO)",
  params: [{ id: "delev", label: "Delever→QQQ at (% above SMA)", options: [0, 20, 25, 30, 35, 40], default: 30 },
           { id: "gtfo", label: "Sell→cash at (% above SMA)", options: [0, 35, 40, 45, 50], default: 40 },
           { id: "window", label: "SMA window", options: [150, 200, 250], default: 200 }],
  run(data, p) {
    const log = [], W = p.window, sig = data.qqq;
    let cash = p.initial, shT = 0, shQ = 0, prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (sig[k] > 0) { sum += sig[k]; n++; } }
      const sma = n ? sum / n : 0, q = sig[i], aboveBy = sma > 0 ? (q / sma - 1) * 100 : 0;
      let want;
      if (sma <= 0 || q <= 0 || q < sma) want = "cash";
      else if (p.gtfo > 0 && aboveBy >= p.gtfo) want = "cash";
      else if (p.delev > 0 && aboveBy >= p.delev) want = "qqq";
      else want = "tqqq";
      const pxT = data.tqqq[i], pxQ = data.qqq[i], cur = shT > 0 ? "tqqq" : (shQ > 0 ? "qqq" : "cash");
      if (want !== cur && pxT > 0 && pxQ > 0) {
        cash += shT * pxT + shQ * pxQ; shT = 0; shQ = 0;
        if (want === "tqqq") { shT = cash / pxT; cash = 0; } else if (want === "qqq") { shQ = cash / pxQ; cash = 0; }
        action = want === "tqqq" ? "buy" : (want === "qqq" ? "delever" : "gtfo");
      } else if (cash > 0) {
        if (want === "tqqq" && pxT > 0) { shT += cash / pxT; cash = 0; }
        else if (want === "qqq" && pxQ > 0) { shQ += cash / pxQ; cash = 0; }
      }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "delever" || action === "gtfo" || monthEnd)
        log.push({ date: data.dates[i], value: shT * pxT + shQ * pxQ + cash, price: pxT, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// #25 Always-invested: 200SMA → TQQQ else QQQ (park in unleveraged, not cash).
CODE[25] = `{
  name: "200SMA → TQQQ else QQQ (always in)",
  params: [{ id: "signal", label: "Signal / park", options: ["qqq", "spy"], default: "qqq" },
           { id: "lev", label: "Leveraged ETF", options: ["tqqq", "qld", "sso", "spxl"], default: "tqqq" },
           { id: "window", label: "SMA window", options: [100, 150, 200, 250], default: 200 }],
  run(data, p) {
    const log = [], W = p.window, sig = data[p.signal], lev = data[p.lev];
    let cash = p.initial, shLev = 0, shPark = 0, state = "park", prevMonth = null;
    const y0 = parseInt(data.dates[p.startIdx].slice(0, 4));
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      const month = data.dates[i].slice(0, 7);
      let contributed = 0, action = "hold";
      if (prevMonth !== null && month !== prevMonth && p.monthly > 0) {
        const amt = p.monthly * Math.pow(1 + (p.annualRaise || 0), parseInt(month.slice(0, 4)) - y0);
        cash += amt; contributed = amt; action = "contribution";
      }
      prevMonth = month;
      let sum = 0, n = 0;
      for (let k = Math.max(0, i - W + 1); k <= i; k++) { if (sig[k] > 0) { sum += sig[k]; n++; } }
      const sma = n ? sum / n : 0, pxL = lev[i], pxP = sig[i], want = (sma > 0 && sig[i] > sma) ? "lev" : "park";
      if (want !== state && pxL > 0 && pxP > 0) {
        cash += shLev * pxL + shPark * pxP; shLev = 0; shPark = 0;
        if (want === "lev") shLev = cash / pxL; else shPark = cash / pxP;
        cash = 0; state = want; action = want === "lev" ? "buy" : "derisk";
      } else if (cash > 0) {
        if (state === "lev" && pxL > 0) { shLev += cash / pxL; cash = 0; }
        else if (state === "park" && pxP > 0) { shPark += cash / pxP; cash = 0; }
      }
      const monthEnd = i === p.endIdx || data.dates[i + 1].slice(0, 7) !== month;
      if (contributed > 0 || action === "buy" || action === "derisk" || monthEnd)
        log.push({ date: data.dates[i], value: shLev * pxL + shPark * pxP + cash, price: pxL, contributed: contributed, action: action });
    }
    return { log };
  }
}`;

// Browser global + Node export.
if (typeof window !== 'undefined') window.STRATEGY_CODE = CODE;
if (typeof module !== 'undefined' && module.exports) module.exports = CODE;
