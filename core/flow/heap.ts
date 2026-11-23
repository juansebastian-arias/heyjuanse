/**
 * A binary min-heap: the simulation's agenda. The next event to happen is always on top, and
 * adding or removing one costs the logarithm of how many are waiting.
 */
export class Heap<T> {
  private readonly items: T[] = [];

  /** `before(a, b)` is true when `a` must come out first. */
  constructor(private readonly before: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(item: T): void {
    const items = this.items;
    let index = items.length;
    items.push(item);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      const above = items[parent] as T;
      if (!this.before(item, above)) break;
      items[index] = above;
      index = parent;
    }
    items[index] = item;
  }

  pop(): T | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length === 0 || last === undefined) return top;
    let index = 0;
    const half = items.length >> 1;
    while (index < half) {
      let child = 2 * index + 1;
      const right = child + 1;
      if (right < items.length && this.before(items[right] as T, items[child] as T)) child = right;
      const below = items[child] as T;
      if (!this.before(below, last)) break;
      items[index] = below;
      index = child;
    }
    items[index] = last;
    return top;
  }
}
