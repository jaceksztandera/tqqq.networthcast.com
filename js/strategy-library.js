// Strategy Library — a read-only catalog of the 25 best-known LETF timing /
// rotation strategies, shown in a modal table. Reference only for now (no chart
// integration); the `runnable` flag is here so a later pass can wire the
// engine-supported ones up to one-click "Add".
//
// `here` = CAGR / maxDD computed from THIS app's own daily TSVs over the TQQQ
// era (2010-02-11 → 2026-07-10), apples-to-apples — see backtest_strategies.py.
// `reported` = the source's self-reported figure over ITS OWN period (shown in
// parentheses); not comparable across rows.
const STRATEGY_LIBRARY = [
  { n: 1, name: 'Faber 10-month / 200-day Timing Model', tag: 'foundation', runnable: true,
    rules: 'Signal: S&P/QQQ vs 10-mo SMA (≈200-day). Enter: monthly close > SMA → hold. Exit: monthly close < SMA → T-bills. Freq: monthly (last trading day).',
    here: '31.3% / −69.9%', reported: '10.2% vs 9.3% B&H (S&P 1901–2012)', src: 'F' },
  { n: 2, name: 'Gayed & Bilello LRS 3× — Leverage for the Long Run', tag: 'academic', runnable: true,
    rules: 'Signal: S&P 500 Total-Return vs 200-day SMA. Enter > SMA → 3× S&P. Exit < SMA → T-bills. Freq: daily. ~5 round-trips/yr.',
    here: '≈ #10', reported: '26.8% CAGR · −92.2% DD · Sharpe 0.47 (1928–2015)', src: 'GB' },
  { n: 3, name: 'Gayed & Bilello LRS 2×', tag: 'academic', runnable: true,
    rules: 'As #2 at 2× leverage. Signal from unlevered S&P TR vs 200-day SMA. Park: T-bills. Freq: daily.',
    here: '≈ SSO rows', reported: '19.1% CAGR · −78.7% DD · Sharpe 0.51 (1928–2015)', src: 'GB' },
  { n: 4, name: 'Gayed & Bilello LRS 1.25×', tag: 'academic', runnable: true,
    rules: 'As #2 at 1.25× — the conservative arm. Signal: S&P TR vs 200-day SMA. Freq: daily.',
    here: '—', reported: '12.4% annual (1928–2015)', src: 'GB' },
  { n: 5, name: "HedgeFundie's Excellent Adventure (55/45 UPRO/TMF)", tag: 'portfolio', runnable: false, needs: 'TMF',
    rules: 'Static: 55% UPRO (3× S&P) + 45% TMF (3× long Treasury), quarterly rebalance. Optional 200-SMA overlay on the UPRO leg. Freq: quarterly.',
    here: '—', reported: 'Famous Bogleheads portfolio; 2022 exposed both-legs-down risk', src: 'BH' },
  { n: 6, name: 'Alvarez UPRO/TQQQ composite', tag: 'composite', runnable: false, needs: 'VIX',
    rules: 'Monthly. Gates: VIX≤25 · S&P>200-day MA · VWO mom>0 · BND mom>0. All true → 50% UPRO+50% TQQQ. 1–2 false → 50% QQQ+50% SPY. 3–4 false → 100% TLT.',
    here: '—', reported: '24.4% CAR · −54% DD (2010–2023)', src: 'ALV' },
  { n: 7, name: 'Antonacci Dual Momentum → LETF sleeve (GEM)', tag: 'momentum', runnable: false, needs: 'VWO/BND',
    rules: 'Absolute filter: underlying 12-mo return > T-bills. Relative pick: stronger of S&P/Nasdaq momentum → hold matching 3×; else T-bills. Freq: monthly.',
    here: '—', reported: 'Widely-cited momentum framework; LETF amplifies premium + whipsaw', src: 'QP' },
  { n: 8, name: 'Siegel 200-day ±1% band', tag: 'origin', runnable: true,
    rules: 'Signal: index vs 200-day SMA with symmetric ±1% band. Enter: close ≥ +1% above. Exit: close ≤ −1% below → T-bills. Freq: daily.',
    here: '—', reported: 'Origin of the whipsaw-buffer idea (DJIA 1886–2006)', src: 'F' },
  { n: 9, name: 'Canonical 200-day SMA on TQQQ (r/LETF)', tag: 'community', runnable: true,
    rules: 'Signal: S&P/QQQ vs 200-day SMA. Enter > SMA → TQQQ. Exit < SMA → cash. Freq: daily/monthly. Note: UPRO cleaner than TQQQ on an S&P signal.',
    here: '32.8% / −55.9%', reported: 'S&P 200MA 6.7% vs 7.4% B&H · DD 29% vs 56% (1960–)', src: 'BH·GS' },
  { n: 10, name: 'QQQ 200-day → TQQQ (matched index, cash park)', tag: 'app', runnable: true,
    rules: 'Signal: QQQ vs its 200-day SMA → trade TQQQ. Enter > SMA → TQQQ; Exit < SMA → cash. Matched-index avoids basis risk. Freq: daily.',
    here: '32.8% / −55.9%', reported: "The app's canonical SMA config", src: 'F·BH' },
  { n: 11, name: 'SPY 200-day → UPRO (clean matched)', tag: 'community', runnable: true,
    rules: 'Signal: SPY/S&P vs 200-day SMA → trade UPRO (3× S&P). Enter > SMA; Exit < SMA → T-bills. Signal + exposure share the index. Freq: daily.',
    here: '36.8% / −58.9%', reported: '"Cleaner than TQQQ" — no SPX↔NDX basis risk', src: 'BH' },
  { n: 12, name: 'SSO/SHY 200-day own-price rotation (2×)', tag: 'app', runnable: true,
    rules: "Signal: SSO's OWN price vs 200-day SMA. Enter > SMA → SSO. Exit < SMA → SHY (1–3yr T). Re-enter on cross up. Freq: daily.",
    here: '14.9% / −42.2%', reported: 'Sharpe 0.555 vs 0.524 B&H SPY (5-yr)', src: 'SSO' },
  { n: 13, name: 'Hollywood SPY 200SMA +4%/−3% → TQQQ/QQQ', tag: 'community', runnable: true,
    rules: 'Signal: SPY vs 200-day SMA, asymmetric band. Enter: SPY ≥ +4% above → 100% TQQQ. Exit: SPY ≤ −3% below → 100% QQQ (never cash). Freq: daily. + bodyguard + DCA-back-in.',
    here: '40.6% / −59.9%', reported: '27.3% CAGR · −95.8% DD · Sharpe 0.71 (1985–2026)', src: 'HW' },
  { n: 14, name: 'Three-phase TQQQ/QLD/GLDM', tag: 'community', runnable: false, needs: 'gold',
    rules: 'P1: SPY>200SMA+4% → 100% TQQQ. P2: after 366 days held → 50% QLD (2×)+50% GLDM (gold). P3: SPY<200SMA−3% → 50% SGOV+50% GLDM. Freq: daily.',
    here: '—', reported: 'Published backtest sheet with dated trades', src: '3PH' },
  { n: 15, name: 'Composer TQQQ-RSI (200MA + RSI + PPO)', tag: 'oscillator', runnable: false,
    rules: '200-day trend filter AND RSI AND PPO. Buy TQQQ on dips within the uptrend; else park in SHV. Freq: daily rotation.',
    here: '—', reported: '69.11% ann · −23.5% DD · Sharpe 1.47 (since Sep 2023, short)', src: 'CMP' },
  { n: 16, name: 'Composer multi-signal + hedges', tag: 'oscillator', runnable: false, needs: 'SQQQ/UVXY',
    rules: '#15 plus tactical hedges: brief SQQQ (−3×) or UVXY after extreme moves; TECL (3×) on sharp declines. Freq: daily.',
    here: '—', reported: 'Highest-complexity Composer variant', src: 'CMP' },
  { n: 17, name: 'Petrou weekly-MACD → TQQQ (+ stops)', tag: 'crossover', runnable: false,
    rules: 'Signal: QQQ/NDX weekly MACD. Enter: MACD crosses above zero → TQQQ. Exit: crosses below zero → cash. Stops: 10% hard + 30% trailing. Freq: weekly.',
    here: '—', reported: '+11,194% (Feb 2010–Jul 2025)', src: 'MACD' },
  { n: 18, name: '40-week SMA crossover → TQQQ', tag: 'crossover', runnable: true,
    rules: 'Signal: NDX vs 40-week SMA (≈200-day, weekly grain). Enter: weekly close > SMA → TQQQ. Exit: < SMA → cash. Freq: weekly.',
    here: '—', reported: '+2,800% (Petrou comparison window)', src: 'MACD' },
  { n: 19, name: 'Golden / Death Cross 50/200', tag: 'crossover', runnable: false,
    rules: 'Enter: 50-day SMA crosses above 200-day SMA (golden) → LETF. Exit: death cross (50 < 200) → cash/T-bills. Freq: daily.',
    here: '35.6% / −69.9%', reported: 'Classic MA-crossover; slower than price-vs-200', src: 'GS' },
  { n: 20, name: 'Volatility targeting (scale leverage to target vol)', tag: 'risk', runnable: false,
    rules: 'Leverage = target-vol ÷ trailing realized vol, capped at fund multiple; deleverage as vol rises. Targets 15–25%. Often + 200-SMA gate. Freq: weekly/monthly.',
    here: '—', reported: 'Reduces tail risk without binary exits (QuantConnect)', src: 'QC' },
  { n: 21, name: 'VIX-scaled leverage ladder', tag: 'risk', runnable: false, needs: 'VIX',
    rules: 'Map VIX to leverage: VIX<15 → 3×, 15–25 → 2×, 25–35 → 1×, >35 → cash. Freq: daily/weekly. Ancestor of the Alvarez VIX gate.',
    here: '—', reported: 'Transparent regime ladder; deleverages into fear', src: 'ALV·QC' },
  { n: 22, name: 'Connors RSI(2) dip-buy in uptrend', tag: 'oscillator', runnable: false,
    rules: 'Trend filter: price > 200-day SMA. Entry: buy TQQQ when RSI(2) < 10 (oversold). Exit: RSI(2) > 70 or price < 200SMA. Freq: daily.',
    here: '—', reported: 'Short-term mean-reversion inside the trend filter', src: 'QS' },
  { n: 23, name: '200-day SMA + RSI exit & re-entry', tag: 'app', runnable: true,
    rules: 'Overheat exit: RSI(10) ≥ threshold → exit to cash even above SMA. Cool-gate entry: on BUY, wait until RSI(10) drops below a cool level before re-entering. Freq: daily.',
    here: '—', reported: 'Sell when overbought, wait for a dip to buy back; app-implemented', src: 'CMP' },
  { n: 24, name: 'Bodyguard deleverage overlay (+30 / +40)', tag: 'app', runnable: true,
    rules: 'Independent of primary signal: underlying ≥ 30% above its 200SMA → swap 3×→QQQ (1×); ≥ 40% above → sell everything to cash. Instant (overrides DCA).',
    here: '—', reported: 'Dot-com-froth insurance; app-implemented', src: 'HW' },
  { n: 25, name: 'Always-invested park + DCA-back-in', tag: 'app', runnable: true,
    rules: 'On SELL, hold QQQ/SPY (1×) instead of cash. On BUY, DCA into QQQ over 6–12 mo or until SPY reclaims +4% above 200SMA, then rotate fully to TQQQ.',
    here: '39.5% / −58.7%', reported: '+6.91% avg holding QQQ vs bonds in downturns; app-implemented', src: 'HW' },
];

