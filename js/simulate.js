function createTaxLots(taxRate) {
  const lots = [];
  const rate = Math.max(0, +taxRate || 0);
  return {
    buy(shares, price) {
      if (shares > 0 && price > 0) lots.push({ shares, cost: price });
    },
    sell(shares, price) {
      let remaining = Math.max(0, shares || 0);
      let realizedGain = 0;
      while (remaining > 1e-12 && lots.length) {
        const lot = lots[0];
        const take = Math.min(remaining, lot.shares);
        realizedGain += take * (price - lot.cost);
        lot.shares -= take;
        remaining -= take;
        if (lot.shares <= 1e-12) lots.shift();
      }
      return { realizedGain, taxPaid: Math.max(0, realizedGain) * rate };
    },
  };
}

function accrueCashInterest(cash, monthlyRate, taxRate) {
  if (!(cash > 0) || !monthlyRate) return { cash, taxPaid: 0 };
  const interest = cash * monthlyRate;
  const taxPaid = interest > 0 ? interest * Math.max(0, +taxRate || 0) : 0;
  return { cash: cash + interest - taxPaid, taxPaid };
}

function mapQuarterlyWindowToPeriod(entryIdx, exitIdx, period, qData) {
  if (period !== 'quarterly' && quarterlyData && qData && qData !== quarterlyData) {
    const entryDate = quarterlyData[entryIdx] && quarterlyData[entryIdx][0];
    const exitDate  = quarterlyData[exitIdx]  && quarterlyData[exitIdx][0];
    if (entryDate && exitDate) {
      let e = 0, x = qData.length - 1;
      for (let i = 0; i < qData.length; i++) { if (qData[i][0] <= entryDate) e = i; else break; }
      for (let i = qData.length - 1; i >= 0; i--) { if (qData[i][0] >= exitDate) x = i; else break; }
      return { entryIdx: e, exitIdx: x };
    }
  }
  return { entryIdx, exitIdx };
}

function simulateFixedSplit(initial, monthly, annualRate, entryIdx, exitIdx, annualRaise, opts) {
  opts = opts || {};
  annualRaise = annualRaise || 0;
  const period = opts.rebalancePeriod || 'quarterly';
  const periodData = (typeof periodDataByName !== 'undefined' && periodDataByName && periodDataByName[period]) || null;
  const qData = opts.qData || periodData || quarterlyData;
  const mapped = mapQuarterlyWindowToPeriod(entryIdx, exitIdx, period, qData);
  entryIdx = mapped.entryIdx;
  exitIdx = mapped.exitIdx;

  const qSlice = qData ? qData.slice(entryIdx, exitIdx + 1) : [];
  if (qSlice.length < 2) return { log: [], fixedPoints: [], totalContributed: initial };

  const ulCol = opts.underlyingCol != null ? +opts.underlyingCol : 1;
  const targetPct = Math.max(0, Math.min(1, (opts.stockPct != null ? +opts.stockPct : 75) / 100));
  const monthlyRate = (+annualRate || 0) / 12;
  const taxLots = createTaxLots(opts.taxRate);

  const p0 = qSlice[0][ulCol] || 0;
  let cash = initial * (1 - targetPct);
  let shares = p0 > 0 ? (initial * targetPct) / p0 : 0;
  taxLots.buy(shares, p0);
  let totalInvested = initial;
  let currentMonthly = monthly;
  const startYear = parseInt(qSlice[0][0].substring(0, 4));
  let prevDate = qSlice[0][0];
  const log = [];

  function row(date, price, action, taxInfo) {
    const stockVal = shares * (price || 0);
    return {
      date,
      price: price || 0,
      shares,
      stockVal,
      cash,
      total: stockVal + cash,
      invested: totalInvested,
      stockPct: targetPct * 100,
      cashPct: (1 - targetPct) * 100,
      action,
      realizedGain: (taxInfo && taxInfo.realizedGain) || 0,
      taxPaid: (taxInfo && taxInfo.taxPaid) || 0,
    };
  }

  log.push(row(qSlice[0][0], p0, 'START', null));

  for (let qi = 1; qi < qSlice.length; qi++) {
    const qDate = qSlice[qi][0];
    const qPrice = qSlice[qi][ulCol] || 0;
    const currentYear = parseInt(qDate.substring(0, 4));
    currentMonthly = monthly * Math.pow(1 + annualRaise, currentYear - startYear);
    let taxInfo = { realizedGain: 0, taxPaid: 0 };

    for (const m of monthlyData || []) {
      if (m[0] <= prevDate || m[0] > qDate) continue;
      const mPrice = m[ulCol] || 0;
      const toStock = currentMonthly * targetPct;
      if (toStock > 0 && mPrice > 0) {
        const bought = toStock / mPrice;
        shares += bought;
        taxLots.buy(bought, mPrice);
      } else {
        cash += toStock;
      }
      cash += currentMonthly * (1 - targetPct);
      totalInvested += currentMonthly;
      const accrual = accrueCashInterest(cash, monthlyRate, opts.taxRate);
      cash = accrual.cash;
      taxInfo.taxPaid += accrual.taxPaid;
    }

    let action = 'HOLD';
    if (qPrice > 0) {
      let total = shares * qPrice + cash;
      let targetStockVal = total * targetPct;
      let delta = targetStockVal - shares * qPrice;
      if (delta > 1e-9) {
        const buyAmt = Math.min(delta, cash);
        if (buyAmt > 1e-9) {
          const bought = buyAmt / qPrice;
          shares += bought;
          taxLots.buy(bought, qPrice);
          cash -= buyAmt;
          action = 'BUY ' + fmt(buyAmt);
        }
      } else if (delta < -1e-9) {
        let sellAmt = 0;
        for (let k = 0; k < 20; k++) {
          total = shares * qPrice + cash;
          targetStockVal = total * targetPct;
          const excess = shares * qPrice - targetStockVal;
          if (excess <= 1e-7) break;
          const chunk = Math.min(excess, shares * qPrice);
          const sold = chunk / qPrice;
          const thisTax = taxLots.sell(sold, qPrice);
          shares -= sold;
          cash += chunk - thisTax.taxPaid;
          sellAmt += chunk;
          taxInfo.realizedGain += thisTax.realizedGain;
          taxInfo.taxPaid += thisTax.taxPaid;
        }
        if (sellAmt > 1e-9) action = 'SELL ' + fmt(sellAmt);
      }
    }

    log.push(row(qDate, qPrice, action, taxInfo));
    prevDate = qDate;
  }

  return {
    log,
    fixedPoints: log.map(l => ({ date: l.date, value: l.total, state: 'in' })),
    totalContributed: totalInvested,
  };
}

