// Parse "M/D/YYYY HH:MM:SS" -> "YYYY-MM-DD", auto-detect delimiter (tab or comma)
function parseDataFile(text) {
  const lines = text.trim().split(/\r?\n/).slice(1);
  const sep = lines[0].includes('\t') ? '\t' : ',';
  return lines.map(line => {
    const [dateStr, close] = line.split(sep);
    const parts = dateStr.split(' ')[0].split('/');
    const m = parts[0].padStart(2, '0');
    const d = parts[1].padStart(2, '0');
    const y = parts[2];
    return [y + '-' + m + '-' + d, parseFloat(close)];
  });
}

async function loadQQQDaily() {
  const resp = await fetch('data/synthetic-qqq.tsv?v=baked');
  return parseDataFile(await resp.text());
}

async function loadTQQQDaily() {
  const resp = await fetch('data/synthetic-tqqq.tsv?v=baked');
  return parseDataFile(await resp.text());
}

async function loadSPYDaily() {
  const resp = await fetch('data/spy.tsv?v=baked');
  return parseDataFile(await resp.text());
}

async function loadSOXLDaily() {
  const resp = await fetch('data/synthetic-soxl.tsv?v=baked');
  return parseDataFile(await resp.text());
}

async function loadQQQ5Daily() {
  const resp = await fetch('data/synthetic-qqq5.tsv?v=baked');
  return parseDataFile(await resp.text());
}

// Merge daily TSVs by date. The TQQQ TSV already contains synthesized pre-2010
// rows (baked by update_data.py), so this is a straight join — no synthesis here.
// SOXL data only starts 1994-05; pre-1994 rows get soxl: 0 and the simulate
// loop skips contributions / valuation when that price is 0.
function buildDaily(qqqDaily, tqqqDaily, spyDaily, soxlDaily, qqq5Daily) {
  const tqqqMap = new Map(tqqqDaily.map(d => [d[0], d[1]]));
  const spyMap  = new Map(spyDaily.map(d => [d[0], d[1]]));
  const soxlMap = new Map(soxlDaily.map(d => [d[0], d[1]]));
  const qqq5Map = qqq5Daily ? new Map(qqq5Daily.map(d => [d[0], d[1]])) : null;
  const result = [];
  for (const [date, qqqPrice] of qqqDaily) {
    const tqqqPrice = tqqqMap.get(date);
    if (tqqqPrice != null) {
      result.push({
        date,
        qqq:  qqqPrice,
        tqqq: tqqqPrice,
        spy:  spyMap.get(date) || 0,
        soxl: soxlMap.get(date) || 0,
        qqq5: qqq5Map ? (qqq5Map.get(date) || 0) : 0,
      });
    }
  }
  return result;
}

let daily; // populated by init()

// === Derive quarterly and monthly from daily ===
function lastOfPeriod(daily, periodFn) {
  const groups = {};
  daily.forEach(d => {
    const key = periodFn(d.date);
    groups[key] = d; // last one wins
  });
  return Object.values(groups);
}

function getQuarter(dateStr) {
  const m = parseInt(dateStr.substring(5, 7));
  const q = m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';
  return dateStr.substring(0, 4) + '-' + q;
}

function getMonth(dateStr) {
  return dateStr.substring(0, 7);
}

let quarterlyData, monthlyData; // populated by init()
let dailyDateToIdx; // populated by init()
// monthlyByQuarter[qi] = indices into monthlyData whose date falls in
// (quarterlyData[qi-1].date, quarterlyData[qi].date]. Replaces simulate()'s
// hot per-quarter scan of all of monthlyData with an O(1) lookup of the 2-3
// monthly entries that actually matter for that quarter. Computed once after
// data load. Only used when simulate runs against the default quarterlyData;
// envelope-shifted runs fall back to the linear scan.
let monthlyByQuarter = null;