const STRATEGY_SRC_LINKS = {
  F:   'https://mebfaber.com/wp-content/uploads/2016/05/SSRN-id962461.pdf',
  GB:  'https://cmtassociation.org/wp-content/uploads/2025/08/2016-gayed-bilello.pdf',
  ALV: 'https://alvarezquanttrading.com/blog/upro-tqqq-leveraged-etf-strategy/',
  MACD:'https://www.lambrospetrou.com/articles/investing-leveraged-qqq-macd/',
  SSO: 'https://www.brightworkresearch.com/using-letfs-combined-with-the-200-day-moving-average-trading-approach/',
  HW:  'https://bestfolio.app/strategies/tqqq-qqq-band',
  '3PH':'https://www.tradingview.com/script/cbUgg7hl-SPY-200SMA-4-Entry-3-Exit-TQQQ-QLD-GLDM-THREE-PHASE-STRATEGY/',
  CMP: 'https://www.composer.trade/trading-strategies/tqqq-rsi-strategy-Lh0fYfA5RJQmpyfGEORb',
  BH:  'https://www.bogleheads.org/forum/viewtopic.php?t=297591',
  GS:  'https://graniteshares.com/research/the-200-moving-average-strategy-explained/',
  QS:  'https://www.quantifiedstrategies.com/200-day-moving-average-trading-strategy/',
  QC:  'https://www.quantconnect.com/research/15351/leveraged-etfs-with-systematic-risk-management/',
  QP:  'https://quantpedia.com/leveraged-etfs-in-asset-allocation-opportunity-or-trap/',
  'BH·GS': 'https://www.bogleheads.org/forum/viewtopic.php?t=297591',
  'F·BH':  'https://mebfaber.com/wp-content/uploads/2016/05/SSRN-id962461.pdf',
  'ALV·QC':'https://alvarezquanttrading.com/blog/upro-tqqq-leveraged-etf-strategy/',
};

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// CAGR / max-drawdown per strategy over three eras, computed from this app's own
// daily data (lump-sum $10k, no contributions, cash=0%) — see verify3.js.
const SL_METRICS = {"1":{1990:{cagr:23.1,dd:86},2000:{cagr:-15.1,dd:86},2010:{cagr:33.7,dd:50.6}},"2":{1990:{cagr:16.4,dd:64},2000:{cagr:-7.5,dd:61},2010:{cagr:21.2,dd:48.7}},"3":{1990:{cagr:13,dd:45.9},2000:{cagr:-3.3,dd:45},2010:{cagr:15.7,dd:35.2}},"8":{1990:{cagr:26.7,dd:82.9},2000:{cagr:-9.8,dd:82.9},2010:{cagr:26.8,dd:60.5}},"9":{1990:{cagr:25.5,dd:93.6},2000:{cagr:-22.4,dd:93.6},2010:{cagr:33.8,dd:56.8}},"10":{1990:{cagr:20,dd:94},2000:{cagr:-22.9,dd:94},2010:{cagr:28.4,dd:55.8}},"11":{1990:{cagr:16.4,dd:64},2000:{cagr:-7.5,dd:61},2010:{cagr:21.2,dd:48.7}},"12":{1990:{cagr:11.7,dd:44.2},2000:{cagr:-3.1,dd:42.6},2010:{cagr:13.5,dd:39}},"13":{1990:{cagr:26.9,dd:93.8},2000:{cagr:-19.8,dd:93.8},2010:{cagr:36.4,dd:66.6}},"15":{1990:{cagr:21.4,dd:94},2000:{cagr:-22.9,dd:94},2010:{cagr:31.9,dd:55.4}},"17":{1990:{cagr:6.4,dd:91.7},2000:{cagr:-22.7,dd:90.9},2010:{cagr:18,dd:37.1}},"18":{1990:{cagr:25,dd:89.5},2000:{cagr:-13.5,dd:89.5},2010:{cagr:30.3,dd:60.6}},"19":{1990:{cagr:24.5,dd:68.9},2000:{cagr:-8.9,dd:68.9},2010:{cagr:31.8,dd:52.2}},"20":{1990:{cagr:17.2,dd:66.6},2000:{cagr:-9.6,dd:66.6},2010:{cagr:25.7,dd:32.9}},"22":{1990:{cagr:15.5,dd:47},2000:{cagr:13.7,dd:20.5},2010:{cagr:11.4,dd:39}},"23":{1990:{cagr:21.6,dd:92},2000:{cagr:-15.5,dd:92},2010:{cagr:33.8,dd:53.1}},"24":{1990:{cagr:20.2,dd:91.8},2000:{cagr:-20.6,dd:91.8},2010:{cagr:28.9,dd:55.8}},"25":{1990:{cagr:22.6,dd:96.9},2000:{cagr:-29.6,dd:96.9},2010:{cagr:35.2,dd:56.8}}};

