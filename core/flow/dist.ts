/**
 * Probability distributions, used through their quantile functions: a draw is a number between
 * 0 and 1 turned into a value. That number is fixed per customer and per question (see
 * `chance`), so the same customer is "a slow reply" or "has little patience" in every version of
 * the company being compared. Only how the company works differs between two runs.
 */

/** A length of time, in minutes. */
export type Dist =
  | { kind: "const"; value: number }
  | { kind: "exp"; mean: number }
  /** Right-skewed, never negative: most cases are quick and a few take very long. */
  | { kind: "lognormal"; mean: number; cv: number };

/**
 * Inverse of the standard normal distribution function (Acklam's rational approximation,
 * relative error below 1.2e-9 over the whole range).
 */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return Number.NEGATIVE_INFINITY;
    if (p === 1) return Number.POSITIVE_INFINITY;
    throw new RangeError(`normalQuantile(${p}): p must be between 0 and 1`);
  }
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ] as const;
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ] as const;
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ] as const;
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
  ] as const;
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

/** Standard normal distribution function (Abramowitz and Stegun 7.1.26, error below 7.5e-8). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Keeps a uniform strictly inside (0, 1), where every quantile function is finite. */
const inside = (u: number) => Math.min(1 - 1e-12, Math.max(1e-12, u));

/** The value a distribution takes at uniform `u`. Larger `u` always gives a larger value. */
export function quantile(dist: Dist, u: number): number {
  switch (dist.kind) {
    case "const":
      return dist.value;
    case "exp":
      return -dist.mean * Math.log(1 - inside(u));
    case "lognormal": {
      const variance = Math.log(1 + dist.cv * dist.cv);
      const mu = Math.log(dist.mean) - variance / 2;
      return Math.exp(mu + Math.sqrt(variance) * normalQuantile(inside(u)));
    }
  }
}

export function meanOf(dist: Dist): number {
  return dist.kind === "const" ? dist.value : dist.mean;
}

/** Coefficient of variation: the standard deviation as a share of the mean. */
export function cvOf(dist: Dist): number {
  return dist.kind === "const" ? 0 : dist.kind === "exp" ? 1 : dist.cv;
}

/**
 * A lognormal described the way people describe waiting: "half of them wait less than `median`",
 * with `sigma` saying how spread out the rest are (the standard deviation of the logarithm).
 */
export function lognormalFromMedian(median: number, sigma: number): Dist {
  return {
    kind: "lognormal",
    mean: median * Math.exp((sigma * sigma) / 2),
    cv: Math.sqrt(Math.exp(sigma * sigma) - 1),
  };
}

/** The median of a distribution. */
export function medianOf(dist: Dist): number {
  return quantile(dist, 0.5);
}

/** Share of a lognormal with the given median and sigma that falls below `value`. */
export function lognormalShareBelow(value: number, median: number, sigma: number): number {
  if (value <= 0) return 0;
  return normalCdf(Math.log(value / median) / sigma);
}