function precomputeMonthlyByQuarter() {
  if (!quarterlyData || !monthlyData) { monthlyByQuarter = null; return; }
  const out = new Array(quarterlyData.length);
  out[0] = [];
  let mIdx = 0;
  // Skip months at-or-before the first quarter (they don't belong to any window).
  while (mIdx < monthlyData.length && monthlyData[mIdx][0] <= quarterlyData[0][0]) mIdx++;
  for (let qi = 1; qi < quarterlyData.length; qi++) {
    const curDate = quarterlyData[qi][0];
    const list = [];
    while (mIdx < monthlyData.length && monthlyData[mIdx][0] <= curDate) {
      list.push(mIdx);
      mIdx++;
    }
    out[qi] = list;
  }
  monthlyByQuarter = out;
}
let shiftedQuarterlyCache = []; // populated by init() — array of qData arrays, parallel to envelopeShiftDays
let envelopeShiftDays    = []; // populated by init() — trading-day shift for each cache slot
let envelopeShiftCount   = 0;  // populated by init() — = envelopeShiftDays.length

// One trading-quarter is roughly 63 trading days (5 days × 13 weeks, holidays
// notwithstanding). Used to space the coarse "quarter-offset" envelope lines.
const ENVELOPE_DAYS_PER_QUARTER = 63;
const ENVELOPE_QUARTER_OFFSETS  = 40;  // # of additional quarter-spaced offsets

// Build the list of trading-day shifts the envelope renders. Combines:
//   • 1..63 daily shifts — fine-grained "what if the rebalance day-of-quarter
//     was different" sensitivity within a single quarter.
//   • 63 + k×63 for k=1..40 quarter-spaced shifts — coarse "what if the
//     strategy started k quarters earlier" comparison band.
function buildEnvelopeShifts() {
  const shifts = [];
  for (let d = 1; d <= ENVELOPE_DAYS_PER_QUARTER; d++) shifts.push(d);
  for (let q = 1; q <= ENVELOPE_QUARTER_OFFSETS; q++) {
    shifts.push(ENVELOPE_DAYS_PER_QUARTER + q * ENVELOPE_DAYS_PER_QUARTER);
  }
  return shifts;
}

function getShiftedQuarterly(dayShift) {
  return quarterlyData.map(q => {
    const naturalIdx = dailyDateToIdx.get(q[0]);
    if (naturalIdx == null) return q;
    const shiftedIdx = Math.max(0, naturalIdx - dayShift);
    const d = daily[shiftedIdx];
    return [d.date, d.tqqq, d.qqq, d.spy, d.soxl, d.qqq5];
  });
}

// === Simple Moving Average precomputation ===
// Used by the SMA timing strategy: at each rebalance check, compare the
// signal asset's close to its N-day SMA on the same day. If above → hold
// TQQQ; if below → move to cash (cash bucket accrues the configured rate).
//
// We precompute the full daily SMA series for every (asset, window) pair
// the UI exposes, then sample at each monthly-data entry so the strategy
// loop is an O(months) walk with no per-step recomputation. The heatmap
// runs many simulations so this matters.
const SMA_WINDOWS = [100, 150, 200, 250];
const SMA_ASSETS  = ['qqq', 'spy'];
let smaAtMonthlyByKey = null; // { 'qqq_200': [sma per monthlyData entry, or null] }

function rollingSMA(values, window) {
  const out = new Array(values.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v > 0) { sum += v; count++; }
    if (i >= window) {
      const drop = values[i - window];
      if (drop > 0) { sum -= drop; count--; }
    }
    out[i] = count === window ? sum / window : null;
  }
  return out;
}

function precomputeSMASeries() {
  smaAtMonthlyByKey = {};
  if (!daily || !monthlyData || !dailyDateToIdx) return;
  const seriesByAsset = {
    qqq: daily.map(d => d.qqq),
    spy: daily.map(d => d.spy),
  };
  for (const asset of SMA_ASSETS) {
    const dailyVals = seriesByAsset[asset];
    for (const w of SMA_WINDOWS) {
      const dailySMA = rollingSMA(dailyVals, w);
      // Map each monthlyData entry's date → SMA value on that day. Stored
      // as a parallel array so simulateSMA can index by monthly position.
      smaAtMonthlyByKey[asset + '_' + w] = monthlyData.map(([date]) => {
        const idx = dailyDateToIdx.get(date);
        return idx != null ? dailySMA[idx] : null;
      });
    }
  }
}