// Quarterly equity curves 1995–2025 (lump-sum $10k): SPY B&H + each strategy,
// for the per-card log sparkline. Computed via scratchpad/curves.js.
const SL_CURVES = {"d":["1995-03","1995-06","1995-09","1995-12","1996-03","1996-06","1996-09","1996-12","1997-03","1997-06","1997-09","1997-12","1998-03","1998-06","1998-09","1998-12","1999-03","1999-06","1999-09","1999-12","2000-03","2000-06","2000-09","2000-12","2001-03","2001-06","2001-09","2001-12","2002-03","2002-06","2002-09","2002-12","2003-03","2003-06","2003-09","2003-12","2004-03","2004-06","2004-09","2004-12","2005-03","2005-06","2005-09","2005-12","2006-03","2006-06","2006-09","2006-12","2007-03","2007-06","2007-09","2007-12","2008-03","2008-06","2008-09","2008-12","2009-03","2009-06","2009-09","2009-12","2010-03","2010-06","2010-09","2010-12","2011-03","2011-06","2011-09","2011-12","2012-03","2012-06","2012-09","2012-12","2013-03","2013-06","2013-09","2013-12","2014-03","2014-06","2014-09","2014-12","2015-03","2015-06","2015-09","2015-12","2016-03","2016-06","2016-09","2016-12","2017-03","2017-06","2017-09","2017-12","2018-03","2018-06","2018-09","2018-12","2019-03","2019-06","2019-09","2019-12","2020-03","2020-06","2020-09","2020-12","2021-03","2021-06","2021-09","2021-12","2022-03","2022-06","2022-09","2022-12","2023-03","2023-06","2023-09","2023-12","2024-03","2024-06","2024-09","2024-12","2025-03","2025-06","2025-09","2025-12"],"spy":[11000,12000,13000,13700,14500,15100,15600,16800,17200,20300,21800,22500,25500,26400,23800,28900,30200,32300,30400,34800,35700,34600,34300,31400,28000,29500,25200,27700,27900,24200,20100,21700,21000,24200,24900,27900,28400,28900,28300,30800,30200,30700,31800,32300,33800,33300,35100,37500,37700,40100,40900,39400,35700,34800,31700,24900,22100,25700,29600,31500,33200,29400,32700,36200,38300,38300,33000,36900,41600,40400,42900,42800,47300,48600,51200,56600,57500,60500,61200,64200,64800,64900,60700,65000,65900,67500,70000,72800,77100,79500,83000,88600,87700,90800,97800,84500,96000,100000,102000,111000,89400,107000,117000,131000,140000,151000,152000,169000,161000,135000,129000,138000,149000,161000,156000,174000,193000,201000,213000,218000,209000,231000,250000,257000],"s":{"1":[13000,21400,25300,21900,23800,31000,36800,47700,40300,64400,90000,58800,82800,101000,56500,125000,166000,188000,196000,651000,878000,277000,146000,146000,146000,146000,146000,146000,146000,146000,146000,146000,145000,224000,272000,372000,337000,336000,260000,341000,252000,196000,190000,200000,213000,165000,165000,190000,185000,232000,276000,255000,170000,123000,123000,123000,123000,142000,218000,270000,308000,205000,174000,235000,271000,262000,220000,192000,266000,222000,270000,230000,271000,295000,401000,552000,547000,666000,770000,868000,917000,947000,845000,807000,636000,530000,708000,701000,971000,1080000,1260000,1530000,1580000,1890000,2350000,1720000,1920000,2090000,2080000,2930000,1610000,2260000,3020000,4200000,4210000,5660000,5750000,7680000,5710000,5710000,5710000,5710000,7090000,10300000,8990000,12900000,15700000,18900000,18600000,20300000,14800000,17600000,21900000,22400000],"2":[12700,16100,19500,22300,25000,27400,27800,33900,35100,53900,63400,63900,90300,95100,66600,94800,104000,120000,93900,114000,111000,71000,61800,61800,61800,61800,61800,61800,57900,50400,50400,50400,45000,56900,60000,83100,85600,88400,75600,90900,83100,74700,80700,73000,79900,69600,74100,86800,84900,98000,82500,62600,62600,55200,55200,55200,55200,54800,82500,96300,112000,70300,67000,90900,107000,105000,88600,64300,91000,80500,95300,86900,115000,123000,143000,190000,197000,226000,231000,249000,251000,250000,240000,208000,219000,219000,242000,269000,315000,341000,382000,460000,428000,462000,565000,402000,432000,453000,461000,585000,371000,401000,506000,695000,817000,1030000,1030000,1380000,999000,920000,901000,832000,785000,968000,843000,1090000,1410000,1540000,1730000,1780000,1460000,1720000,2110000,2200000],"3":[11800,13900,15900,17500,19000,20400,20800,23900,24700,33200,37400,38300,48700,50900,40600,51800,55600,62300,53300,61300,61300,46300,42600,42600,42600,42600,42600,42600,40800,37200,37200,37200,34600,40700,42400,52900,54200,55600,50200,56900,53900,50400,53300,50100,53500,49300,51900,58000,57600,63900,58400,48300,48300,44500,44500,44500,44500,44200,58200,64900,71600,52800,51200,62500,69400,69000,62100,50300,63400,59300,66700,63000,76200,80200,88600,107000,110000,121000,123000,131000,132000,132000,129000,117000,122000,122000,131000,140000,157000,165000,179000,203000,196000,207000,237000,191000,200000,207000,211000,248000,185000,196000,231000,287000,322000,376000,377000,461000,374000,354000,350000,331000,321000,372000,341000,407000,487000,520000,568000,585000,517000,579000,665000,688000],"8":[13500,22300,26300,22800,24800,32300,38300,49700,42000,67100,93700,61200,106000,130000,106000,244000,324000,368000,382000,1010000,1350000,444000,374000,374000,374000,374000,374000,374000,296000,232000,232000,232000,232000,334000,404000,553000,501000,567000,426000,608000,449000,443000,529000,505000,537000,360000,375000,432000,422000,527000,599000,424000,424000,424000,424000,424000,424000,422000,646000,800000,914000,645000,669000,905000,1040000,1010000,958000,745000,1310000,1100000,1330000,1060000,1240000,1350000,1840000,2530000,2510000,3050000,3530000,3460000,3650000,3770000,3730000,2690000,2740000,2580000,3440000,3400000,4720000,5220000,6110000,7420000,7700000,9160000,11400000,5790000,6660000,7260000,7250000,10200000,7830000,9560000,12800000,17800000,17900000,24000000,24400000,32600000,18300000,15100000,15100000,13400000,14700000,21300000,18600000,22600000,27500000,33100000,32700000,35800000,23100000,29100000,36300000,37000000],"9":[13500,22300,26300,22800,24800,32300,31800,41200,34900,55600,77700,50800,88100,108000,87800,229000,304000,346000,359000,1020000,1280000,247000,153000,153000,153000,153000,153000,153000,131000,102000,102000,102000,89500,121000,147000,201000,182000,206000,149000,199000,147000,127000,152000,140000,149000,104000,109000,125000,122000,153000,158000,133000,133000,112000,112000,112000,112000,121000,185000,229000,262000,179000,186000,251000,289000,279000,266000,206000,363000,303000,368000,292000,344000,375000,509000,701000,694000,845000,977000,1050000,1110000,1150000,1130000,1100000,1200000,1060000,1410000,1400000,1940000,2150000,2510000,3050000,3160000,3770000,4690000,2970000,3340000,3600000,3590000,5040000,3650000,4520000,6060000,8410000,8450000,11300000,11500000,15400000,9160000,7580000,7320000,6740000,7880000,11500000,10000000,13600000,16600000,19900000,19600000,21500000,15600000,19700000,24500000,25100000],"10":[13500,22300,26300,22800,20000,26000,23700,30700,26000,41400,57900,34300,51200,62700,45200,87400,116000,132000,137000,455000,614000,183000,117000,117000,117000,117000,117000,73000,58300,58300,58300,53300,36800,57200,69200,94700,83800,84000,70200,91600,64200,56200,62100,63700,67800,58900,55400,63700,62300,77800,92700,85600,70900,55900,47100,47100,47100,48700,74600,92500,106000,62700,67500,91300,105000,91600,74400,60500,101000,84200,102000,77400,91100,99200,135000,185000,184000,224000,259000,291000,308000,318000,264000,289000,263000,205000,274000,271000,376000,416000,487000,591000,614000,731000,910000,458000,493000,497000,496000,697000,429000,770000,1030000,1430000,1440000,1930000,1960000,2620000,1530000,1420000,1420000,1420000,1630000,2370000,2060000,2950000,3600000,4330000,4260000,4670000,3270000,4110000,5130000,5240000],"11":[12700,16100,19500,22300,25000,27400,27800,33900,35100,53900,63400,63900,90300,95100,66600,94800,104000,120000,93900,114000,111000,71000,61800,61800,61800,61800,61800,61800,57900,50400,50400,50400,45000,56900,60000,83100,85600,88400,75600,90900,83100,74700,80700,73000,79900,69600,74100,86800,84900,98000,82500,62600,62600,55200,55200,55200,55200,54800,82500,96300,112000,70300,67000,90900,107000,105000,88600,64300,91000,80500,95300,86900,115000,123000,143000,190000,197000,226000,231000,249000,251000,250000,240000,208000,219000,219000,242000,269000,315000,341000,382000,460000,428000,462000,565000,402000,432000,453000,461000,585000,371000,401000,506000,695000,817000,1030000,1030000,1380000,999000,920000,901000,832000,785000,968000,843000,1090000,1410000,1540000,1730000,1780000,1460000,1720000,2110000,2200000],"12":[11800,13900,15900,17500,19000,20400,19400,22300,23000,30900,34900,35700,45400,47400,38100,47200,50700,56800,49200,56300,46000,34100,33000,33000,33000,33000,33000,33000,31700,31700,31700,31700,31700,37500,39100,48800,49900,51200,45400,51000,48300,45400,48000,47600,50800,46300,49300,55100,54700,60700,47500,41400,41400,41400,41400,41400,41400,40800,52600,58600,64600,53900,52400,63900,71000,70600,63600,63600,77800,68600,77200,74800,90500,95200,105000,127000,131000,144000,146000,155000,157000,157000,149000,128000,132000,132000,142000,152000,170000,179000,194000,220000,201000,205000,236000,176000,179000,189000,193000,227000,169000,149000,166000,206000,231000,270000,271000,331000,253000,247000,247000,247000,221000,256000,235000,271000,324000,346000,378000,389000,359000,383000,440000,456000],"13":[12900,21200,25000,21700,23600,30700,36500,47300,40000,63800,89200,58300,101000,124000,81400,174000,231000,262000,273000,768000,1040000,442000,324000,181000,121000,142000,89900,121000,112000,81000,64300,75600,78300,106000,128000,175000,159000,180000,123000,163000,120000,119000,142000,149000,159000,119000,131000,151000,148000,184000,220000,192000,164000,170000,146000,112000,114000,132000,202000,251000,286000,214000,247000,327000,376000,364000,298000,318000,495000,414000,502000,428000,504000,549000,745000,1030000,1020000,1240000,1430000,1610000,1700000,1760000,1520000,1670000,1640000,1500000,2000000,1980000,2740000,3030000,3550000,4310000,4470000,5320000,6630000,4270000,4800000,5240000,5230000,7340000,5120000,7170000,9620000,13400000,13400000,18000000,18300000,24400000,13900000,8570000,8190000,8170000,10800000,15700000,13700000,19500000,23800000,28600000,28200000,30900000,22600000,29300000,36500000,37300000],"15":[13500,22800,26900,23300,20400,26600,24200,31400,26600,42400,60700,36000,53700,65800,50800,113000,165000,187000,195000,649000,875000,260000,167000,167000,167000,167000,167000,104000,83100,83100,83100,76000,52500,81500,98600,135000,119000,120000,100000,130000,91500,80000,88500,90800,96600,83900,78900,90800,88800,111000,132000,122000,101000,79600,67100,67100,67100,69400,106000,132000,150000,91400,98400,135000,159000,139000,113000,91700,154000,129000,156000,118000,139000,151000,206000,283000,280000,341000,390000,439000,464000,479000,398000,436000,397000,309000,413000,409000,561000,672000,786000,955000,999000,1190000,1480000,745000,802000,817000,815000,1150000,727000,1300000,2060000,2870000,2880000,3860000,3930000,5240000,3050000,2850000,2850000,2850000,3250000,4730000,4130000,5900000,7190000,8860000,9340000,10200000,7150000,9010000,11200000,11500000],"17":[11300,13200,11700,10100,11700,13200,15200,17200,16600,21100,24900,19800,29300,28400,23500,34100,26300,19700,21900,42000,27100,25400,22300,22300,16100,11400,11400,14900,9940,9940,7360,6850,5820,6800,6950,6370,7180,5830,5380,5560,5560,6050,6360,6400,5760,5380,5720,5710,4560,4730,5850,4280,4100,4730,4440,4440,3720,4720,6060,6220,7850,7330,8420,9710,9530,9410,8370,7380,10600,8630,8570,8110,7440,7780,9700,11000,10600,12100,12500,13700,12900,11900,11800,13200,13700,12800,15400,13400,15900,16100,17100,17200,20500,24100,22400,21200,25300,29500,29700,36100,39500,42500,42500,47000,43800,60500,60900,70100,64300,57300,67700,63900,88500,114000,104000,114000,93000,110000,107000,93800,85300,107000,112000,91400],"18":[13200,21700,25700,22200,24200,31500,37400,48400,41000,65400,91400,58400,79000,96800,83500,149000,198000,225000,234000,777000,1050000,317000,205000,205000,205000,205000,205000,165000,153000,153000,153000,153000,110000,170000,206000,282000,256000,255000,217000,270000,201000,160000,177000,186000,198000,172000,168000,193000,189000,236000,282000,260000,215000,193000,176000,176000,176000,200000,307000,380000,434000,288000,313000,424000,488000,398000,274000,209000,332000,277000,336000,235000,260000,283000,384000,529000,524000,637000,737000,831000,878000,907000,784000,897000,753000,620000,816000,808000,1120000,1240000,1450000,1760000,1830000,2180000,2710000,1900000,1910000,2080000,2070000,2910000,1910000,3420000,4580000,6370000,6390000,8580000,8720000,11600000,7940000,7940000,7940000,7940000,8220000,12000000,10400000,14900000,18200000,21900000,21500000,23600000,18500000,21500000,26800000,27400000],"19":[13500,22300,26300,22800,24800,32300,38300,49700,42000,67100,93700,61200,61400,75200,64900,143000,190000,216000,225000,747000,1010000,430000,357000,357000,357000,357000,357000,357000,357000,357000,357000,357000,330000,512000,620000,848000,769000,870000,658000,796000,588000,509000,538000,565000,602000,454000,454000,465000,455000,568000,677000,625000,409000,364000,346000,346000,346000,343000,526000,652000,744000,494000,611000,826000,951000,919000,585000,544000,958000,801000,971000,871000,939000,1020000,1390000,1910000,1890000,2300000,2670000,3000000,3170000,3280000,2690000,2840000,1770000,1850000,2470000,2440000,3380000,3750000,4380000,5320000,5520000,6570000,8190000,5460000,5460000,5730000,5710000,8030000,4420000,7520000,10100000,14000000,14000000,18900000,19200000,25600000,16100000,16100000,16100000,16100000,22000000,32000000,27900000,39900000,48600000,58500000,57600000,63100000,45800000,44400000,55300000,56500000],"20":[12200,16200,17400,16600,17000,18600,20500,23200,22200,26400,31900,27700,33400,37600,35500,44300,49100,51600,52600,79300,82700,73800,65300,52800,44400,46600,36600,43300,40000,32000,27700,30500,30400,35100,37300,41500,39600,42500,37800,45900,38000,35400,41500,40900,43100,36300,39100,42600,42400,49200,53300,52400,44200,43100,36400,32900,33300,37700,46400,51700,53700,47900,56700,68900,77100,73600,66000,70600,105000,97000,108000,98700,107000,110000,133000,172000,163000,182000,199000,203000,198000,200000,181000,201000,188000,177000,209000,205000,276000,313000,345000,409000,447000,478000,549000,408000,488000,438000,424000,559000,525000,627000,695000,807000,838000,933000,953000,1130000,1000000,833000,771000,765000,935000,1140000,1080000,1300000,1470000,1650000,1560000,1650000,1450000,1610000,1880000,2040000],"22":[10700,13300,18400,22100,22100,24100,20900,23800,26500,34000,45000,34600,37700,44200,31700,26700,31800,42300,43800,49500,75300,71100,61100,61100,61100,61100,61100,61100,61100,61100,61100,61100,61100,80600,83600,108000,120000,124000,120000,125000,121000,119000,120000,120000,131000,131000,131000,145000,152000,166000,165000,170000,149000,157000,157000,157000,157000,162000,196000,218000,214000,190000,190000,203000,211000,231000,189000,189000,200000,223000,269000,276000,286000,306000,318000,374000,388000,406000,426000,439000,523000,552000,502000,544000,524000,457000,497000,521000,565000,577000,637000,706000,577000,606000,662000,526000,526000,482000,505000,529000,514000,514000,611000,620000,574000,646000,733000,824000,801000,801000,801000,801000,841000,868000,772000,708000,780000,846000,956000,1110000,986000,1030000,1120000,1210000],"23":[14700,24700,33300,28900,25300,30900,28200,34300,29100,46400,59000,35000,42700,52300,39300,72400,106000,120000,125000,306000,480000,143000,91800,91800,91800,91800,91800,65600,52400,52400,52400,52400,38300,59500,77200,106000,96200,97100,81200,109000,76700,62300,61000,63100,67200,58300,58300,75400,73700,94800,113000,111000,92100,77700,67500,67500,67500,70800,118000,146000,156000,86700,94400,135000,159000,139000,117000,92900,135000,114000,142000,112000,131000,148000,201000,276000,274000,319000,375000,434000,458000,473000,393000,437000,396000,306000,400000,395000,494000,605000,707000,892000,872000,1040000,1290000,731000,743000,777000,776000,1070000,617000,1300000,1840000,2560000,2570000,3450000,3540000,4870000,3050000,3050000,3050000,3050000,3490000,5620000,5270000,7290000,9360000,11300000,11500000,12600000,8830000,11100000,14000000,15200000],"24":[13500,22300,27500,23900,20900,27200,24800,32100,27200,43400,60600,36000,53600,65600,47300,82500,123000,155000,162000,367000,437000,180000,115000,115000,115000,115000,115000,71800,57300,57300,57300,52500,36200,56200,68100,93200,82400,82600,69100,90000,63200,55200,61100,62700,66700,57900,54500,62600,61300,76500,91200,84200,69700,54900,46300,46300,46300,47900,73400,91000,104000,61700,66400,89800,103000,90000,73100,59500,99000,82800,100000,76100,89600,97600,132000,182000,181000,220000,254000,287000,303000,313000,260000,285000,259000,202000,270000,267000,370000,410000,479000,582000,604000,719000,895000,450000,485000,489000,488000,685000,422000,757000,1080000,1500000,1510000,2020000,2060000,2750000,1600000,1490000,1490000,1490000,1700000,2480000,2160000,3090000,3760000,4530000,4460000,4890000,3420000,4300000,5370000,5480000],"25":[13500,22300,26300,22800,21500,28000,28000,36200,30600,48900,68300,42100,66400,81300,62500,127000,169000,192000,200000,663000,895000,311000,210000,138000,92700,108000,68600,67300,53800,38900,30900,34300,27600,42800,51800,70900,63400,66300,54600,74300,53100,48400,55000,56800,60500,50700,51000,58600,57300,71600,85300,78800,59000,51500,39400,30200,30800,37400,57300,71000,81000,50600,61300,83000,95500,86200,68800,63500,108000,90100,109000,86300,102000,111000,150000,207000,205000,249000,289000,325000,344000,355000,298000,346000,318000,265000,354000,351000,486000,538000,630000,764000,793000,944000,1180000,615000,751000,779000,777000,1090000,694000,1310000,1760000,2440000,2450000,3290000,3340000,4460000,2820000,2090000,1990000,1990000,2590000,3760000,3280000,4690000,5720000,6880000,6780000,7430000,5290000,7220000,9000000,9190000]}};

