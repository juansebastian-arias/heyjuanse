/**
 * A worker that runs simulations off the page's main thread, so the page stays responsive while
 * hundreds of quarters are being simulated.
 */
import { perform } from "./compute";
import type { Job, Reply } from "./protocol";

interface WorkerScope {
  onmessage: ((event: MessageEvent<Job>) => void) | null;
  postMessage(reply: Reply): void;
}

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = (event) => {
  scope.postMessage(perform(event.data));
};