// ETF/JEPQ paired strategy.
//
// Starts with the portfolio split between a growth ETF (col opts.underlyingCol,
// default TQQQ col 1) and JEPQ (col 8) at opts.ulPct / (1-opts.ulPct) ratio
// (default 50/50).  Each month:
//   1. JEPQ distributes per-share income (from jepqDistributionMap). The net
//      after tax is reinvested into whichever asset currently has the lower value.
//   2. Monthly contribution (if any) is invested into the lesser-valued asset.
//   3. If either leg's actual fraction >= rebalanceThreshold × its desired fraction,
//      sell the excess of the larger position back to the configured ulPct target.
//      Tax on realized gains is paid from the sale proceeds (FIFO).
//   4. Rebalancing is skipped when fewer than rebalanceCooldownMonths have elapsed
//      since the last rebalance (prevents whipsawing in volatile periods).
//
// All sells go through createTaxLots() at opts.taxRate (default 0).
// opts.rebalanceThreshold      — overweight multiplier that triggers rebalancing (default 1.5).
// opts.rebalanceCooldownMonths — minimum months between rebalances (default 0 = no cooldown).
// opts.underlyingCol           — column index for the growth ETF (default 1 = TQQQ).
// opts.ulPct                   — fraction of portfolio in growth ETF (default 0.5).
// opts.jepqDistMap             — Map<YYYY-MM-DD, amountPerShare> (uses global
//                                jepqDistributionMap if not provided).
function simulateTQQQJEPQ(initial, monthly, annualRate, entryIdx, exitIdx, annualRaise, opts) {
  opts = opts || {};
  annualRaise = annualRaise || 0;
  const rebalThreshold    = opts.rebalanceThreshold != null ? +opts.rebalanceThreshold : 1.5;
  const cooldownMonths    = opts.rebalanceCooldownMonths != null ? +opts.rebalanceCooldownMonths : 0;
  const taxRate        = opts.taxRate != null ? +opts.taxRate : 0;
  const ulPct          = opts.ulPct != null ? Math.max(0.01, Math.min(0.99, +opts.ulPct)) : 0.5;
  const distMap        = opts.jepqDistMap ||
    (typeof jepqDistributionMap !== 'undefined' ? jepqDistributionMap : new Map());
  const monthlyRate    = (+annualRate || 0) / 12;

  const UL_COL = opts.underlyingCol != null ? +opts.underlyingCol : 1;
  const JEPQ_COL = 8;

  // Map quarterly entry/exit to monthly indices
  const mSlice = monthlyData ? monthlyData.slice() : [];
  if (mSlice.length < 2) return { log: [], tqqjPoints: [], totalContributed: initial };

  // Find monthly start/end dates from quarterly entry/exit
  const entryDate = quarterlyData && quarterlyData[entryIdx] ? quarterlyData[entryIdx][0] : mSlice[0][0];
  const exitDate  = quarterlyData && quarterlyData[exitIdx]  ? quarterlyData[exitIdx][0]  : mSlice[mSlice.length - 1][0];
  const mStart = mSlice.findIndex(m => m[0] >= entryDate);
  let   mEnd   = mSlice.length - 1;
  for (let i = mSlice.length - 1; i >= 0; i--) { if (mSlice[i][0] <= exitDate) { mEnd = i; break; } }
  if (mStart < 0 || mEnd <= mStart) return { log: [], tqqjPoints: [], totalContributed: initial };

  const slice = mSlice.slice(mStart, mEnd + 1);

  const p0u = slice[0][UL_COL] || 0;
  const p0j = slice[0][JEPQ_COL] || 0;
  if (!p0u || !p0j) return { log: [], tqqjPoints: [], totalContributed: initial };

  const ulLots   = createTaxLots(taxRate);
  const jepqLots = createTaxLots(taxRate);

  let ulShares   = (initial * ulPct) / p0u;
  let jepqShares = (initial * (1 - ulPct)) / p0j;
  ulLots.buy(ulShares, p0u);
  jepqLots.buy(jepqShares, p0j);

  let totalInvested = initial;
  let currentMonthly = monthly;
  let lastRebalMonth = -9999;
  const startYear = parseInt(slice[0][0].substring(0, 4));
  const log = [];

  function snapshot(date, pu, pj, action, taxInfo) {
    const uv = ulShares * pu, jv = jepqShares * pj;
    return {
      date, ulPrice: pu, jepqPrice: pj,
      ulShares, jepqShares,
      ulVal: uv, jepqVal: jv,
      total: uv + jv,
      invested: totalInvested,
      action,
      realizedGain: (taxInfo && taxInfo.realizedGain) || 0,
      taxPaid:      (taxInfo && taxInfo.taxPaid) || 0,
    };
  }

  log.push(snapshot(slice[0][0], p0u, p0j, 'START', null));

  for (let mi = 1; mi < slice.length; mi++) {
    const m = slice[mi];
    const date = m[0];
    const pu = m[UL_COL] || 0;
    const pj = m[JEPQ_COL] || 0;
    if (!pu || !pj) continue;

    const currentYear = parseInt(date.substring(0, 4));
    currentMonthly = monthly * Math.pow(1 + annualRaise, currentYear - startYear);

    const taxInfo = { realizedGain: 0, taxPaid: 0 };

    // 1. JEPQ distribution — tax immediately, reinvest net into lesser asset
    const distPerShare = distMap.get(date) || 0;
    if (distPerShare > 0) {
      const gross = jepqShares * distPerShare;
      const tax   = gross * taxRate;
      const net   = gross - tax;
      taxInfo.taxPaid += tax;
      if (net > 1e-9) {
        const uv = ulShares * pu, jv = jepqShares * pj;
        if (uv <= jv && pu > 0) {
          const bought = net / pu;
          ulShares += bought;
          ulLots.buy(bought, pu);
        } else if (pj > 0) {
          const bought = net / pj;
          jepqShares += bought;
          jepqLots.buy(bought, pj);
        }
      }
    }

    // 2. Monthly contribution → lesser asset
    if (currentMonthly > 0) {
      const uv = ulShares * pu, jv = jepqShares * pj;
      if (uv <= jv && pu > 0) {
        const bought = currentMonthly / pu;
        ulShares += bought;
        ulLots.buy(bought, pu);
      } else if (pj > 0) {
        const bought = currentMonthly / pj;
        jepqShares += bought;
        jepqLots.buy(bought, pj);
      }
      totalInvested += currentMonthly;
    }

    // 3. Threshold-based rebalancing
    let action = 'HOLD';
    const uv = ulShares * pu, jv = jepqShares * pj;
    const total_val = uv + jv;
    const overweightTrigger = total_val > 1e-9 &&
      Math.max(uv / (total_val * ulPct), jv / (total_val * (1 - ulPct))) >= rebalThreshold;
    if (overweightTrigger && mi - lastRebalMonth >= Math.max(1, cooldownMonths)) {
      // Iterative sell (same approach as simulateFixedSplit) to account for
      // the fact that tax reduces proceeds, so the first sell slightly misses.
      if (uv > jv) {
        let sellAmt = 0;
        for (let k = 0; k < 20; k++) {
          const excess = ulShares * pu - (ulShares * pu + jepqShares * pj) * ulPct;
          if (excess <= 1e-7) break;
          const sold = Math.min(excess, ulShares * pu) / pu;
          const t    = ulLots.sell(sold, pu);
          ulShares -= sold;
          const net = sold * pu - t.taxPaid;
          const bought = net / pj;
          jepqShares += bought;
          jepqLots.buy(bought, pj);
          sellAmt += sold * pu;
          taxInfo.realizedGain += t.realizedGain;
          taxInfo.taxPaid      += t.taxPaid;
        }
        if (sellAmt > 1e-9) { action = 'REBAL UL→JEPQ'; lastRebalMonth = mi; }
      } else {
        let sellAmt = 0;
        for (let k = 0; k < 20; k++) {
          const excess = jepqShares * pj - (ulShares * pu + jepqShares * pj) * (1 - ulPct);
          if (excess <= 1e-7) break;
          const sold = Math.min(excess, jepqShares * pj) / pj;
          const t    = jepqLots.sell(sold, pj);
          jepqShares -= sold;
          const net = sold * pj - t.taxPaid;
          const bought = net / pu;
          ulShares += bought;
          ulLots.buy(bought, pu);
          sellAmt += sold * pj;
          taxInfo.realizedGain += t.realizedGain;
          taxInfo.taxPaid      += t.taxPaid;
        }
        if (sellAmt > 1e-9) { action = 'REBAL JEPQ→UL'; lastRebalMonth = mi; }
      }
    }

    log.push(snapshot(date, pu, pj, action, taxInfo));
  }

  return {
    log,
    tqqjPoints: log.map(l => ({ date: l.date, value: l.total })),
    totalContributed: totalInvested,
  };
}

