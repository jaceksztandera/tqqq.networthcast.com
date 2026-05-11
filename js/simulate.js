
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
function simulateSMA(initial, monthly, annualRate, entryIdx, exitIdx, annualRaise, opts) {
  opts = opts || {};
  const smaAsset  = (opts.smaAsset || 'qqq').toLowerCase();
  const smaWindow = +opts.smaWindow || 200;
  // monthlyData/quarterlyData column index of the leveraged ETF this run
  // holds when the SMA signal says "in". Default 1 (TQQQ). 4 = SOXL, 5 = QQQ5.
  const ulCol     = opts.underlyingCol != null ? +opts.underlyingCol : 1;
  const monthlyRate = annualRate / 12;
  annualRaise = annualRaise || 0;

  const empty = { smaPoints: [], totalContributed: initial };
  if (!smaAtMonthlyByKey || !monthlyData || !quarterlyData) return empty;
  const smaKey    = smaAsset + '_' + smaWindow;
  const smaAtMon  = smaAtMonthlyByKey[smaKey];
  if (!smaAtMon)  return empty;

  const startDate = quarterlyData[entryIdx][0];
  const endDate   = quarterlyData[exitIdx][0];
  const assetCol  = smaAsset === 'qqq' ? 2 : 3; // monthlyData = [date, tqqq, qqq, spy, soxl, qqq5]

  // First monthly index at-or-after the entry quarter; last at-or-before exit.
  let mStart = 0;
  while (mStart < monthlyData.length && monthlyData[mStart][0] < startDate) mStart++;
  let mEnd = monthlyData.length - 1;
  while (mEnd >= 0 && monthlyData[mEnd][0] > endDate) mEnd--;
  if (mStart > mEnd) return empty;

  // Initial signal: take the SMA reading at the entry month. If the SMA isn't
  // available yet (not enough history), default 'in' — matches the conservative
  // "follow the trend or accept the leveraged-ETF risk" reading of the rule.
  const sm0 = monthlyData[mStart];
  const a0  = sm0[assetCol] || 0;
  const sma0 = smaAtMon[mStart];
  let state  = sma0 == null ? 'in' : (a0 > sma0 ? 'in' : 'out');
  const ul0  = sm0[ulCol] || 0;
  let shares = state === 'in' && ul0 > 0 ? initial / ul0 : 0;
  let cash   = state === 'in' ? 0 : initial;
  let totalInvested = initial;
  const startYear = parseInt(sm0[0].substring(0, 4));
  let currentMonthly = monthly;
  let lastYear = startYear;

  const smaPoints = [{ date: sm0[0], value: state === 'in' ? shares * ul0 : cash, state }];
  const qEnds = new Set();
  for (let qi = entryIdx; qi <= exitIdx; qi++) qEnds.add(quarterlyData[qi][0]);

  // Track whether we've seeded the lump-sum into a previously-unavailable
  // underlying (e.g. SOXL pre-1994 = 0). When the column first goes non-zero
  // and the signal says 'in', we recast cash → shares at that price.
  let seeded = (state === 'in' && ul0 > 0);

  for (let m = mStart + 1; m <= mEnd; m++) {
    const mDate  = monthlyData[m][0];
    const ulP    = monthlyData[m][ulCol] || 0;
    const assetP = monthlyData[m][assetCol] || 0;
    const yr = parseInt(mDate.substring(0, 4));
    if (yr > lastYear) {
      currentMonthly = monthly * Math.pow(1 + annualRaise, yr - startYear);
      lastYear = yr;
    }

    // Accrue cash interest for the prior month, then add this month's
    // contribution to whichever bucket we're currently in.
    if (state === 'out' && cash > 0) cash *= (1 + monthlyRate);
    totalInvested += currentMonthly;
    if (state === 'in' && ulP > 0) {
      shares += currentMonthly / ulP;
    } else {
      cash += currentMonthly;
    }

    // First quarter where the underlying becomes available (e.g. SOXL crossing
    // 1994) and we're nominally 'in' — convert accumulated cash to shares.
    if (!seeded && state === 'in' && ulP > 0 && cash > 0) {
      shares += cash / ulP;
      cash = 0;
      seeded = true;
    }

    // Check signal at this month-end and flip if it crossed.
    const sma = smaAtMon[m];
    if (sma != null && assetP > 0) {
      const signal = assetP > sma ? 'in' : 'out';
      if (signal !== state) {
        if (signal === 'in' && ulP > 0) {
          shares = cash / ulP;
          cash = 0;
          state = 'in';
          seeded = true;
        } else {
          cash = shares * ulP;
          shares = 0;
          state = 'out';
        }
      }
    }

    if (qEnds.has(mDate)) {
      smaPoints.push({ date: mDate, value: state === 'in' ? shares * ulP : cash, state });
    }
  }

  return { smaPoints, totalContributed: totalInvested };
}

