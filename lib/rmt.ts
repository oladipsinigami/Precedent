// Random Matrix Theory helpers for the Market Structure pillar.
//
// Pipeline: aligned log-returns -> Pearson correlation matrix ->
// Marcenko-Pastur edge -> eigenvalue split (noise bulk vs signal) ->
// market-mode strength -> community pass on the cleaned matrix.
//
// Pure math, zero I/O. Eigenvalues come from a small self-contained Jacobi
// solver so this module adds no new dependencies.

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
  }
  return out;
}

export function correlationMatrix(series: number[][]): number[][] {
  const n = series.length;
  const means = series.map((s) => s.reduce((a, b) => a + b, 0) / Math.max(1, s.length));
  const stds = series.map((s, i) => {
    const m = means[i];
    const v = s.reduce((a, b) => a + (b - m) * (b - m), 0) / Math.max(1, s.length);
    return Math.sqrt(v);
  });
  const t = Math.min(...series.map((s) => s.length));
  const corr: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    corr[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      let cov = 0;
      for (let k = 0; k < t; k++) cov += (series[i][k] - means[i]) * (series[j][k] - means[j]);
      cov /= Math.max(1, t);
      const denom = stds[i] * stds[j];
      const c = denom > 0 ? cov / denom : 0;
      corr[i][j] = c;
      corr[j][i] = c;
    }
  }
  return corr;
}

// Marcenko-Pastur upper/lower edges for a correlation matrix with
// N assets and T observations (sigma^2 = 1 for correlations).
export function marcenkoPasturEdges(nAssets: number, nObs: number): { plus: number; minus: number } {
  const q = nAssets / Math.max(1, nObs);
  const s = Math.sqrt(q);
  return { plus: (1 + s) * (1 + s), minus: Math.max(0, (1 - s) * (1 - s)) };
}

// Cyclic Jacobi eigenvalue algorithm for real symmetric matrices.
// Returns eigenvalues (descending) for the filtering step.
export function jacobiEigenvalues(a: number[][], maxSweeps = 60): number[] {
  const n = a.length;
  const m = a.map((row) => [...row]);
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) off += m[p][q] * m[p][q];
    }
    if (off < 1e-14) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = m[p][q];
        if (Math.abs(apq) < 1e-15) continue;
        const app = m[p][p];
        const aqq = m[q][q];
        const theta = (aqq - app) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const mkp = m[k][p];
          const mkq = m[k][q];
          m[k][p] = c * mkp - s * mkq;
          m[k][q] = s * mkp + c * mkq;
        }
        for (let k = 0; k < n; k++) {
          const mpk = m[p][k];
          const mqk = m[q][k];
          m[p][k] = c * mpk - s * mqk;
          m[q][k] = s * mpk + c * mqk;
        }
      }
    }
  }
  const values = m.map((row, i) => row[i]);
  values.sort((x, y) => y - x);
  return values;
}

export type SpectrumSplit = {
  values: number[];
  mpPlus: number;
  signalCount: number;
  marketModeStrength: number;
  infoBeyondNoisePct: number;
};

// Split the spectrum into the random bulk and the informative part.
// Convention: the largest eigenvalue is the market (systemic) mode;
// every eigenvalue above the MP upper edge carries signal.
export function splitSpectrum(corr: number[][], nObs: number): SpectrumSplit {
  const n = corr.length;
  const values = jacobiEigenvalues(corr);
  const { plus } = marcenkoPasturEdges(n, nObs);
  const signalCount = values.filter((v) => v > plus).length;
  const total = values.reduce((a, b) => a + b, 0);
  const largest = values[0] ?? 0;
  const marketModeStrength = total > 0 ? largest / total : 0;
  return {
    values,
    mpPlus: plus,
    signalCount,
    marketModeStrength,
    infoBeyondNoisePct: n > 0 ? (signalCount / n) * 100 : 0,
  };
}

// Standardise a return series to zero mean and unit variance. A series with no
// dispersion (or a single observation) becomes all zeros rather than NaN.
function standardise(series: number[]): number[] {
  const n = series.length;
  if (n < 2) return series.map(() => 0);
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const variance = series.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
  const sd = Math.sqrt(variance);
  return sd > 0 ? series.map((v) => (v - mean) / sd) : series.map(() => 0);
}