// SMA timing strategy: hold TQQQ while the signal asset (QQQ or SPY) closes
// above its N-day simple moving average; flip to cash (earning the user's
// configured rate) when it closes below. Monthly resolution — checks the
// signal at each monthly TSV entry, matching Meb Faber's 10-month-SMA cadence
// which is the literature analogue. SMA series are precomputed in data.js.
//
// `entryIdx` / `exitIdx` are quarterly indices (same contract as simulate());
// we resolve them to monthly-data positions via a binary scan and emit one
// snapshot per quarter so the result drops straight into the chart pipeline.
//
// `state` per quarter is 'in' (holding TQQQ) or 'out' (cash) at the end of
// that quarter — the SMA strategy panel renders transition dots off this.
// Column index into monthlyData rows for each tradeable asset name.
// monthlyData layout: [date, tqqq, qqq, spy, qld, qqq5, sso, spxl]
const SMA_ASSET_COL = { tqqq: 1, qqq: 2, spy: 3, qld: 4, qqq5: 5, sso: 6, spxl: 7 };
// Unleveraged equivalent — used for the bodyguard SMA-distance check.
// (The bodyguard tracks the unleveraged underlying because the leveraged
// version's "% above its own SMA" is structurally larger and useless as a
// gauge of how stretched the underlying market is.)
const SMA_UNLEVERAGED_OF = { tqqq: 'qqq', qld: 'qqq', qqq5: 'qqq', sso: 'spy', spxl: 'spy', qqq: 'qqq', spy: 'spy' };