// Compute trailing "$1 invested N years ago" B&H-TQQQ ÷ simplified-9sig ratio (×100)
// at the given index in quarterlyData. Returns null if there isn't enough history.
function trailingShadowRatio(globalIdx, yearsBack, ulCol, qGrowth) {
  if (ulCol == null) ulCol = 1;
  if (qGrowth == null) qGrowth = 0.09;
  const back = yearsBack * 4;
  if (globalIdx < back) return null;
  const start = globalIdx - back;
  const startPrice = quarterlyData[start][ulCol];
  const endPrice = quarterlyData[globalIdx][ulCol];
  if (!startPrice || !endPrice) return null;
  const bhValue = endPrice / startPrice;

  let cash = 0.4;
  let shares = 0.6 / startPrice;
  let signal = 0.6;
  for (let t = start + 1; t <= globalIdx; t++) {
    const p = quarterlyData[t][ulCol];
    signal *= (1 + qGrowth);
    const tqqqVal = shares * p;
    const diff = tqqqVal - signal;
    if (diff > 0) {
      shares -= diff / p;
      cash += diff;
    } else if (diff < 0 && cash > 0) {
      const buy = Math.min(-diff, cash * 0.9);
      shares += buy / p;
      cash -= buy;
    }
    const newVal = shares * p;
    if (newVal < signal) signal = newVal;
  }
  const sigValue = shares * endPrice + cash;
  if (sigValue <= 0) return null;
  return (bhValue / sigValue) * 100;
}

// Calendar-anchored adaptive state machine — runs from quarterlyData[0] forward
// regardless of the user's entry/exit, so the strategy at any given calendar
// quarter is deterministic (depends only on the threshold sliders, not on the
// simulation window). Returns ['all-in' | '9sig'] aligned to quarterlyData.
function computeAdaptiveStates(switchTo9sigPct, switchToAllInPct, yearsBack, ulCol, qGrowth) {
  const states = new Array(quarterlyData.length);
  let state = 'all-in';
  for (let i = 0; i < quarterlyData.length; i++) {
    const ratio = trailingShadowRatio(i, yearsBack, ulCol, qGrowth);
    if (ratio != null) {
      if (state === 'all-in' && ratio >= switchTo9sigPct) state = '9sig';
      else if (state === '9sig' && ratio <= switchToAllInPct) state = 'all-in';
    }
    states[i] = state;
  }
  return states;
}

