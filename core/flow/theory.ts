/**
 * Queues with known answers. For a few simple cases, how long a line gets can be worked out on
 * paper. The simulation is run on exactly those cases (see `validate.ts`) and has to land on the
 * same numbers before its answers for Larkspur, which no formula covers, are worth reading.
 *
 * Rates are per minute. `offered` is the arrival rate times the mean service time: how many
 * people's worth of work arrives.
 */

/** Erlang B: the share of arrivals turned away by `servers` people and no waiting room. */
export function erlangB(servers: number, offered: number): number {
  let blocked = 1;
  for (let k = 1; k <= servers; k++) blocked = (offered * blocked) / (k + offered * blocked);
  return blocked;
}

/** Erlang C: the chance an arrival has to wait, with `servers` people and unlimited patience. */
export function erlangC(servers: number, offered: number): number {
  if (offered >= servers) return 1;
  const blocked = erlangB(servers, offered);
  return blocked / (1 - (offered / servers) * (1 - blocked));
}

/** Mean minutes in line, exponential arrivals and service, `servers` people (M/M/c). */
export function mmcWait(arrivalRate: number, meanService: number, servers: number): number {
  const offered = arrivalRate * meanService;
  if (offered >= servers) return Number.POSITIVE_INFINITY;
  return (erlangC(servers, offered) * meanService) / (servers - offered);
}

/**
 * Mean minutes in line for one person and any service-time distribution with the given spread
 * (M/G/1, the Pollaczek-Khinchine formula). Spread is the standard deviation over the mean.
 */
export function mg1Wait(arrivalRate: number, meanService: number, spread: number): number {
  const use = arrivalRate * meanService;
  if (use >= 1) return Number.POSITIVE_INFINITY;
  const secondMoment = meanService * meanService * (1 + spread * spread);
  return (arrivalRate * secondMoment) / (2 * (1 - use));
}

export interface ImpatientQueue {
  /** Share of arrivals who leave before being served. */
  abandonShare: number;
  /** Mean minutes in line, over everyone who arrived. */
  meanWait: number;
  /** Mean number waiting. */
  meanLine: number;
}

/**
 * Customers who give up (M/M/c+M, known as Erlang-A): exponential arrivals, service and
 * patience. Solved from the balance between arrivals and departures in each state, summed until
 * the remaining states weigh nothing.
 */
export function erlangA(
  arrivalRate: number,
  meanService: number,
  servers: number,
  meanPatience: number,
): ImpatientQueue {
  const serviceRate = 1 / meanService;
  const leaveRate = 1 / meanPatience;
  // Unnormalized weight of "n in the system", relative to the state before it.
  let weight = 1;
  let total = 1;
  let line = 0;
  for (let n = 1; n < 100_000; n++) {
    const departures = Math.min(n, servers) * serviceRate + Math.max(0, n - servers) * leaveRate;
    weight *= arrivalRate / departures;
    total += weight;
    line += Math.max(0, n - servers) * weight;
    if (n > servers && weight < 1e-16 * total) break;
  }
  const meanLine = line / total;
  return {
    abandonShare: (leaveRate * meanLine) / arrivalRate,
    meanWait: meanLine / arrivalRate,
    meanLine,
  };
}