function simulateSMA(initial, monthly, annualRate, entryIdx, exitIdx, annualRaise, opts) {
  opts = opts || {};
  const smaAsset  = (opts.smaAsset || 'qqq').toLowerCase();
  const smaWindow = +opts.smaWindow || 200;
  const ulCol     = opts.underlyingCol != null ? +opts.underlyingCol : 1;
  const taxLotsByAsset = {};
  const taxLotsFor = (asset) => taxLotsByAsset[asset] || (taxLotsByAsset[asset] = createTaxLots(opts.taxRate));
  // Hysteresis buffers (% of SMA). Enter only when signal asset closes
  // (1 + entryBuf)% above SMA; exit only when (1 - exitBuf)% below. Default
  // 0/0 = current binary-cross behavior. Set both > 0 to mimic the
  // TradingView "+4 / -3" buffered SMA strategy.
  const entryBuf  = (+opts.entryBufferPct || 0) / 100;
  const exitBuf   = (+opts.exitBufferPct  || 0) / 100;
  // RSI overheat exit: if RSI(10) on the signal asset is above this value,
  // exit to cash even when SMA says "in" — captures the TFTLT idea. 0 = off.
  const rsiOH     = +opts.rsiOverheatThreshold || 0;
  // RSI cool-gate entry: when SMA flips back to "in", DON'T re-enter until
  // RSI(10) is below this value. Filters out buying tops by waiting for a
  // pullback within the uptrend. 0 = off (enter immediately on SMA cross).
  const rsiCool   = +opts.rsiCoolThreshold || 0;
  // What to hold during a SELL ("out") state: cash (canonical) or an
  // unleveraged equity asset (QQQ / SPY). When an asset is picked, monthly
  // contributions during "out" DCA into it instead of sitting idle in cash.
  const outAsset  = (opts.outAsset || 'cash').toLowerCase();
  // DCA ladders (time-based, in months). 0 = instant (current behavior).
  // dcaInMonths gates the cash → underlying ramp on BUY; dcaToOutMonths gates
  // the cash → out-asset ramp on SELL (only meaningful when outAsset != cash).
  // Sells to cash are always instant — only the buy leg of any transition is
  // laddered, matching the canonical "sell immediately, DCA back in" pattern.
  const dcaInMonths    = Math.max(0, +opts.dcaInMonths    || 0);
  const dcaToOutMonths = Math.max(0, +opts.dcaToOutMonths || 0);
  // Bodyguard thresholds (% above unleveraged-underlying SMA). 0 = off.
  // delev: leveraged → unleveraged swap. gtfo: everything → cash. Bodyguard
  // transitions are instant (override DCA) — the whole point is emergency exit.
  const bgDelev = +opts.bgDelevPct || 0;
  const bgGtfo  = +opts.bgGtfoPct  || 0;
  const monthlyRate = annualRate / 12;
  annualRaise = annualRaise || 0;

  const empty = { smaPoints: [], totalContributed: initial };
  if (!smaAtMonthlyByKey || !monthlyData || !quarterlyData) return empty;
  const smaKey    = smaAsset + '_' + smaWindow;
  const smaAtMon  = smaAtMonthlyByKey[smaKey];
  if (!smaAtMon)  return empty;
  const rsiAtMon  = (typeof rsiAtMonthlyByAsset !== 'undefined' && rsiAtMonthlyByAsset) ? rsiAtMonthlyByAsset[smaAsset] : null;

  const startDate = quarterlyData[entryIdx][0];
  const endDate   = quarterlyData[exitIdx][0];
  // monthlyData layout: [date, tqqq, qqq, spy, qld, qqq5, sso, spxl] — sigAsset
  // is QQQ (col 2) or SPY (col 3); the leveraged underlying is selected via ulCol.
  const assetCol  = smaAsset === 'qqq' ? 2 : 3;

  // Underlying asset name (for state-machine target comparisons). Resolve from
  // ulCol so non-default underlyings (QQQ5) get the right unleveraged sibling.
  const ulName = Object.keys(SMA_ASSET_COL).find(k => SMA_ASSET_COL[k] === ulCol) || 'tqqq';
  const unlevName = SMA_UNLEVERAGED_OF[ulName] || 'qqq';
  const unlevCol  = SMA_ASSET_COL[unlevName];
  // Bodyguard SMA — same window as primary, but always on the unleveraged
  // underlying ("% above QQQ-200" is the canonical dot-com gauge, not the
  // leveraged version of it).
  const bgSmaAtMon = (bgDelev > 0 || bgGtfo > 0) ? smaAtMonthlyByKey[unlevName + '_' + smaWindow] : null;

  // First monthly index at-or-after the entry quarter; last at-or-before exit.
  let mStart = 0;
  while (mStart < monthlyData.length && monthlyData[mStart][0] < startDate) mStart++;
  let mEnd = monthlyData.length - 1;
  while (mEnd >= 0 && monthlyData[mEnd][0] > endDate) mEnd--;
  if (mStart > mEnd) return empty;

  // Decide in/out for this period. Layered rules:
  //   1. SMA crossover (with entry/exit hysteresis buffers) — primary regime
  //   2. RSI overheat (rsiOH)   — force exit when over-extended upside
  //   3. RSI cool gate (rsiCool) — block re-entry until pullback completes
  // The two RSI rules are independent: overheat fires when RSI is HIGH,
  // cool-gate fires when RSI is still HIGH (haven't reached the cool zone).
  function evalSignal(state, asset, sma, rsi) {
    if (sma == null || asset <= 0) return state;
    const rsiHot = rsiOH > 0 && rsi != null && rsi >= rsiOH;
    if (state === 'in') {
      if (rsiHot) return 'out';
      return asset < sma * (1 - exitBuf) ? 'out' : 'in';
    }
    // state === 'out' — entry path
    if (rsiHot) return 'out';                          // don't re-enter while overheated
    if (rsiCool > 0 && rsi != null && rsi >= rsiCool) return 'out'; // wait for pullback
    return asset > sma * (1 + entryBuf) ? 'in' : 'out';
  }
  // Bodyguard: returns 'gtfo' / 'delev' / 'normal' based on the unleveraged
  // underlying's % above its own SMA. Both thresholds must be > 0 to fire.
  function evalBodyguard(unlevPrice, unlevSma) {
    if (!unlevSma || unlevSma <= 0 || unlevPrice <= 0) return 'normal';
    const aboveBy = (unlevPrice / unlevSma - 1) * 100;
    if (bgGtfo  > 0 && aboveBy >= bgGtfo)  return 'gtfo';
    if (bgDelev > 0 && aboveBy >= bgDelev) return 'delev';
    return 'normal';
  }
  // Compose primary + bodyguard into a single target asset name. Bodyguard
  // wins (gtfo → cash, delev → unleveraged); else primary decides between the
  // underlying and the out-asset.
  function computeTarget(primary, bg) {
    if (bg === 'gtfo') return 'cash';
    if (primary === 'out') return outAsset;
    if (bg === 'delev') return unlevName;
    return ulName;
  }
  // Initial state: SMA + buffer + RSI on entry month.
  const sm0 = monthlyData[mStart];
  const a0  = sm0[assetCol] || 0;
  const sma0 = smaAtMon[mStart];
  const rsi0 = rsiAtMon ? rsiAtMon[mStart] : null;
  // Seed state ignoring exit-buffer (no prior state to test against — fall
  // back to plain "above SMA?" for the very first read).
  let state  = sma0 == null ? 'in' : (a0 > sma0 ? 'in' : 'out');
  if (state === 'in' && rsiOH > 0 && rsi0 != null && rsi0 >= rsiOH) state = 'out';
  // Initial bodyguard read (same month).
  const bgSma0 = bgSmaAtMon ? bgSmaAtMon[mStart] : null;
  const unlev0 = sm0[unlevCol] || 0;
  let bgState = evalBodyguard(unlev0, bgSma0);

  // Holdings: shares per tradeable asset (tqqq, qqq, spy, qld, qqq5, sso, spxl) +
  // cash. Multiple buckets coexist mid-DCA; non-target buckets are sold instantly
  // each month, target bucket is bought via the active DCA ladder.
  const shares = { tqqq: 0, qqq: 0, spy: 0, qld: 0, qqq5: 0, sso: 0, spxl: 0 };
  let cash = initial;
  let totalInvested = initial;
  const startYear = parseInt(sm0[0].substring(0, 4));
  let currentMonthly = monthly;
  let lastYear = startYear;

  // Pricing helper — column-zero (no data) returns 0 so callers skip the trade.
  function priceOf(row, asset) {
    const c = SMA_ASSET_COL[asset];
    return (c != null) ? (row[c] || 0) : 0;
  }
  // Initial target asset + initial deployment (instant — there's nothing prior
  // to ramp from).
  let target = computeTarget(state, bgState);
  if (target !== 'cash') {
    const p0 = priceOf(sm0, target);
    if (p0 > 0) {
      shares[target] = cash / p0;
      taxLotsFor(target).buy(shares[target], p0);
      cash = 0;
    }
  }
  let dcaRemaining = 0; // 0 = no active DCA (target already reached or all-cash)

  const ul0 = sm0[ulCol] || 0;
  function totalAt(row) {
    let v = 0;
    for (const a of Object.keys(shares)) {
      if (shares[a] > 0) v += shares[a] * (priceOf(row, a) || 0);
    }
    return v + cash;
  }
  const smaPoints = [{ date: sm0[0], value: totalAt(sm0), state }];
  // Event-driven transaction log: one row per ACTUAL trade (ENTER / EXIT /
  // DELEV / GTFO / RESUME), not one row per quarter.
  const smaLog = [{
    date: sm0[0],
    state, action: 'START',
    price: ul0, shares: shares.tqqq + shares.qld + shares.qqq5 + shares.sso + shares.spxl,  // leveraged-side share count
    stockVal: totalAt(sm0) - cash, cash, total: totalAt(sm0),
    invested: initial,
    realizedGain: 0, taxPaid: 0,
  }];
  const qEnds = new Set();
  for (let qi = entryIdx; qi <= exitIdx; qi++) qEnds.add(quarterlyData[qi][0]);

  // Lazy-seed: if a target asset has no price yet (pre-history), defer until
  // a real price appears. Cash accumulates contributions in the meantime.
  let seeded = (target === 'cash') ? true : (ul0 > 0 && (priceOf(sm0, target) > 0));

  function actionFor(prevTarget, newTarget, primary, bg, prevBg) {
    if (prevTarget === newTarget) return null;
    if (bg === 'gtfo' && prevBg !== 'gtfo') return 'BG-GTFO';
    if (bg === 'delev' && prevBg !== 'delev') return 'BG-DELEV';
    if (prevBg === 'gtfo' || prevBg === 'delev') return 'BG-CLEAR';
    return primary === 'in' ? 'ENTER' : 'EXIT';
  }

  for (let m = mStart + 1; m <= mEnd; m++) {
    const row    = monthlyData[m];
    const mDate  = row[0];
    const ulP    = row[ulCol] || 0;
    const assetP = row[assetCol] || 0;
    const unlevP = row[unlevCol] || 0;
    const sma    = smaAtMon[m];
    const rsi    = rsiAtMon ? rsiAtMon[m] : null;
    const bgSma  = bgSmaAtMon ? bgSmaAtMon[m] : null;

    const yr = parseInt(mDate.substring(0, 4));
    if (yr > lastYear) {
      currentMonthly = monthly * Math.pow(1 + annualRaise, yr - startYear);
      lastYear = yr;
    }

    let lastTaxInfo = { realizedGain: 0, taxPaid: 0 };
    // Accrue cash interest on whatever cash sits idle for the month.
    const accrual = accrueCashInterest(cash, monthlyRate, opts.taxRate);
    cash = accrual.cash;
    lastTaxInfo.taxPaid += accrual.taxPaid;
    // Contributions always land in cash; the rebalance below redeploys.
    totalInvested += currentMonthly;
    cash += currentMonthly;

    const prevState = state;
    const prevBg    = bgState;
    state   = evalSignal(state, assetP, sma, rsi);
    bgState = evalBodyguard(unlevP, bgSma);
    const prevTarget = target;
    target  = computeTarget(state, bgState);

    if (!seeded) {
      seeded = (target === 'cash') || (priceOf(row, target) > 0);
    }

    // Target changed → instant-sell all non-target stocks → cash. Then arm
    // the DCA ladder for the new direction (instant for sells/bodyguard).
    if (target !== prevTarget) {
      for (const a of Object.keys(shares)) {
        if (a !== target && shares[a] > 0) {
          const p = priceOf(row, a);
          if (p > 0) {
            const sell = taxLotsFor(a).sell(shares[a], p);
            cash += shares[a] * p - sell.taxPaid;
            lastTaxInfo.realizedGain += sell.realizedGain;
            lastTaxInfo.taxPaid += sell.taxPaid;
            shares[a] = 0;
          }
        }
      }
      // Bodyguard transitions are always instant; otherwise the ladder
      // applicable to the new direction.
      const bgChange = (bgState !== 'normal') || (prevBg !== 'normal');
      if (target === 'cash' || bgChange) dcaRemaining = 0;
      else if (target === ulName)        dcaRemaining = dcaInMonths    || 0;
      else                                dcaRemaining = dcaToOutMonths || 0;
    }

    // Deploy from cash → target stock (if any). 0 = instant; N = ramp 1/N of
    // remaining cash each month for N months.
    if (seeded && target !== 'cash' && cash > 0) {
      const p = priceOf(row, target);
      if (p > 0) {
        const fraction = dcaRemaining > 1 ? 1 / dcaRemaining : 1;
        const buy = cash * fraction;
        const bought = buy / p;
        shares[target] += bought;
        taxLotsFor(target).buy(bought, p);
        cash -= buy;
        if (dcaRemaining > 0) dcaRemaining--;
      }
    }

    const flippedAction = actionFor(prevTarget, target, state, bgState, prevBg);
    if (flippedAction) {
      smaLog.push({
        date: mDate, state, action: flippedAction,
        price: ulP, shares: shares.tqqq + shares.qld + shares.qqq5 + shares.sso + shares.spxl,
        stockVal: totalAt(row) - cash,
        cash, total: totalAt(row),
        invested: totalInvested,
        realizedGain: lastTaxInfo.realizedGain,
        taxPaid: lastTaxInfo.taxPaid,
      });
    }

    if (qEnds.has(mDate)) {
      smaPoints.push({ date: mDate, value: totalAt(row), state });
    }
  }

  return { smaPoints, smaLog, totalContributed: totalInvested };
}