// Remove the dominant common factor(s) before any similarity work.
//
// Why this matters: in a 494-name equity universe the largest eigenvalue carries
// ~22% of total variance, so every pairwise correlation is dominated by market
// beta rather than structure. A threshold graph on those raw correlations
// percolates into one giant component (measured: 490 of 494 names in a single
// "community"), which makes the peer cohort meaningless.
//
// We estimate each factor as the equal-weight cross-sectional mean of
// standardised returns, regress it out of every series, and re-standardise.
// Repeating the step deflates successive factors (market, then sector, ...).
export function removeMarketMode(returns: number[][], factors = 1): number[][] {
  const t = returns[0]?.length ?? 0;
  if (t < 3 || returns.length < 3) return returns;
  let current = returns.map(standardise);
  for (let f = 0; f < factors; f++) {
    const factor = new Array<number>(t).fill(0);
    for (const series of current) for (let k = 0; k < t; k++) factor[k] += series[k];
    for (let k = 0; k < t; k++) factor[k] /= current.length;
    const mean = factor.reduce((a, b) => a + b, 0) / t;
    const centered = factor.map((v) => v - mean);
    const varFactor = centered.reduce((a, v) => a + v * v, 0) / t;
    current = current.map((series) => {
      const meanS = series.reduce((a, b) => a + b, 0) / t;
      const s = series.map((v) => v - meanS);
      const cov = s.reduce((a, v, k) => a + v * centered[k], 0) / t;
      const beta = varFactor > 0 ? cov / varFactor : 0;
      return standardise(s.map((v, k) => v - beta * centered[k]));
    });
  }
  return current;
}

// Agglomerative average-linkage clustering on d = max(0, 1 - correlation).
//
// Why not single linkage: single linkage chains assets through intermediate
// links, so a dense block of near-duplicate index ETFs (SPY/VOO/IVV,
// QQQ/QQQM/TQQQ, GLD/IAU) connects the entire universe into one component at
// any threshold, and even a symmetric k-nearest-neighbour graph stays connected
// at K=3. Average linkage merges two clusters only when their *average* pairwise
// correlation clears the cut, which cannot chain: measured on the same data it
// yields ~111 clusters with the largest holding 17% of the universe, and banks,
// oil, gold/miners and semis land in separate, interpretable groups.
export function assignCommunitiesByAverageLinkage(
  similarity: number[][],
  minAvgCorr = 0.3,
): number[] {
  const n = similarity.length;
  if (n === 0) return [];
  const cluster = new Int32Array(n).map((_, i) => i);
  if (n === 1) return [0];

  const dist = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.max(0, 1 - similarity[i][j]);
      dist[i * n + j] = d;
      dist[j * n + i] = d;
    }
  }
  const size = new Float64Array(n).fill(1);
  const alive = new Uint8Array(n).fill(1);
  const maxDist = 1 - minAvgCorr;
  let active = n;

  while (active > 1) {
    let best = Infinity;
    let bi = -1;
    let bj = -1;
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!alive[j]) continue;
        const d = dist[i * n + j];
        if (d < best) {
          best = d;
          bi = i;
          bj = j;
        }
      }
    }
    if (bi === -1 || best > maxDist) break;
    const si = size[bi];
    const sj = size[bj];
    for (let k = 0; k < n; k++) {
      if (!alive[k] || k === bi || k === bj) continue;
      const updated = (si * dist[k * n + bi] + sj * dist[k * n + bj]) / (si + sj);
      dist[k * n + bi] = updated;
      dist[bi * n + k] = updated;
    }
    for (let k = 0; k < n; k++) if (cluster[k] === bj) cluster[k] = bi;
    size[bi] = si + sj;
    alive[bj] = 0;
    active -= 1;
  }

  const remap = new Map<number, number>();
  let next = 0;
  const labels = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const root = cluster[i];
    if (!remap.has(root)) remap.set(root, next++);
    labels[i] = remap.get(root) as number;
  }
  return labels;
}
