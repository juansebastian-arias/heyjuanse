import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Heap } from "./heap";

describe("heap", () => {
  it("hands back whatever was put in, smallest first", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -1000, max: 1000 })), (values) => {
        const heap = new Heap<number>((a, b) => a < b);
        for (const value of values) heap.push(value);
        expect(heap.size).toBe(values.length);
        const out: number[] = [];
        for (let next = heap.pop(); next !== undefined; next = heap.pop()) out.push(next);
        expect(out).toEqual([...values].sort((a, b) => a - b));
        expect(heap.size).toBe(0);
      }),
    );
  });

  it("stays ordered when pushes and pops are mixed", () => {
    fc.assert(
      fc.property(fc.array(fc.option(fc.integer({ min: 0, max: 50 }), { nil: null })), (steps) => {
        const heap = new Heap<number>((a, b) => a < b);
        const mirror: number[] = [];
        for (const step of steps) {
          if (step === null) {
            mirror.sort((a, b) => a - b);
            expect(heap.pop()).toBe(mirror.shift());
          } else {
            heap.push(step);
            mirror.push(step);
          }
          expect(heap.peek()).toBe(mirror.length > 0 ? Math.min(...mirror) : undefined);
        }
      }),
    );
  });

  it("is empty when new", () => {
    const heap = new Heap<number>((a, b) => a < b);
    expect(heap.peek()).toBeUndefined();
    expect(heap.pop()).toBeUndefined();
  });
});
