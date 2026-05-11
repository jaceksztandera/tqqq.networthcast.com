# Long-history TQQQ, QQQ, SPY, SOXX, SOXL, and QQQ5 price data (+ short-rate reference data)

This folder contains daily closing-price series for **TQQQ, QQQ, SPY, SOXX, SOXL, and QQQ5** stretching back **decades before any of these ETFs actually existed**, along with the **historical short-term interest rate series** the synthesis methodology depends on. They power the [Strategies Simulator](https://9sig.networthcast.com), and they're published here so anyone can grab them and run their own backtests without reinventing the synthesis work.

## ETF launch dates

- **SPY** — January 1993
- **QQQ** — March 1999
- **SOXX** (1× semiconductors) — July 2001; underlying `^SOX` index began December 1993
- **TQQQ** (3× Nasdaq-100) — February 2010
- **SOXL** (3× semiconductors) — March 2010
- **QQQ5** (5× Nasdaq-100 ETP, Leverage Shares, LSE) — December 2021

Pre-launch history is reconstructed from longer-lived indexes (Nasdaq-100, S&P 500, PHLX Semiconductor), using the same daily formulas the ETFs themselves use (leverage, expense ratios, financing costs on the borrowed leg, swap-counterparty spreads), and stitched onto the real series at each ETF's launch day.

The result is a continuous "what it would have looked like" series for each fund going back as far as 1938 in some cases. It's not what really happened — those investments didn't exist yet — but it's what *the math says* their daily prices would have done given the underlying index **and the prevailing short-term interest rates of each era**.

## The files

| File | Real history starts | Synthesized portion |
| --- | --- | --- |
| **synthetic-qqq.tsv** | March 10, 1999 — when QQQ launched. From here on it's real, dividend-adjusted Yahoo Finance data. | Before 1999 the series is built from the Nasdaq-100 index (`^NDX`), minus QQQ's tiny expense ratio. No financing-cost adjustment (QQQ is not leveraged). |
| **synthetic-tqqq.tsv** | February 11, 2010 — when TQQQ launched. | Pre-2010 uses a leveraged-ETF formula that **includes the financing cost and a swap-counterparty spread**: `(1 + 3 × NDX_daily − 2 × (short_rate + 0.65%)/yr − 0.88%/yr expense)`. For 1999–2010 the underlying is the derived NDX-TR series (real Nasdaq movement plus actual dividends); for 1938–1999 it falls back to price-only `^NDX` because dividend data isn't available that far back. |
| **spy.tsv** | January 29, 1993 — when SPY launched. | 1988–1993 uses the real S&P 500 Total Return index. 1985–1988 falls back to the plain S&P 500 (`^GSPC`) because total-return data isn't available that far back. No financing-cost adjustment (SPY is not leveraged). |
| **synthetic-soxx.tsv** | July 13, 2001 — when SOXX launched. | Pre-2001 uses `^SOX` (PHLX Semiconductor index) minus SOXX's 0.35% expense ratio. The `^SOX` index itself only starts December 1993, so that's the floor for any semiconductor backtest. No financing-cost adjustment (SOXX is not leveraged). |
| **synthetic-soxl.tsv** | March 11, 2010 — when SOXL launched. | Pre-2010 uses `(1 + 3 × SOX_daily − 2 × (short_rate + 0.50%)/yr − 0.75%/yr expense)`. 2001–2010 uses derived SOX-TR via `^SOX × SOXX_adj/SOXX_raw`; 1993–2001 falls back to price-only `^SOX`. Same December-1993 floor as SOXX. |
| **synthetic-qqq5.tsv** | December 10, 2021 — when the Leverage Shares 5× ETP launched on LSE (yfinance ticker `QQQ5.L`, USD). | Pre-2021 uses `(1 + 5 × NDX_daily − 4 × (short_rate + 2.50%)/yr − 0.75%/yr expense)`. 1999–2021 uses derived NDX-TR; 1938–1999 uses price-only `^NDX`. The larger swap spread (2.50% vs 0.50–0.65% for 3× products) is empirically calibrated and matches the issuer's published PRIIPs cost disclosure — see audit notes below. |
| **fed-funds-effective.tsv** | Daily, July 1, 1954 → present. | None — pulled from FRED series `DFF`. Used by the synthesis to compute the financing cost on the leveraged leg from 1954 onward. |
| **t-bill-3mo.tsv** | Monthly, January 1934 → present. | None — pulled from FRED series `TB3MS`. Used as the pre-Fed-Funds-market (1934–1953) short-rate proxy. |
| **short-rates.tsv** | Daily, January 2, 1934 → present. | Derived: DFF where it exists, TB3MS forward-filled where DFF doesn't reach. This is the single file the synthesis script reads. |

A local `^ndx_d.csv` (sourced from Stooq) extends Nasdaq-100 history back to **January 1938**. The actual Nasdaq-100 index didn't exist before 1985, so values before then are themselves a back-reconstruction by the data provider — treat pre-1985 synthetic QQQ/TQQQ as "rough hypothetical" rather than gospel.

## The financing-cost correction

A leveraged ETF holding $1 of investor NAV produces $3 of NDX exposure by **borrowing** the extra $2 of synthetic exposure from a bank via total-return swap. The bank charges interest on that $2 every day. Meanwhile the fund's $1 of cash collateral earns roughly the same short-term rate. Net daily drag:

```
financing_drag_daily ≈ (L − 1) × short_rate_daily
                     = 2 × short_rate_daily   (for L=3, i.e. TQQQ)
```

**This drag is invisible in ProShares' published expense ratio** (0.88 %/year — the management fee) but is the dominant cost component in any non-zero interest-rate environment. Empirically verified against 2010-present TQQQ data:

- Regression of (naive synthesis − real TQQQ) on Fed Funds rate over 17 years → **slope 1.998** (theory predicts exactly 2.0), **R² 0.97**.
- In 2023 with Fed Funds at 5 %: real TQQQ underperformed a "no-financing-cost" synthesis by **11.3 percentage points** — matching `2 × 5 % = 10 %` predicted drag almost perfectly.
- In 2010–2015 with Fed Funds near 0 %: drag was only ~1.3 %/year (the irreducible operational residual).

Pre-2010 backtests done without this correction are **wildly optimistic** in any high-rate era. The 1970s and early 80s (Fed Funds 7–19 %) would have eaten **15–35 percentage points/year** of TQQQ's returns to financing alone.

## Swap-counterparty spread

The financing-cost model says the leveraged ETF pays **Fed Funds × (L−1)** on its borrowed leg. Reality is dirtier: the swap counterparty doesn't lend at Fed Funds — they lend at **Fed Funds + a spread** that covers their risk premium and desk margin. This spread is:

- Small for mature, deep-liquidity 3× products (TQQQ, SOXL)
- Large for exotic high-leverage products (QQQ5)

Each product's spread is **calibrated empirically** by regressing the naive (no-spread) synthesis against real ETF data and finding the spread that closes the residual gap to ≈ 0 over the full window:

| ETF | Leverage | TER (mgmt fee) | Calibrated spread | Window used | Full-window residual |
|---|---|---|---|---|---|
| **TQQQ** | 3× | 0.88 % | **0.65 %/yr** | 2010–present (15+yr) | ~1.3 pp/yr → ≈ 0 with spread |
| **SOXL** | 3× | 0.75 % | **0.50 %/yr** | 2010–present (16 yr) | +0.0 pp/yr |
| **QQQ5** | 5× | 0.75 % | **2.50 %/yr** | 2021-12-10 → present | +0.2 pp/yr |

The 5× product's spread is roughly 4× the 3× products' spread. That's consistent with how swap dealers price counterparty risk: 5× single-index daily-reset swaps have a smaller liquidity pool, larger gap risk on tail days, and command a much higher premium. Apply your own judgment to whether that calibrated 2.5 % held constant pre-2021 — swap markets didn't even exist pre-1980s, so deep-past values are necessarily forward-extrapolated.

## QQQ5 — independent multi-angle audit

QQQ5 is the newest series in this folder, has the least real history (4.4 years), and uses the largest synthesized portion. It was audited from seven angles before publication:

1. **Raw data integrity.** `QQQ5.L` from yfinance is USD-denominated (not GBp/pence — important; no FX conversion), and `auto_adjust=True` vs `auto_adjust=False` return identical closes (no splits, no dividends, no adjustments). yfinance correctly identifies it as "Leverage Shares 5x Long Nasdaq 100 ETP Securities" on the LSE.

2. **Cross-listing check.** The same product also lists as `5QQQ.L` (GBp, requires FX) and `QQQ5.DE` (EUR, Xetra, only since June 2022). We use `QQQ5.L` (USD) as the canonical primary listing — no FX layer needed.

3. **Multi-driver calibration convergence.** Best swap spread fits within 0.2 pp residual when calibrated against three different driver series:
   - `^NDX` (price-only): best spread = 1.8 %
   - **derived NDX-TR** (what model uses): best spread = 2.6 %
   - `QQQ_adj` (slightly under-counts NDX-TR by QQQ's 0.20 % expense): best spread = 2.8 %
   - All within ~1 pp of each other and ~0.2 pp residual on full window. We use 2.5 % — within 0.1 % of the optimal for our driver.

4. **Boundary continuity.** Day-1 of the real ETF (`2021-12-10` at $4.9980) matches the TSV exactly to 6 decimal places. The previous (last-synthesized) row is $4.7328 — a single-day +5.60 % move that corresponds to the actual NDX move that day. No discontinuity.

5. **Independent issuer validation.** Leverage Shares' own PRIIPs Key Information Document discloses **0.0273 %/day** ongoing cost = **9.96 %/yr** all-in. Our model decomposes that drag as 0.75 % TER + 4 × 2.5 % swap spread + ~1 % residual = **~11.75 %/yr**. Agreement within **~2 pp** of the issuer's legally-filed cost number — independent, off-system confirmation.

6. **Sub-period stability.** Year-by-year fits show high noise (per-year residuals ±15 pp, per-year best spreads 0 %–8 %). This is **path-dependency intrinsic to 5× daily rebalancing**, not a model defect: a single bad sequence of returns affects 5× compounded ~25× more than 1×. The full-window residual being +0.2 pp/yr means these errors **average out** over multi-year synthesis — which is precisely what's needed for long-history backtesting.

7. **Drag attribution sanity.** Real QQQ5 CAGR over its life: **−10.61 %/yr**. Naked 5×QQQ_adj returns with **zero costs**: **+16.94 %/yr** — already 57 pp/yr below the naive 5×CAGR of +74 %, purely from volatility drag. Cost/spread accounts for the remaining 27.55 pp/yr. The KID's stress scenario of **−73.27 %/day** is consistent with 5× of a roughly −14.7 % NDX day — mathematically consistent with what 5× would do in an extreme event.

**Bottom line:** synthesized QQQ5 matches the real ETF to within **~0.2 pp/yr** over its 4.4-year real-data history, and matches the issuer's PRIIPs cost disclosure within **~2 pp**. Pre-2021 values are necessarily a forward-extrapolation of modern swap-market conditions.

## How accurate is the synthesized portion?

After applying the financing-cost correction, the remaining known biases are:

1. **Missing dividends pre-1999.** For pre-1999 QQQ and TQQQ we have only `^NDX` (price-only) — Yahoo lists `^XNDX` (NDX Total Return) but serves no history for it; NASDAQ.com's API, NASDAQ Data Link, Stooq, Tiingo, EODHD, and Alpha Vantage all gate it. Pre-1999 synth QQQ understates by ~0.7 %/year; pre-1999 synth TQQQ understates by ~2 %/year (= 3 × dividend yield).

2. **Swap-counterparty spread** (modeled, calibrated above): TQQQ 0.65 %/yr, SOXL 0.50 %/yr, QQQ5 2.50 %/yr added to the financing rate for the borrowed leg. Closes most of what was previously the "~1.3 %/year unmodeled operational residual" for TQQQ.

3. **Residual operational drag** (still not modeled): NAV-vs-market price deviations and daily-rebalancing slippage. For 3× products this is ~0.3–0.5 %/yr. For 5× products (QQQ5) this is ~1 %/yr — measurable as the gap between our calibrated model and real QQQ5.

3. **1985–1987 SPY uses price-only S&P 500** because `^SP500TR`'s Yahoo history starts 1988-01-04. Measured TR premium over the overlap is +3.86 pp/year, so ~9 % cumulative understatement for that 2.3-year window.

Net direction of bias on TQQQ pre-2010 (vs what real TQQQ would have done if it existed):
- **Low-rate eras** (1938–45, mid-1950s): synthetic ≈ flat to slightly low (dividend gap > tiny operational drag).
- **Moderate-rate eras** (most history): synthetic ≈ slightly high by 1–3 pp/year.
- **High-rate eras** (1970s–80s): synthetic ≈ high by 2–3 pp/year operational, but rate effect is now corrected, so net is much smaller than the previous uncorrected synthesis.

For everything **from 2010 (TQQQ), 1999 (QQQ), and 1988 (SPY) onward** the price data is real and dividend-adjusted, so backtests over the last 15–25 years are unaffected by any synthesis biases.

## How to use the data

### Direct download

You can grab any of the files straight from GitHub at the URLs below. They're refreshed automatically every weekday with the latest closing prices and the latest Fed Funds rate, and there's no rate-limiting on these endpoints — it's safe to point an app or script directly at them and have your data stay current.

| File | URL |
| --- | --- |
| QQQ  | [https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/synthetic-qqq.tsv](https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/synthetic-qqq.tsv) |
| TQQQ | [https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/synthetic-tqqq.tsv](https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/synthetic-tqqq.tsv) |
| SPY  | [https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/spy.tsv](https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/spy.tsv) |
| SOXX | [https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/synthetic-soxx.tsv](https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/synthetic-soxx.tsv) |
| SOXL | [https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/synthetic-soxl.tsv](https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/synthetic-soxl.tsv) |
| QQQ5 | [https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/synthetic-qqq5.tsv](https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/synthetic-qqq5.tsv) |
| Fed Funds Effective Rate (daily, 1954+) | [https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/fed-funds-effective.tsv](https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/fed-funds-effective.tsv) |
| 3-month T-bill (monthly, 1934+) | [https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/t-bill-3mo.tsv](https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/t-bill-3mo.tsv) |
| Combined daily short rates (1934+) | [https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/short-rates.tsv](https://raw.githubusercontent.com/bumbeishvili/9sig.networthcast.com/refs/heads/main/data/short-rates.tsv) |

### File format

Every file is a plain tab-separated table:

```
Date	Close              ← price files (Close column)
1/2/2025 16:00:00	38.93
1/3/2025 16:00:00	40.79
...

Date	Rate               ← rate files (Rate column, value in % per year)
7/1/1954 16:00:00	1.1300
7/2/1954 16:00:00	1.2500
...
```

- One row per trading day (or per month for `t-bill-3mo.tsv`).
- The date column always says `16:00:00` — that's the New York 4 PM close.
- Price closes are in **US dollars**. Rate values are **annual percentages**.
- Dates use `M/D/YYYY` formatting.

Every spreadsheet, Python script, R notebook, etc. can read this with default settings (just tell it the delimiter is a tab).

## Daily auto-refresh

A scheduled GitHub Action runs every weekday at 15:30 UTC (about two hours after the US market opens), regenerates all six files from the latest Yahoo Finance and FRED data, and pushes them back to the repository. Whatever you fetch from the URLs above is always the latest version — no caching layer to wait on.

If you find a bug in the synthesis logic or have a suggestion, open an issue or send a PR against the script that generates the files (`update_data.py` at the repo root).

## A note on synthetic backtesting

These synthetic series are reconstructions, not history. They're as good as we can do given that QQQ and TQQQ simply weren't around through most market cycles people care about — but they should be read in that spirit. If a strategy backtest looks great in 1973 or 2000, that's a *what-if*, not a track record. Treat them accordingly.

The financing-cost correction (added 2026-05) closes the single biggest source of error in the previous synthesis, but a ~1.3 %/year operational residual remains unmodeled. **Absolute CAGRs from pre-2010 backtests are still approximate by ~1–2 percentage points**; relative comparisons between strategies (which all touch the same underlying) remain reliable.