function simulate(initial, monthly, annualRate, entryIdx, exitIdx, annualRaise, opts) {
  // `annualRate` is the rate the STRATEGY's parked cash earns. The Invested
  // Compounded baseline (computed alongside, below) earns `opts.baselineRate`
  // instead, so the strategy and the baseline can use independent rates.
  // Falls back to annualRate when no baselineRate is supplied.
  const monthlyRate = annualRate / 12;
  annualRaise = annualRaise || 0;
  opts = opts || {};
  const baselineMonthlyRate = (opts.baselineRate != null ? +opts.baselineRate : annualRate) / 12;
  // Rebalance period — picks which period-grain dataset the 9sig loop runs
  // on. Defaults to 'quarterly' (existing behavior). For non-quarterly we
  // re-derive entry/exit indices into the period series and rescale the
  // user-facing per-quarter growth rate to per-period.
  const period = opts.rebalancePeriod || 'quarterly';
  const periodData = (typeof periodDataByName !== 'undefined' && periodDataByName && periodDataByName[period]) || null;
  const monthsInPeriod = (typeof monthsInPeriodByName !== 'undefined' && monthsInPeriodByName && monthsInPeriodByName[period]) || null;
  // Default `qData` chain: opts.qData wins (envelope shifts pass shifted data);
  // otherwise use the period-appropriate series; fall back to quarterlyData.
  let qData = opts.qData || periodData || quarterlyData;
  const skipBH = !!opts.skipBH;
  // Signal-line growth rate, applied LITERALLY per rebalance period. The number
  // the user picks IS the per-period growth: "grow the signal line by 9%" with
  // quarterly rebalancing grows it 9% per quarter; with yearly rebalancing it
  // grows 9% per year. Switching the rebalance period therefore changes the
  // strategy's aggressiveness (9%/qtr is ~4× more aggressive than 9%/yr) — by
  // design, so the displayed % always means exactly what it says. (The
  // return-maximizing yearly setting on TQQQ history is ~57–60%/yr; canonical
  // 9Sig is 9%/qtr ≈ 41%/yr.)
  const qGrowth = opts.qGrowth != null ? opts.qGrowth : 0.09;
  // 30-down no-sell rule: skip selling when the underlying is at least this %
  // below its trailing peak. Canonical 9Sig uses 30. Setting to a value past
  // 100 effectively disables the rule (price can't drop more than 100%).
  const crashDropPct  = opts.crashDropPct  != null ? +opts.crashDropPct  : 30;
  const crashFactor   = 1 - crashDropPct / 100;  // 30 → 0.70 (price < 70% of high)
  // How far back to look for the trailing peak, in calendar months. Canonical
  // 9Sig uses 24 (= 2 years). Smaller windows make the rule more reactive
  // (peak is more recent so price more easily clears 70% of it); larger
  // windows make it stricter (rule rarely fires).
  const crashLookbackMonths = opts.crashLookbackMonths != null ? +opts.crashLookbackMonths : 24;
  // Spike-reset trigger: if the underlying gains at least this % in a single
  // quarter (and we're not in the crash zone), hard-reset to a 60% allocation.
  // Canonical is 100 (doubling). 0 disables the rule.
  const spikeTrigPct  = opts.spikeTriggerPct != null ? +opts.spikeTriggerPct : 100;
  const spikeTrigger  = spikeTrigPct > 0 ? spikeTrigPct / 100 : Infinity;
  // Which quarterlyData column holds the price of the leveraged ETF this run
  // trades. Default is column 1 (TQQQ) for backward compat. Column 5 is QQQ5.
  const ulCol         = opts.underlyingCol != null ? opts.underlyingCol : 1;
  const taxLots       = createTaxLots(opts.taxRate);
  const parkTaxLots   = createTaxLots(opts.taxRate);
  // Initial cash fraction (rest goes to the underlying). Default 0.40 matches
  // canonical 9Sig 60/40. Spike-reset target tracks (1 - cashPct) so the
  // reset rebalances back to the same stock weight the user started with.
  const cashPct       = opts.cashPct != null ? +opts.cashPct : 0.4;
  const stockPct      = 1 - cashPct;
  // Fraction of each monthly contribution to deploy immediately into the
  // underlying at the contribution-month's price (rest goes to cash and
  // earns interest until the next rebalance). Default 0 = canonical 9Sig
  // (wait for rebalance). Clamped to [0, 1].
  const contribDeployPct = Math.max(0, Math.min(1, opts.contribDeployPct != null ? +opts.contribDeployPct : 0));
  // Buying-power cap: a BUY never spends more than this fraction of cash, so
  // some dry powder is always kept. Canonical 9Sig keeps 10% (spends 90%).
  const buyThrottle = Math.max(0, Math.min(1, (opts.buyThrottlePct != null ? +opts.buyThrottlePct : 90) / 100));
  // Park asset for the non-underlying ("cash") side. Default 'cash' keeps the
  // safety bucket as actual cash earning the configured rate. Any other ticker
  // (qqq/spy/qld/qqq5/sso/spxl/tqqq) holds the safety side as shares of that
  // asset instead — contributions and rebalance proceeds buy into it, and the
  // cash rate stops accruing (cash-rate only applies to actual cash). The
  // safety side's dollar value floats with the park asset's price; rebalance
  // decisions still compare the underlying's value to the signal target, and
  // BUY/SELL convert between TQQQ and the park asset directly.
  const parkAsset = (opts.parkAsset || 'cash').toLowerCase();
  const parkCol   = (typeof SMA_ASSET_COL !== 'undefined' && SMA_ASSET_COL[parkAsset]) != null
                    ? SMA_ASSET_COL[parkAsset] : null;
  const isCashPark = parkAsset === 'cash' || parkCol == null;
  const parkPriceAt = (row) => isCashPark ? 1 : (row && row[parkCol]) || 0;
  // Target-growth base. Default false → each period's target grows from the
  // PREVIOUS HOLDING (target re-anchors to reality each period — no runaway gap
  // when buys are throttled / 30-down fires). Set true to keep compounding the
  // target on its OWN value (the classic canonical-Kelly behaviour — the target
  // ratchets ahead during drawdowns and the strategy buys toward a higher
  // number). Exposed as a checkbox in the 9sig panel so users can compare both.
  const targetFromPrevTarget = !!opts.targetFromPrevTarget;

  // entryIdx / exitIdx are passed as indices into `quarterlyData` (slider
  // position, with the "enter at quarter start" shift already applied by the
  // caller — see chart.js render() — so simulate() does not adjust again).
  // When the rebalance period isn't quarterly we map those to
  // the nearest equivalent indices in the period data — same date span,
  // different grain.
  let _customYearly = false;
  // The "live snapshot" tail: when the chart's exit date is past the last
  // rebalance (always true for yearly unless the user picked an exact 12-month
  // multiple of entry), append a non-rebalancing row at the exit so the line's
  // right edge reflects current shares × current price + current cash. Without
  // this the line goes flat from the last anniversary to today and people
  // mistake intra-period gains for underperformance.
  let _sentinelIdx = -1;
  if (period === 'yearly' && !opts.qData && quarterlyData && monthlyData) {
    // "Yearly" = rebalance every 12 calendar months FROM the chart's entry,
    // NOT at calendar year-ends. So the strategy starts at the chart's first
    // label with $100K and the first rebalance lands exactly a year later —
    // regardless of when in the year you started. Each yearly run gets its
    // own anniversary-based dates instead of every yearly strategy sharing
    // 12-31 boundaries (which made strategies started mid-year visually
    // begin mid-period at a different value than the others).
    const startDate = quarterlyData[entryIdx] && quarterlyData[entryIdx][0];
    const endDate   = quarterlyData[exitIdx]  && quarterlyData[exitIdx][0];
    if (startDate && endDate) {
      const _addYears = (s, n) => {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(Date.UTC(y + n, m - 1, d)).toISOString().slice(0, 10);
      };
      const _monthlyRowAtOrBefore = (date) => {
        let row = null;
        for (let i = 0; i < monthlyData.length; i++) {
          if (monthlyData[i][0] <= date) row = monthlyData[i]; else break;
        }
        return row;
      };
      const rolling = [];
      let cur = startDate;
      while (cur <= endDate) {
        const row = _monthlyRowAtOrBefore(cur);
        if (row) rolling.push(row);
        cur = _addYears(cur, 1);
      }
      // Append a "live snapshot" sentinel at the chart's actual exit if the
      // last anniversary is earlier. Index recorded so the rebalance loop can
      // skip its sell/buy logic for this row (it's a value snapshot, not a
      // rebalance — shares unchanged, only cash + price change).
      if (rolling.length >= 1) {
        const lastRow = rolling[rolling.length - 1];
        if (endDate > lastRow[0]) {
          const exitRow = _monthlyRowAtOrBefore(endDate);
          if (exitRow && exitRow[0] > lastRow[0]) {
            rolling.push(exitRow);
            _sentinelIdx = rolling.length - 1;
          }
        }
      }
      if (rolling.length >= 2) {
        qData = rolling;
        entryIdx = 0;
        exitIdx = rolling.length - 1;
        _customYearly = true;
      }
    }
  }
  if (!_customYearly && period !== 'quarterly' && quarterlyData && qData !== quarterlyData && periodData) {
    const entryDate = quarterlyData[entryIdx] && quarterlyData[entryIdx][0];
    const exitDate  = quarterlyData[exitIdx]  && quarterlyData[exitIdx][0];
    if (entryDate && exitDate) {
      let e = 0, x = qData.length - 1;
      for (let i = 0; i < qData.length; i++) { if (qData[i][0] <= entryDate) e = i; else break; }
      for (let i = qData.length - 1; i >= 0; i--) { if (qData[i][0] >= exitDate)  x = i; else break; }
      entryIdx = e; exitIdx = x;
    }
  }
  // Fast path for the monthly-contribution slicing. Works whenever qData is
  // the period's canonical (un-shifted) array AND we have a matching
  // monthsInPeriod cache. Envelope-shifted qData falls back to linear scan.
  const fastMonthly = (qData === periodData || (period === 'quarterly' && qData === quarterlyData)) && monthsInPeriod && (period !== 'quarterly' || monthlyByQuarter);
  const monthsLookup = (period === 'quarterly') ? monthlyByQuarter : monthsInPeriod;
  const qSlice = qData.slice(entryIdx, exitIdx + 1);
  if (qSlice.length < 2) return { log: [], bhPoints: [], qqqPoints: [], spyPoints: [], qldPoints: [], qqq5Points: [], ssoPoints: [], spxlPoints: [], totalContributed: initial };

  // Initial allocation: stockPct in the leveraged ETF, cashPct in the park
  // bucket (cash by default, or shares of qqq/spy/etc. when parkAsset is set).
  // For cash, `cash` IS the dollar balance and parkShares stays at 0. For an
  // asset, parkShares = cashPct$ / asset price at entry, and `cash` mirrors
  // the asset's current dollar value (re-priced each quarter before the
  // rebalance decision uses it).
  let cash = initial * cashPct;
  let parkShares = 0;
  if (!isCashPark) {
    const p0 = parkPriceAt(qSlice[0]);
    parkShares = p0 > 0 ? cash / p0 : 0;
    parkTaxLots.buy(parkShares, p0);
  }
  let tqqqShares = (initial * stockPct) / qSlice[0][ulCol];
  taxLots.buy(tqqqShares, qSlice[0][ulCol]);
  let signalLine = initial * stockPct; // target value starts at initial stock allocation
  // Each new target grows from the PREVIOUS REBALANCE's post-rebalance holding
  // (not from the prior target). If the strategy underperforms — a throttled
  // buy, a crash-zone HOLD, or a spike reset — the target naturally tracks the
  // lower holding instead of ratcheting away on its own formula.
  let prevHolding = initial * stockPct; // = the post-rebalance tqqqVal at qi=0
  let totalInvested = initial;
  let investedCompounded = initial;
  let currentMonthly = monthly;
  const startYear = parseInt(qSlice[0][0].substring(0, 4));

  const log = [];
  // Quarter-end value snapshots for the chart, used ONLY when the rebalance
  // period is coarser than a quarter (i.e. yearly) so a yearly strategy still
  // draws/hovers at quarter resolution. Additive + opt-gated: the rebalance math
  // and `log` are untouched (numerical tests see identical results). Each snapshot
  // is the real portfolio value at a quarter-end (shares × that quarter's price +
  // cash, contributions applied) — not interpolation. Rebalancing still only
  // happens at `period`.
  const sampleQuarterly = !!opts.sampleQuarterly;
  const isQuarterEnd = (d) => { const m = d.substring(5, 7); return m === '03' || m === '06' || m === '09' || m === '12'; };
  const samplePoints = [];
  let prevQDate = qSlice[0][0];
  let crashNoSellCount = 0; // track consecutive 30-down no-sell skips (max 2)

  for (let qi = 0; qi < qSlice.length; qi++) {
    const qDate  = qSlice[qi][0];
    const qPrice = qSlice[qi][ulCol];
    let taxInfo = { realizedGain: 0, taxPaid: 0 };

    if (qi > 0) {
      // Annual raise: increase monthly contribution at each new year
      const currentYear = parseInt(qDate.substring(0, 4));
      const prevYear = parseInt(prevQDate.substring(0, 4));
      if (currentYear > prevYear) {
        currentMonthly = monthly * Math.pow(1 + annualRaise, currentYear - startYear);
      }

      // Add monthly contributions. Canonical 9Sig sends 100% to cash and waits
      // for the next rebalance — `contribDeployPct` lets the user split each
      // contribution: that fraction is deployed into the underlying at the
      // current month's price, the rest goes to cash (and earns interest).
      // The signal-line bump below still uses full newCashThisQ × 0.5 so the
      // diff math balances out (price-flat case ≈ identical end state; only
      // intra-period price moves separate the two behaviors).
      let newCashThisQ = 0;
      // Helper: apply one month's contribution. When the user opted into
      // immediate deployment, split between an underlying-buy at this
      // month's price and a cash deposit. Fall back to "all cash" if the
      // price is missing (data gap / pre-history) — otherwise the stock
      // half would silently evaporate, since shares can't be bought without
      // a price to divide by.
      const applyContribAtPrice = (mPrice, mDate, monthlyRow) => {
        const toStock = currentMonthly * contribDeployPct;
        const toPark  = currentMonthly - toStock;
        if (toStock > 0 && mPrice > 0) {
          const bought = toStock / mPrice;
          tqqqShares += bought;
          taxLots.buy(bought, mPrice);
        }
        const parkContribution = (toStock > 0 && mPrice > 0) ? toPark : currentMonthly;
        if (isCashPark) {
          const addCash = parkContribution;
          cash += addCash;
          const accrual = accrueCashInterest(cash, monthlyRate, opts.taxRate);
          cash = accrual.cash;
          taxInfo.taxPaid += accrual.taxPaid;
        } else if (parkContribution > 0) {
          const parkMP = monthlyRow ? (monthlyRow[parkCol] || 0) : 0;
          if (parkMP > 0) {
            const bought = parkContribution / parkMP;
            parkShares += bought;
            parkTaxLots.buy(bought, parkMP);
          } else {
            cash += parkContribution; // missing park price -> stash as cash; reconciled at next rebalance
          }
        }
        totalInvested += currentMonthly;
        newCashThisQ += currentMonthly;
        investedCompounded *= (1 + baselineMonthlyRate);
        investedCompounded += currentMonthly;
        // Intra-period quarter-end snapshot (the period's own end is recorded
        // post-rebalance below). signalLine is still the prior period's value —
        // correct, since the target only steps at a rebalance.
        if (sampleQuarterly && mDate && mDate < qDate && mPrice > 0 && isQuarterEnd(mDate)) {
          const sv = tqqqShares * mPrice;
          const cashAtSample = isCashPark
            ? cash
            : (monthlyRow && monthlyRow[parkCol] > 0 ? parkShares * monthlyRow[parkCol] : cash);
          samplePoints.push({ date: mDate, price: mPrice, tqqqVal: sv, cash: cashAtSample, total: sv + cashAtSample, target: signalLine, invested: totalInvested, investedCompounded });
        }
      };
      if (fastMonthly) {
        const monthsInQ = monthsLookup[entryIdx + qi];
        for (let mi = 0; mi < monthsInQ.length; mi++) {
          applyContribAtPrice(monthlyData[monthsInQ[mi]][ulCol], monthlyData[monthsInQ[mi]][0], monthlyData[monthsInQ[mi]]);
        }
      } else {
        for (const row of monthlyData) {
          if (row[0] > prevQDate && row[0] <= qDate) applyContribAtPrice(row[ulCol], row[0], row);
        }
      }

      // Re-price the park bucket to this period's prices before the rebalance
      // logic reads `cash`. For cash mode this is a no-op; for asset mode it
      // converts parkShares (built up via contributions) back to a dollar
      // value at the rebalance row's park price.
      if (!isCashPark) {
        const parkP = parkPriceAt(qSlice[qi]);
        if (parkP > 0) cash = parkShares * parkP;
      }

      let action = '';
      // The sentinel row is a value snapshot at the chart's exit — NOT a
      // rebalance. Skip the signal-grow / sell-buy / spike-reset machinery; the
      // cash that accrued in the contribution loop above and the holding
      // (re-priced at exit below) ARE the live values we want to display.
      if (qi !== _sentinelIdx) {
        // Signal line grows 9% per quarter + 50% of new cash contributions.
        // Default base is the prior period's post-rebalance HOLDING — anchors
        // the target to what the strategy actually held last time, so the gap
        // can't run away on throttled buys / crash holds. The "compound on
        // itself" toggle switches the base to the prior SIGNAL instead (target
        // keeps compounding on its own formula — canonical Kelly).
        const growBase = targetFromPrevTarget ? signalLine : prevHolding;
        signalLine = growBase * (1 + qGrowth) + newCashThisQ * 0.5;

        const currentTqqqValue = tqqqShares * qPrice;
        const diff = currentTqqqValue - signalLine;

        // 30-down no-sell rule: if price < (1-crashDrop)% of the trailing
        // peak, skip the sell — but only up to 2 consecutive quarters, then
        // sell anyway. Lookback window is configurable (24 months = canonical
        // 2-year peak). Date math: convert YYYY-MM to absolute month index,
        // subtract the lookback, recompose into a YYYY-MM-DD string that
        // sorts lexicographically just like the qSlice dates do.
        const _y = parseInt(qDate.substring(0, 4));
        const _m = parseInt(qDate.substring(5, 7));
        const _totalMonths = _y * 12 + (_m - 1) - crashLookbackMonths;
        const _ny = Math.floor(_totalMonths / 12);
        const _nm = (_totalMonths % 12 + 12) % 12 + 1;
        const lookbackThreshold = String(_ny).padStart(4, '0') + '-' + String(_nm).padStart(2, '0') + qDate.substring(7);
        let peak2y = qPrice;
        for (let k = qi; k >= 0; k--) {
          if (qSlice[k][0] < lookbackThreshold) break;
          if (qSlice[k][ulCol] > peak2y) peak2y = qSlice[k][ulCol];
        }
        const inCrashZone = qPrice < peak2y * crashFactor;

        // Park-side conversion helpers. For cash mode they're no-ops; for an
        // asset park, every dollar moved in/out of the safety bucket has to
        // be translated to a share count at the rebalance row's park price.
        const parkPriceNow = parkPriceAt(qSlice[qi]);
        const moveIntoPark = (dollars) => {
          cash += dollars;
          if (!isCashPark && parkPriceNow > 0) {
            const bought = dollars / parkPriceNow;
            parkShares += bought;
            parkTaxLots.buy(bought, parkPriceNow);
          }
        };
        const moveOutOfPark = (dollars) => {
          if (isCashPark) {
            cash -= dollars;
            return { net: dollars, realizedGain: 0, taxPaid: 0 };
          }
          if (!(parkPriceNow > 0)) return { net: 0, realizedGain: 0, taxPaid: 0 };
          const sharesToSell = dollars / parkPriceNow;
          const sellTaxInfo = parkTaxLots.sell(sharesToSell, parkPriceNow);
          cash -= dollars;
          parkShares -= sharesToSell;
          return {
            net: dollars - sellTaxInfo.taxPaid,
            realizedGain: sellTaxInfo.realizedGain,
            taxPaid: sellTaxInfo.taxPaid,
          };
        };

        if (diff > 0 && !inCrashZone) {
          // SELL: TQQQ above signal, sell excess to cash (or park asset)
          const sharesToSell = diff / qPrice;
          const sellTaxInfo = taxLots.sell(sharesToSell, qPrice);
          tqqqShares -= sharesToSell;
          moveIntoPark(diff - sellTaxInfo.taxPaid);
          taxInfo.realizedGain += sellTaxInfo.realizedGain;
          taxInfo.taxPaid += sellTaxInfo.taxPaid;
          action = 'SELL ' + fmt(diff);
          crashNoSellCount = 0;
        } else if (diff > 0 && inCrashZone && crashNoSellCount < 2) {
          // Signal says sell but we're in crash zone and haven't skipped 2 times yet — hold
          crashNoSellCount++;
          action = 'HOLD (30d ' + crashNoSellCount + '/2)';
        } else if (diff > 0 && inCrashZone && crashNoSellCount >= 2) {
          // Crash zone but already skipped 2 consecutive quarters — sell anyway
          const sharesToSell = diff / qPrice;
          const sellTaxInfo = taxLots.sell(sharesToSell, qPrice);
          tqqqShares -= sharesToSell;
          moveIntoPark(diff - sellTaxInfo.taxPaid);
          taxInfo.realizedGain += sellTaxInfo.realizedGain;
          taxInfo.taxPaid += sellTaxInfo.taxPaid;
          action = 'SELL ' + fmt(diff) + ' (30d expired)';
          crashNoSellCount = 0;
        } else if (diff < 0 && cash > 0) {
          // BUY: TQQQ below signal, buy from cash (90% throttle)
          crashNoSellCount = 0;
          const available = cash * buyThrottle;
          const needed = Math.min(-diff, available);
          if (needed > 0) {
            const parkSale = moveOutOfPark(needed);
            const sharesToBuy = parkSale.net / qPrice;
            tqqqShares += sharesToBuy;
            taxLots.buy(sharesToBuy, qPrice);
            taxInfo.realizedGain += parkSale.realizedGain;
            taxInfo.taxPaid += parkSale.taxPaid;
            action = needed < -diff ? 'BUY ' + fmt(needed) + ' (part)' : 'BUY ' + fmt(needed);
          } else {
            action = 'HOLD';
          }
        } else {
          crashNoSellCount = 0;
          action = 'HOLD';
        }

        // Spike reset rule: if TQQQ at least doubled this quarter AND the post-
        // rebalance stock allocation is still 60–100% AND we're not in a 30-down
        // no-sell period, force the stock fund back to a 60% allocation. This
        // is the canonical 9Sig "spike reset" — a hard profit-take when a big
        // upmove leaves the leveraged fund still dominating the portfolio.
        const prevTqqqPrice = qSlice[qi - 1][ulCol];
        const quarterlyTqqqGain = prevTqqqPrice > 0 ? (qPrice - prevTqqqPrice) / prevTqqqPrice : 0;
        const postTqqqVal = tqqqShares * qPrice;
        const postTotal   = postTqqqVal + cash;
        const postAlloc   = postTotal > 0 ? postTqqqVal / postTotal : 0;
        if (quarterlyTqqqGain >= spikeTrigger && postAlloc >= stockPct && postAlloc <= 1.0 && !inCrashZone) {
          const targetTqqqVal = postTotal * stockPct;
          const reduceBy = postTqqqVal - targetTqqqVal;
          const sellTaxInfo = taxLots.sell(reduceBy / qPrice, qPrice);
          tqqqShares = targetTqqqVal / qPrice;
          moveIntoPark(reduceBy - sellTaxInfo.taxPaid);
          taxInfo.realizedGain += sellTaxInfo.realizedGain;
          taxInfo.taxPaid += sellTaxInfo.taxPaid;
          signalLine = targetTqqqVal;
          action = 'RESET ' + fmt(reduceBy) + ' (spike)';
        }
      } else {
        action = 'SNAPSHOT';
      }

      const tqqqVal = tqqqShares * qPrice;
      log.push({ date: qDate, price: qPrice, tqqqVal, cash, total: tqqqVal + cash, action, invested: totalInvested, investedCompounded, target: signalLine, realizedGain: taxInfo.realizedGain, taxPaid: taxInfo.taxPaid });
      // Period-end snapshot (post-rebalance) — keeps the quarter series continuous.
      if (sampleQuarterly) samplePoints.push({ date: qDate, price: qPrice, tqqqVal, cash, total: tqqqVal + cash, target: signalLine, invested: totalInvested, investedCompounded, realizedGain: taxInfo.realizedGain, taxPaid: taxInfo.taxPaid });
      prevHolding = tqqqVal; // next period's target grows from THIS period's holding
    } else {
      // First quarter — just record starting state
      const tqqqVal = tqqqShares * qSlice[0][ulCol];
      log.push({ date: qDate, price: qSlice[0][ulCol], tqqqVal, cash, total: tqqqVal + cash, action: 'START', invested: totalInvested, investedCompounded, target: signalLine, realizedGain: 0, taxPaid: 0 });
      if (sampleQuarterly) samplePoints.push({ date: qDate, price: qSlice[0][ulCol], tqqqVal, cash, total: tqqqVal + cash, target: signalLine, invested: totalInvested, investedCompounded, realizedGain: 0, taxPaid: 0 });
      prevHolding = tqqqVal;
    }
    prevQDate = qDate;
  }

  if (skipBH) return { log, samplePoints, totalContributed: totalInvested, qldPoints: [], qqq5Points: [], ssoPoints: [], spxlPoints: [] };

  // Buy & hold for one asset column. Quarterly `points` (unchanged) plus, when
  // sampleQuarterly is on, quarter-end value snapshots so a yearly-grain run can
  // still draw B&H at quarter resolution. `requirePrice` mirrors the SPY/QQQ5
  // guard (skip a period whose period-end price is missing). The share-growth
  // math is identical to the four original loops — samples just observe it.
  function buyHold(col, requirePrice) {
    const points = [], sample = [];
    let shares = qSlice[0][col] ? initial / qSlice[0][col] : 0;
    let prevQ = qSlice[0][0];
    if (sampleQuarterly && qSlice[0][col]) sample.push({ date: qSlice[0][0], value: shares * qSlice[0][col] });
    for (let qi = 0; qi < qSlice.length; qi++) {
      const qDate = qSlice[qi][0];
      const qP = qSlice[qi][col];
      if (qi > 0 && (!requirePrice || qP)) {
        const yr = parseInt(qDate.substring(0, 4));
        const m = monthly * Math.pow(1 + annualRaise, yr - startYear);
        if (fastMonthly) {
          const monthsInQ = monthsLookup[entryIdx + qi];
          for (let k = 0; k < monthsInQ.length; k++) {
            const mp = monthlyData[monthsInQ[k]][col];
            if (requirePrice ? mp : true) shares += m / mp;
            if (sampleQuarterly && mp > 0 && isQuarterEnd(monthlyData[monthsInQ[k]][0])) sample.push({ date: monthlyData[monthsInQ[k]][0], value: shares * mp });
          }
        } else {
          for (const row of monthlyData) {
            if (row[0] > prevQ && row[0] <= qDate) {
              const mp = row[col];
              if (requirePrice ? mp : true) shares += m / mp;
              if (sampleQuarterly && mp > 0 && isQuarterEnd(row[0])) sample.push({ date: row[0], value: shares * mp });
            }
          }
        }
      }
      points.push({ date: qDate, value: qP ? shares * qP : 0, price: qP, shares });
      prevQ = qDate;
    }
    return { points, sample };
  }

  const bh   = buyHold(1, false); // TQQQ (always col 1, regardless of the strategy's underlying)
  const qqq  = buyHold(2, false);
  const spy  = buyHold(3, true);
  const qld  = buyHold(4, true);
  const qqq5 = buyHold(5, true);
  const sso  = buyHold(6, true);
  const spxl = buyHold(7, true);

  return {
    log, samplePoints,
    bhPoints: bh.points, qqqPoints: qqq.points, spyPoints: spy.points, qldPoints: qld.points, qqq5Points: qqq5.points, ssoPoints: sso.points, spxlPoints: spxl.points,
    bhSample: bh.sample, qqqSample: qqq.sample, spySample: spy.sample, qldSample: qld.sample, qqq5Sample: qqq5.sample, ssoSample: sso.sample, spxlSample: spxl.sample,
    totalContributed: totalInvested,
  };
}
