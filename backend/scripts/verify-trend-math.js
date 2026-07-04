/**
 * verify-trend-math.js
 * ====================
 *
 * Standalone verification of the pure regression math behind predictive
 * alerting (`computeTrend` in utils/trendChecker.js). No database required.
 *
 *   Run:  node backend/scripts/verify-trend-math.js
 *
 * Exits 0 if every case passes, non-zero otherwise. Follows the project's
 * existing standalone-script style (like seed.js) — no test framework.
 */

const assert = require('assert');
const { computeTrend } = require('../utils/trendChecker');

let failures = 0;

function runCase(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL  ${name}\n      ${err.message}`);
  }
}

// Helper: build samples spaced `stepSeconds` apart, values from a generator.
function makeSamples(count, stepSeconds, valueAt) {
  const start = new Date('2026-01-01T00:00:00Z').getTime();
  const samples = [];
  for (let i = 0; i < count; i += 1) {
    samples.push({ timestamp: new Date(start + i * stepSeconds * 1000), value: valueAt(i) });
  }
  return samples;
}

const CRIT = 90;
const WINDOW_SECONDS = 6 * 3600; // PREDICTION_WINDOW_HOURS default = 6

// ---------------------------------------------------------------------------
// Case 1 — Clean linear rise: disk% climbing exactly 1%/minute.
// 10 samples one minute apart: 60, 61, ... 69. Latest = 69, threshold = 90.
// Expected slope = 1/60 %/s; ETA = (90-69)/(1/60) = 1260s (21 min).
// ---------------------------------------------------------------------------
runCase('Clean linear rise -> slope & ETA match hand calc (±5%)', () => {
  const samples = makeSamples(10, 60, (i) => 60 + i * 1);
  const { slope, currentValue, etaSeconds } = computeTrend(samples, CRIT);

  const expectedSlope = 1 / 60; // per second
  const expectedEta = (CRIT - 69) / expectedSlope; // 1260s

  assert.strictEqual(currentValue, 69, `currentValue expected 69, got ${currentValue}`);
  assert.ok(
    Math.abs(slope - expectedSlope) / expectedSlope <= 0.05,
    `slope ${slope} not within 5% of ${expectedSlope}`,
  );
  assert.ok(
    Math.abs(etaSeconds - expectedEta) / expectedEta <= 0.05,
    `etaSeconds ${etaSeconds} not within 5% of ${expectedEta}`,
  );
  assert.ok(etaSeconds <= WINDOW_SECONDS, 'ETA should fall inside the prediction window');
});

// ---------------------------------------------------------------------------
// Case 2 — Flat/noisy data: oscillates around a constant mean (deterministic
// small noise). Slope should be ~0 and the ETA must NOT fall inside the window.
// ---------------------------------------------------------------------------
runCase('Flat/noisy data -> slope ~0, no breach inside window', () => {
  // 12 samples around a mean of 50 with a small +/-1 alternating wobble.
  const samples = makeSamples(12, 60, (i) => 50 + (i % 2 === 0 ? -1 : 1));
  const { slope, etaSeconds } = computeTrend(samples, CRIT);

  assert.ok(Math.abs(slope) < 0.001, `slope ${slope} not ~0`);
  assert.ok(
    etaSeconds > WINDOW_SECONDS,
    `flat trend should not project a breach inside the window (eta=${etaSeconds})`,
  );
});

// ---------------------------------------------------------------------------
// Case 3 — Falling trend: values decreasing -> negative slope -> no breach
// predicted (etaSeconds === Infinity).
// ---------------------------------------------------------------------------
runCase('Falling trend -> negative slope, ETA = Infinity (no breach)', () => {
  const samples = makeSamples(10, 60, (i) => 80 - i * 2);
  const { slope, etaSeconds } = computeTrend(samples, CRIT);

  assert.ok(slope < 0, `slope ${slope} should be negative`);
  assert.strictEqual(etaSeconds, Infinity, `etaSeconds should be Infinity, got ${etaSeconds}`);
});

// ---------------------------------------------------------------------------
// Case 3b — Already above threshold while rising: no future breach to predict
// (currentValue >= threshold) -> Infinity. (The reactive threshold path owns
// this case; the predictive math must not double-count it.)
// ---------------------------------------------------------------------------
runCase('Already at/above threshold -> ETA = Infinity', () => {
  const samples = makeSamples(8, 60, (i) => 88 + i * 1); // ends at 95 (> CRIT 90)
  const { etaSeconds } = computeTrend(samples, CRIT);
  assert.strictEqual(etaSeconds, Infinity, `etaSeconds should be Infinity, got ${etaSeconds}`);
});

// ---------------------------------------------------------------------------
// Case 4 — Too few samples: fewer than 2 points cannot fit a line, so
// computeTrend returns null. (The stricter TREND_MIN_SAMPLES=6 guard lives in
// checkTrendsOnce and is exercised in verify-trend-checker.js.)
// ---------------------------------------------------------------------------
runCase('Too few samples -> computeTrend returns null', () => {
  assert.strictEqual(computeTrend([], CRIT), null, 'empty -> null');
  assert.strictEqual(
    computeTrend([{ timestamp: new Date(), value: 50 }], CRIT),
    null,
    'single sample -> null',
  );
});

// ---------------------------------------------------------------------------
console.log('');
if (failures > 0) {
  console.error(`${failures} case(s) FAILED`);
  process.exit(1);
}
console.log('All trend-math cases passed.');
process.exit(0);