const STRATEGY_ERAS = [
  { key: '1990', label: '1990–2025', sub: 'long run' },
  { key: '2000', label: '2000–2008', sub: 'dot-com + GFC' },
  { key: '2010', label: '2010–2025', sub: 'TQQQ bull' },
];

// Adding a library strategy to the chart is disabled for now. Flip to true to
// re-enable the "+ Add" buttons and the #add-<n> deep-link.
const SL_ADD_ENABLED = false;

// Which strategies have verified runnable custom-strategy code (window.STRATEGY_CODE).
function strategyHasCode(n) {
  return typeof window !== 'undefined' && window.STRATEGY_CODE && window.STRATEGY_CODE[n];
}

function fmtPct(v) {
  if (v == null || !isFinite(v)) return '—';
  return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
}

// One era metric block: label · CAGR (green/red) · max drawdown.
function eraBlockHtml(m, era) {
  const cell = m && m[era.key];
  if (!cell) return `<div class="sl-era sl-era-empty"><span class="sl-era-hd">${era.label}</span><span class="sl-era-na">—</span></div>`;
  const cagrCls = cell.cagr >= 0 ? 'pos' : 'neg';
  return `<div class="sl-era">
    <span class="sl-era-hd">${era.label}</span>
    <span class="sl-era-cagr ${cagrCls}">${fmtPct(cell.cagr)}</span>
    <span class="sl-era-dd">−${Math.round(cell.dd)}%</span>
  </div>`;
}