function simulate(initial, monthly, annualRate, entryIdx, exitIdx, annualRaise, opts) {
  const monthlyRate = annualRate / 12;
  annualRaise = annualRaise || 0;
  opts = opts || {};
  const qData = opts.qData || quarterlyData;
  const skipBH = !!opts.skipBH;
  const switchTo9sig  = opts.switchTo9sig  != null ? opts.switchTo9sig  : 200;
  const switchToAllIn = opts.switchToAllIn != null ? opts.switchToAllIn : 100;
  const yearsBack     = opts.yearsBack     != null ? opts.yearsBack     : 10;
  // Quarterly signal-line growth rate. Default 9% (the canonical 9Sig figure).
  // Users can override per strategy panel — higher leverage → larger Δ between
  // 60% allocation and signal target → typically wants a steeper growth rate.
  const qGrowth       = opts.qGrowth       != null ? opts.qGrowth       : 0.09;
  // 30-down no-sell rule: skip selling when the underlying is at least this %
  // below its 2-year peak. Canonical 9Sig uses 30. Setting to a value past
  // 100 effectively disables the rule (price can't drop more than 100%).
  const crashDropPct  = opts.crashDropPct  != null ? +opts.crashDropPct  : 30;
  const crashFactor   = 1 - crashDropPct / 100;  // 30 → 0.70 (price < 70% of high)
  // Spike-reset trigger: if the underlying gains at least this % in a single
  // quarter (and we're not in the crash zone), hard-reset to a 60% allocation.
  // Canonical is 100 (doubling). 0 disables the rule.
  const spikeTrigPct  = opts.spikeTriggerPct != null ? +opts.spikeTriggerPct : 100;
  const spikeTrigger  = spikeTrigPct > 0 ? spikeTrigPct / 100 : Infinity;
  // Which quarterlyData column holds the price of the leveraged ETF this run
  // trades. Default is column 1 (TQQQ) for backward compat. Column 5 is QQQ5.
  const ulCol         = opts.underlyingCol != null ? opts.underlyingCol : 1;

  // Fast path for monthly contribution slicing — only when running against
  // the default quarterlyData (envelope-shifted qData uses a different date
  // alignment, so falls back to the linear scan).
  const fastMonthly = (qData === quarterlyData) && monthlyByQuarter;
  const qSlice = qData.slice(entryIdx, exitIdx + 1);
  if (qSlice.length < 2) return { log: [], bhPoints: [], qqqPoints: [], spyPoints: [], soxlPoints: [], qqq5Points: [], adaptivePoints: [], totalContributed: initial };

  // Initial 60/40 allocation: 60% leveraged ETF, 40% cash. Matches the
  // canonical 9Sig "base reset" mix; we keep the 40% in cash earning the
  // configured rate (instead of a bond fund) per the simulator's design.
  let cash = initial * 0.4;
  let tqqqShares = (initial * 0.6) / qSlice[0][ulCol];
  let signalLine = initial * 0.6; // target TQQQ value starts at initial TQQQ allocation
  let totalInvested = initial;
  let investedCompounded = initial;
  let currentMonthly = monthly;
  const startYear = parseInt(qSlice[0][0].substring(0, 4));

  const log = [];
  let prevQDate = qSlice[0][0];
  let crashNoSellCount = 0; // track consecutive 30-down no-sell skips (max 2)

  for (let qi = 0; qi < qSlice.length; qi++) {
    const qDate  = qSlice[qi][0];
    const qPrice = qSlice[qi][ulCol];

    if (qi > 0) {
      // Annual raise: increase monthly contribution at each new year
      const currentYear = parseInt(qDate.substring(0, 4));
      const prevYear = parseInt(prevQDate.substring(0, 4));
      if (currentYear > prevYear) {
        currentMonthly = monthly * Math.pow(1 + annualRaise, currentYear - startYear);
      }

      // Add monthly contributions: 100% goes to cash, signal line rises by 50% of new cash
      let newCashThisQ = 0;
      if (fastMonthly) {
        const monthsInQ = monthlyByQuarter[entryIdx + qi];
        for (let mi = 0; mi < monthsInQ.length; mi++) {
          cash += currentMonthly;
          totalInvested += currentMonthly;
          newCashThisQ += currentMonthly;
          cash *= (1 + monthlyRate);
          investedCompounded *= (1 + monthlyRate);
          investedCompounded += currentMonthly;
        }
      } else {
        for (const [mDate] of monthlyData) {
          if (mDate > prevQDate && mDate <= qDate) {
            cash += currentMonthly;
            totalInvested += currentMonthly;
            newCashThisQ += currentMonthly;
            cash *= (1 + monthlyRate);
            investedCompounded *= (1 + monthlyRate);
            investedCompounded += currentMonthly;
          }
        }
      }

      // Signal line grows 9% per quarter + 50% of new cash contributions
      signalLine = signalLine * (1 + qGrowth) + newCashThisQ * 0.5;

      const currentTqqqValue = tqqqShares * qPrice;
      const diff = currentTqqqValue - signalLine;
      let action = '';

      // 30-down no-sell rule: if TQQQ price < 70% of 2-year high, skip sell
      // but only up to 2 consecutive quarters, then sell anyway
      const twoYearsAgo = (parseInt(qDate.substring(0, 4)) - 2) + qDate.substring(4);
      let peak2y = qPrice;
      for (let k = qi; k >= 0; k--) {
        if (qSlice[k][0] < twoYearsAgo) break;
        if (qSlice[k][ulCol] > peak2y) peak2y = qSlice[k][ulCol];
      }
      const inCrashZone = qPrice < peak2y * crashFactor;

      if (diff > 0 && !inCrashZone) {
        // SELL: TQQQ above signal, sell excess to cash
        const sharesToSell = diff / qPrice;
        tqqqShares -= sharesToSell;
        cash += diff;
        action = 'SELL ' + fmt(diff);
        crashNoSellCount = 0;
      } else if (diff > 0 && inCrashZone && crashNoSellCount < 2) {
        // Signal says sell but we're in crash zone and haven't skipped 2 times yet — hold
        crashNoSellCount++;
        action = 'HOLD (30d ' + crashNoSellCount + '/2)';
      } else if (diff > 0 && inCrashZone && crashNoSellCount >= 2) {
        // Crash zone but already skipped 2 consecutive quarters — sell anyway
        const sharesToSell = diff / qPrice;
        tqqqShares -= sharesToSell;
        cash += diff;
        action = 'SELL ' + fmt(diff) + ' (30d expired)';
        crashNoSellCount = 0;
      } else if (diff < 0 && cash > 0) {
        // BUY: TQQQ below signal, buy from cash (90% throttle)
        crashNoSellCount = 0;
        const available = cash * 0.9;
        const needed = Math.min(-diff, available);
        if (needed > 0) {
          const sharesToBuy = needed / qPrice;
          tqqqShares += sharesToBuy;
          cash -= needed;
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
      if (quarterlyTqqqGain >= spikeTrigger && postAlloc >= 0.60 && postAlloc <= 1.0 && !inCrashZone) {
        const targetTqqqVal = postTotal * 0.60;
        const reduceBy = postTqqqVal - targetTqqqVal;
        tqqqShares = targetTqqqVal / qPrice;
        cash       = postTotal - targetTqqqVal;
        signalLine = targetTqqqVal;
        action = 'RESET ' + fmt(reduceBy) + ' (spike)';
      }

      const tqqqVal = tqqqShares * qPrice;
      // Reset signal line to actual TQQQ value after rebalancing if we couldn't close the gap
      if (tqqqVal < signalLine) signalLine = tqqqVal;
      log.push({ date: qDate, price: qPrice, tqqqVal, cash, total: tqqqVal + cash, action, invested: totalInvested, investedCompounded, target: signalLine });
    } else {
      // First quarter — just record starting state
      const tqqqVal = tqqqShares * qSlice[0][ulCol];
      log.push({ date: qDate, price: qSlice[0][ulCol], tqqqVal, cash, total: tqqqVal + cash, action: 'START', invested: totalInvested, investedCompounded, target: signalLine });
    }
    prevQDate = qDate;
  }

  if (skipBH) return { log, totalContributed: totalInvested, soxlPoints: [], qqq5Points: [] };

  // Buy & hold TQQQ. Always reads column 1 — the chart's "B&H TQQQ" line
  // tracks real TQQQ regardless of which underlying the main strategy uses.
  let bhShares = initial / qSlice[0][1];
  let bhPrevQ = qSlice[0][0];
  const bhPoints = [];

  for (let qi = 0; qi < qSlice.length; qi++) {
    const qDate  = qSlice[qi][0];
    const qPrice = qSlice[qi][1];
    if (qi > 0) {
      const yr = parseInt(qDate.substring(0, 4));
      const bhMonthly = monthly * Math.pow(1 + annualRaise, yr - startYear);
      if (fastMonthly) {
        const monthsInQ = monthlyByQuarter[entryIdx + qi];
        for (let k = 0; k < monthsInQ.length; k++) {
          bhShares += bhMonthly / monthlyData[monthsInQ[k]][1];
        }
      } else {
        for (const [mDate, mPrice] of monthlyData) {
          if (mDate > bhPrevQ && mDate <= qDate) {
            bhShares += bhMonthly / mPrice;
          }
        }
      }
    }
    bhPoints.push({ date: qDate, value: bhShares * qPrice });
    bhPrevQ = qDate;
  }

  // Buy & hold QQQ
  let qqqShares = initial / qSlice[0][2];
  let qqqPrevQ = qSlice[0][0];
  const qqqPoints = [];

  for (let qi = 0; qi < qSlice.length; qi++) {
    const [qDate, , qqqPrice] = qSlice[qi];
    if (qi > 0) {
      const yr = parseInt(qDate.substring(0, 4));
      const qqqMonthly = monthly * Math.pow(1 + annualRaise, yr - startYear);
      if (fastMonthly) {
        const monthsInQ = monthlyByQuarter[entryIdx + qi];
        for (let k = 0; k < monthsInQ.length; k++) {
          qqqShares += qqqMonthly / monthlyData[monthsInQ[k]][2];
        }
      } else {
        for (const [mDate, , mQqqPrice] of monthlyData) {
          if (mDate > qqqPrevQ && mDate <= qDate) {
            qqqShares += qqqMonthly / mQqqPrice;
          }
        }
      }
    }
    qqqPoints.push({ date: qDate, value: qqqShares * qqqPrice });
    qqqPrevQ = qDate;
  }

  // Buy & hold SPY
  let spyShares = qSlice[0][3] ? initial / qSlice[0][3] : 0;
  let spyPrevQ = qSlice[0][0];
  const spyPoints = [];

  for (let qi = 0; qi < qSlice.length; qi++) {
    const [qDate, , , spyPrice] = qSlice[qi];
    if (qi > 0 && spyPrice) {
      const yr = parseInt(qDate.substring(0, 4));
      const spyMonthly = monthly * Math.pow(1 + annualRaise, yr - startYear);
      if (fastMonthly) {
        const monthsInQ = monthlyByQuarter[entryIdx + qi];
        for (let k = 0; k < monthsInQ.length; k++) {
          const mSpyPrice = monthlyData[monthsInQ[k]][3];
          if (mSpyPrice) spyShares += spyMonthly / mSpyPrice;
        }
      } else {
        for (const [mDate, , , mSpyPrice] of monthlyData) {
          if (mDate > spyPrevQ && mDate <= qDate && mSpyPrice) {
            spyShares += spyMonthly / mSpyPrice;
          }
        }
      }
    }
    spyPoints.push({ date: qDate, value: spyPrice ? spyShares * spyPrice : 0 });
    spyPrevQ = qDate;
  }

  // Buy & hold SOXL. Synthesized SOXL prices only exist from 1994-05 onward;
  // entries before then have qPrice = 0 and are silently skipped — the
  // soxlPoints series will be 0 until the first available quarter.
  let soxlShares = qSlice[0][4] ? initial / qSlice[0][4] : 0;
  let soxlPrevQ = qSlice[0][0];
  let soxlSeeded = !!qSlice[0][4];
  const soxlPoints = [];

  for (let qi = 0; qi < qSlice.length; qi++) {
    const [qDate, , , , soxlPrice] = qSlice[qi];
    if (qi > 0 && soxlPrice) {
      // First real SOXL quarter for sims that started pre-1994: seed the
      // lump-sum initial here so the series begins at the user's starting
      // balance rather than $0.
      if (!soxlSeeded) {
        soxlShares = initial / soxlPrice;
        soxlSeeded = true;
      }
      const yr = parseInt(qDate.substring(0, 4));
      const soxlMonthly = monthly * Math.pow(1 + annualRaise, yr - startYear);
      if (fastMonthly) {
        const monthsInQ = monthlyByQuarter[entryIdx + qi];
        for (let k = 0; k < monthsInQ.length; k++) {
          const mSoxlPrice = monthlyData[monthsInQ[k]][4];
          if (mSoxlPrice) soxlShares += soxlMonthly / mSoxlPrice;
        }
      } else {
        for (const [mDate, , , , mSoxlPrice] of monthlyData) {
          if (mDate > soxlPrevQ && mDate <= qDate && mSoxlPrice) {
            soxlShares += soxlMonthly / mSoxlPrice;
          }
        }
      }
    }
    soxlPoints.push({ date: qDate, value: soxlPrice ? soxlShares * soxlPrice : 0 });
    soxlPrevQ = qDate;
  }

  // Buy & hold QQQ5 (fully synthetic 5× QQQ; column 5 in quarterlyData).
  // Always available from 1938 like TQQQ since it's pure-synthetic.
  let qqq5Shares = qSlice[0][5] ? initial / qSlice[0][5] : 0;
  let qqq5PrevQ  = qSlice[0][0];
  const qqq5Points = [];

  for (let qi = 0; qi < qSlice.length; qi++) {
    const qDate    = qSlice[qi][0];
    const qqq5P    = qSlice[qi][5];
    if (qi > 0 && qqq5P) {
      const yr = parseInt(qDate.substring(0, 4));
      const qqq5Monthly = monthly * Math.pow(1 + annualRaise, yr - startYear);
      if (fastMonthly) {
        const monthsInQ = monthlyByQuarter[entryIdx + qi];
        for (let k = 0; k < monthsInQ.length; k++) {
          const mP = monthlyData[monthsInQ[k]][5];
          if (mP) qqq5Shares += qqq5Monthly / mP;
        }
      } else {
        for (const row of monthlyData) {
          if (row[0] > qqq5PrevQ && row[0] <= qDate && row[5]) {
            qqq5Shares += qqq5Monthly / row[5];
          }
        }
      }
    }
    qqq5Points.push({ date: qDate, value: qqq5P ? qqq5Shares * qqq5P : 0 });
    qqq5PrevQ = qDate;
  }

  // Adaptive: state machine is calendar-anchored — determined by trailing-10y
  // ratio of $1-invested-10y-ago B&H TQQQ vs simplified 9sig, evaluated against
  // the global timeline. So entering at 1995 vs 2010 doesn't change *when* the
  // strategy switches — only what portfolio you've accumulated by then.
  // Callers running many sims with the same strategy params can pass a
  // pre-computed `opts.adaptiveStates` to skip this recomputation.
  const adaptiveStates = opts.adaptiveStates || computeAdaptiveStates(switchTo9sig, switchToAllIn, yearsBack, ulCol, qGrowth);
  let aState = adaptiveStates[entryIdx];
  let aCash, aShares, aSignal;
  if (aState === '9sig') {
    aCash   = initial * 0.4;
    aShares = (initial * 0.6) / qSlice[0][ulCol];
    aSignal = initial * 0.6;
  } else {
    aCash   = 0;
    aShares = initial / qSlice[0][ulCol];
    aSignal = 0;
  }
  let aPrevQ = qSlice[0][0];
  let aCrashCount = 0;  // mirror of main 9sig's crashNoSellCount for the 30-down rule
  const adaptivePoints = [];

  for (let qi = 0; qi < qSlice.length; qi++) {
    const qDate  = qSlice[qi][0];
    const qPrice = qSlice[qi][ulCol];
    let aNewCashThisQ = 0;
    if (qi > 0) {
      const yr = parseInt(qDate.substring(0, 4));
      const aMonthly = monthly * Math.pow(1 + annualRaise, yr - startYear);
      if (fastMonthly) {
        const monthsInQ = monthlyByQuarter[entryIdx + qi];
        for (let k = 0; k < monthsInQ.length; k++) {
          const mPrice = monthlyData[monthsInQ[k]][1];
          if (aState === 'all-in') {
            aShares += aMonthly / mPrice;
          } else {
            aCash += aMonthly;
            aCash *= (1 + monthlyRate);
            aNewCashThisQ += aMonthly;
          }
        }
      } else {
        for (const [mDate, mPrice] of monthlyData) {
          if (mDate > aPrevQ && mDate <= qDate) {
            if (aState === 'all-in') {
              aShares += aMonthly / mPrice;
            } else {
              aCash += aMonthly;
              aCash *= (1 + monthlyRate);
              aNewCashThisQ += aMonthly;
            }
          }
        }
      }

      const newState = adaptiveStates[entryIdx + qi];
      if (newState !== aState) {
        if (newState === '9sig') {
          const tv = aShares * qPrice;
          aCash = tv * 0.4;
          aShares = (tv * 0.6) / qPrice;
          aSignal = tv * 0.6;
        } else {
          aShares += aCash / qPrice;
          aCash = 0;
          aSignal = 0;
        }
        aCrashCount = 0;
        aState = newState;
      }

      if (aState === '9sig') {
        aSignal = aSignal * (1 + qGrowth) + aNewCashThisQ * 0.5;
        const tv = aShares * qPrice;
        const diff = tv - aSignal;

        // 30-down no-sell rule — same as main 9sig leg
        const twoYearsAgoA = (parseInt(qDate.substring(0, 4)) - 2) + qDate.substring(4);
        let peak2yA = qPrice;
        for (let k = qi; k >= 0; k--) {
          if (qSlice[k][0] < twoYearsAgoA) break;
          if (qSlice[k][ulCol] > peak2yA) peak2yA = qSlice[k][ulCol];
        }
        const inCrashZoneA = qPrice < peak2yA * crashFactor;

        if (diff > 0 && !inCrashZoneA) {
          aShares -= diff / qPrice;
          aCash += diff;
          aCrashCount = 0;
        } else if (diff > 0 && inCrashZoneA && aCrashCount < 2) {
          aCrashCount++;
        } else if (diff > 0 && inCrashZoneA && aCrashCount >= 2) {
          aShares -= diff / qPrice;
          aCash += diff;
          aCrashCount = 0;
        } else if (diff < 0 && aCash > 0) {
          aCrashCount = 0;
          const buy = Math.min(-diff, aCash * 0.9);
          aShares += buy / qPrice;
          aCash -= buy;
        } else {
          aCrashCount = 0;
        }
        // Spike reset: same canonical 9Sig rule as the main leg.
        const aPrevTqqqPrice = qSlice[qi - 1][ulCol];
        const aQuarterGain = aPrevTqqqPrice > 0 ? (qPrice - aPrevTqqqPrice) / aPrevTqqqPrice : 0;
        const aPostTqqqVal = aShares * qPrice;
        const aPostTotal   = aPostTqqqVal + aCash;
        const aPostAlloc   = aPostTotal > 0 ? aPostTqqqVal / aPostTotal : 0;
        if (aQuarterGain >= spikeTrigger && aPostAlloc >= 0.60 && aPostAlloc <= 1.0 && !inCrashZoneA) {
          const target = aPostTotal * 0.60;
          aShares = target / qPrice;
          aCash   = aPostTotal - target;
          aSignal = target;
        }
        const ntv = aShares * qPrice;
        if (ntv < aSignal) aSignal = ntv;
      }
    }
    adaptivePoints.push({ date: qDate, value: aShares * qPrice + aCash, state: aState });
    aPrevQ = qDate;
  }

  return { log, bhPoints, qqqPoints, spyPoints, soxlPoints, qqq5Points, adaptivePoints, totalContributed: totalInvested };
}

