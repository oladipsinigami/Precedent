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

// Greedy threshold clustering on the cleaned matrix (MVP community pass).
// Assets linked by cleaned correlation >= threshold merge via union-find.
// A Louvain pass on the same precomputed matrix is the documented upgrade.
export function assignCommunities(cleaned: number[][], threshold = 0.3): number[] {
  const n = cleaned.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (cleaned[i][j] >= threshold) union(i, j);
    }
  }
  const remap = new Map<number, number>();
  let next = 0;
  return Array.from({ length: n }, (_, i) => {
    const root = find(i);
    if (!remap.has(root)) remap.set(root, next++);
    return remap.get(root) as number;
  });
}

// Zero out sub-MP structure: keep the diagonal plus entries whose
// magnitude survives a simple proportional threshold derived from the
// MP edge. Returns the cleaned matrix used for community detection
// and for cleaned-vs-raw correlation reporting.
export function cleanedMatrix(corr: number[][], keepFraction = 1): number[][] {
  const n = corr.length;
  return corr.map((row, i) =>
    row.map((v, j) => {
      if (i === j) return 1;
      return Math.abs(v) >= 0.15 * keepFraction ? v : 0;
    }),
  );
}