// Compact money: $10k, $257k, $22M, $1.3B.
function fmtMoney(v) {
  if (!(v > 0)) return '—';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(v >= 1e10 ? 0 : 1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M';
  if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'k';
  return '$' + Math.round(v);
}

// Log-scaled SVG sparkline: SPY (muted) vs this strategy, 1995→2025, with the
// start value (at the line's origin) and end values (at each line's tip) drawn
// inside the graph.
function sparklineHtml(n) {
  const curve = SL_CURVES.s && SL_CURVES.s[n], spy = SL_CURVES.spy;
  if (!curve || !spy) return '<div class="sl-spark sl-spark-empty">no data series</div>';
  const W = 300, H = 60, PAD = 3;
  const both = curve.concat(spy).filter(v => v > 0);
  const lo = Math.log10(Math.min.apply(null, both)), hi = Math.log10(Math.max.apply(null, both));
  const span = (hi - lo) || 1, N = curve.length;
  const yAt = (v) => v > 0 ? H - PAD - ((Math.log10(v) - lo) / span) * (H - 2 * PAD) : H - PAD;
  const yPct = (v) => Math.max(9, Math.min(72, (yAt(v) / H) * 100)); // keep value labels clear of the year row
  const path = (arr) => arr.map((v, i) => {
    const x = PAD + (i / (N - 1)) * (W - 2 * PAD);
    return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yAt(v).toFixed(1);
  }).join(' ');
  // Decade gridlines (powers of 10) make the log scale visible.
  let grid = '';
  for (let p = Math.ceil(lo); p <= Math.floor(hi); p++) {
    const y = yAt(Math.pow(10, p)).toFixed(1);
    grid += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" class="sl-grid"/>`;
  }
  const start = 10000; // lump-sum starter balance
  return `<div class="sl-spark" data-sl-n="${n}">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Strategy vs SPY, log scale 1995–2025">
      ${grid}
      <path d="${path(spy)}" class="sl-spark-spy" fill="none"/>
      <path d="${path(curve)}" class="sl-spark-strat" fill="none"/>
    </svg>
    <span class="sl-logtag">log ⬍</span>
    <span class="sl-lbl sl-lbl-start" style="top:${yPct(start).toFixed(0)}%">${fmtMoney(start)}</span>
    <span class="sl-lbl sl-lbl-strat" style="top:${yPct(curve[N - 1]).toFixed(0)}%">${fmtMoney(curve[N - 1])}</span>
    <span class="sl-lbl sl-lbl-spy" style="top:${yPct(spy[spy.length - 1]).toFixed(0)}%">${fmtMoney(spy[spy.length - 1])}</span>
    <span class="sl-years"><b>1995</b><b>2005</b><b>2015</b><b>2025</b></span>
    <span class="sl-cross"></span>
    <span class="sl-dot sl-dot-spy"></span>
    <span class="sl-dot sl-dot-strat"></span>
  </div>`;
}

function buildStrategyCards() {
  return STRATEGY_LIBRARY.map(s => {
    const link = STRATEGY_SRC_LINKS[s.src] || '#';
    const m = SL_METRICS[s.n];
    const has = strategyHasCode(s.n);
    let add = '';
    if (has && SL_ADD_ENABLED) add = `<button type="button" class="sl-add" data-sl-add="${s.n}">+ Add</button>`;
    else if (!has && s.needs) add = `<span class="sl-add-na" title="Needs data this app doesn't carry">needs ${esc(s.needs)}</span>`;
    else if (!has) add = `<span class="sl-add-na">soon</span>`;
    const eras = STRATEGY_ERAS.map(era => eraBlockHtml(m, era)).join('');
    return `<div class="sl-card${has ? '' : ' sl-card-off'}">
      <div class="sl-card-head">
        <a class="sl-card-name" href="${link}" target="_blank" rel="noopener" title="${esc(s.rules)}">${esc(s.name)}</a>
        ${add}
      </div>
      ${has ? sparklineHtml(s.n) : '<div class="sl-spark sl-spark-empty">no data series</div>'}
      <div class="sl-eras">${eras}</div>
    </div>`;
  }).join('');
}

// Add a library strategy to the chart as a real custom strategy (type:'custom',
// carrying the verified code). Reuses the existing custom-strategy engine — the
// line computes in the worker exactly like a user-pasted custom strategy.
function addStrategyFromLibrary(n) {
  if (!SL_ADD_ENABLED) return; // disabled for now
  const entry = STRATEGY_LIBRARY.find(s => s.n === n);
  const code = strategyHasCode(n);
  if (!entry || !code) return;
  if (typeof savedConfigs === 'undefined' || typeof persistSavedConfigs !== 'function') return;
  const name = (typeof uniqueName === 'function') ? uniqueName(entry.name) : entry.name;
  const cfg = {
    id: 'cfg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: 'custom',
    name: name,
    code: code,
    desc: entry.rules,
    params: {},
    color: (typeof nextConfigColor === 'function') ? nextConfigColor() : '#e879f9',
    hidden: false,
  };
  savedConfigs.push(cfg);
  window._editingConfigId = cfg.id;
  persistSavedConfigs();
  if (typeof renderSavedConfigPills === 'function') renderSavedConfigPills();
  if (typeof render === 'function') render();
  closeStrategyLibrary();                // ensure the new line is visible
  if (typeof flashSaveSuccess === 'function') flashSaveSuccess(cfg.id);
}

let _strategyLibraryBuilt = false;
function buildStrategyLibrary() {
  if (_strategyLibraryBuilt) return;
  const body = document.getElementById('strategy-library-body');
  if (!body) return;
  const ready = STRATEGY_LIBRARY.filter(s => strategyHasCode(s.n)).length;
  body.innerHTML = `
    <div class="sl-wip">⚠ Work in progress. These are my own reimplementations from public write-ups, backtested on synthetic data with a $10k lump sum and zero fees or taxes. Real-world results would be worse: taxes and slippage eat the high-churn ones alive, and every 3× line here still lived through an 80–97% drawdown somewhere. Rough comparisons only — the numbers will change as I fix bugs and add the missing strategies.</div>
    <div class="sl-intro">
      <span class="sl-legend"><i class="sl-leg-strat"></i>strategy <i class="sl-leg-spy"></i>SPY · log · 1995–2025</span>
      <span class="sl-intro-note">${ready}/25 backtested · hover a name for rules</span>
    </div>
    <div class="sl-cards">${buildStrategyCards()}</div>`;
  // Delegate "+ Add" clicks.
  body.onclick = (e) => {
    const btn = e.target.closest('[data-sl-add]');
    if (btn) addStrategyFromLibrary(+btn.getAttribute('data-sl-add'));
  };
  setupSparkTooltip(body);
  _strategyLibraryBuilt = true;
}

// Hover tooltip over any sparkline: shows the year + strategy $ + SPY $ at the
// hovered point, plus a vertical crosshair.
function setupSparkTooltip(body) {
  let tip = document.getElementById('sl-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'sl-tooltip';
    tip.className = 'sl-tooltip';
    tip.hidden = true;
    document.body.appendChild(tip);
  }
  const W = 300, H = 60, PAD = 3;
  let active = null;
  const hideMarks = (spark) => {
    if (!spark) return;
    spark.querySelectorAll('.sl-cross, .sl-dot').forEach(el => el.style.display = 'none');
  };
  body.addEventListener('mousemove', (e) => {
    const spark = e.target.closest('.sl-spark[data-sl-n]');
    if (!spark) { tip.hidden = true; hideMarks(active); active = null; return; }
    if (active && active !== spark) hideMarks(active);
    active = spark;
    const n = spark.getAttribute('data-sl-n');
    const curve = SL_CURVES.s && SL_CURVES.s[n], spy = SL_CURVES.spy, ds = SL_CURVES.d;
    if (!curve) { tip.hidden = true; return; }
    const rect = spark.getBoundingClientRect();
    const N = curve.length;
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const idx = Math.round(frac * (N - 1));
    // Recompute the per-card log scale to place the marker exactly on the lines.
    const both = curve.concat(spy).filter(v => v > 0);
    const lo = Math.log10(Math.min.apply(null, both)), hi = Math.log10(Math.max.apply(null, both));
    const span = (hi - lo) || 1;
    const xView = PAD + (idx / (N - 1)) * (W - 2 * PAD);
    const xPx = (xView / W) * rect.width;
    const yPxOf = (v) => v > 0 ? ((H - PAD - ((Math.log10(v) - lo) / span) * (H - 2 * PAD)) / H) * rect.height : rect.height;
    const cross = spark.querySelector('.sl-cross');
    const dS = spark.querySelector('.sl-dot-strat'), dY = spark.querySelector('.sl-dot-spy');
    if (cross) { cross.style.left = xPx + 'px'; cross.style.display = 'block'; }
    if (dS) { dS.style.left = xPx + 'px'; dS.style.top = yPxOf(curve[idx]) + 'px'; dS.style.display = 'block'; }
    if (dY) { dY.style.left = xPx + 'px'; dY.style.top = yPxOf(spy[idx]) + 'px'; dY.style.display = 'block'; }
    const yr = (ds[idx] || '').replace('-', '·');
    const sv = curve[idx], pv = spy[idx], mx = Math.max(sv, pv, 1);
    const ws = Math.max(2, (sv / mx) * 100).toFixed(1), wp = Math.max(2, (pv / mx) * 100).toFixed(1);
    tip.innerHTML = `<div class="sl-tt-yr">${yr}<span class="sl-tt-mult">${pv > 0 ? (sv / pv).toFixed(sv / pv >= 10 ? 0 : 1) + '×' : ''}</span></div>
      <div class="sl-tt-row"><span class="sl-tt-track"><i class="sl-tt-fill-strat" style="width:${ws}%"></i></span><span class="sl-tt-strat">${fmtMoney(sv)}</span></div>
      <div class="sl-tt-row"><span class="sl-tt-track"><i class="sl-tt-fill-spy" style="width:${wp}%"></i></span><span class="sl-tt-spy">SPY ${fmtMoney(pv)}</span></div>`;
    tip.hidden = false;
    const tw = tip.offsetWidth;
    let left = e.clientX + 12;
    if (left + tw > window.innerWidth - 8) left = e.clientX - tw - 12;
    tip.style.left = left + 'px';
    tip.style.top = (e.clientY - 34) + 'px';
  });
  body.addEventListener('mouseleave', () => { tip.hidden = true; hideMarks(active); active = null; });
}

function openStrategyLibrary() {
  const modal = document.getElementById('strategy-library-modal');
  if (!modal) return;
  buildStrategyLibrary();
  modal.removeAttribute('hidden');
  document.body.classList.add('modal-open');
}
function closeStrategyLibrary() {
  const modal = document.getElementById('strategy-library-modal');
  if (!modal) return;
  modal.setAttribute('hidden', '');
  document.body.classList.remove('modal-open');
}
function toggleStrategyLibrary() {
  const modal = document.getElementById('strategy-library-modal');
  if (!modal) return;
  if (modal.hasAttribute('hidden')) openStrategyLibrary(); else closeStrategyLibrary();
}

// Close on Escape (matches the analytics modal's affordances).
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('strategy-library-modal');
    if (modal && !modal.hasAttribute('hidden')) toggleStrategyLibrary();
  }
});

// Deep-links: #library opens the catalog; #add-<n> drops strategy n straight
// onto the chart (shareable "try this strategy" link).
if (typeof window !== 'undefined' && window.location) {
  const hash = window.location.hash;
  if (hash === '#library') {
    document.addEventListener('DOMContentLoaded', () => toggleStrategyLibrary());
  } else if (/^#add-\d+$/.test(hash)) {
    const n = +hash.slice(5);
    // Wait for the app's async price data to finish loading before adding, so
    // the custom worker computes against a populated dataset.
    const tryAdd = () => {
      if (typeof daily !== 'undefined' && daily && daily.length) addStrategyFromLibrary(n);
      else setTimeout(tryAdd, 200);
    };
    document.addEventListener('DOMContentLoaded', () => setTimeout(tryAdd, 200));
  }
}
