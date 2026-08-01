export type PresentationGateListener = (busy: boolean) => void;

let nextToken = 1;
const activeTokens = new Set<number>();
const listeners = new Set<PresentationGateListener>();

export const presentationGate = {
  get busy(): boolean {
    return activeTokens.size > 0;
  },

  acquire(): () => void {
    const token = nextToken++;
    activeTokens.add(token);
    notify();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      activeTokens.delete(token);
      notify();
    };
  },

  subscribe(listener: PresentationGateListener): () => void {
    listeners.add(listener);
    listener(activeTokens.size > 0);
    return () => listeners.delete(listener);
  },
};

function notify(): void {
  const busy = activeTokens.size > 0;
  listeners.forEach((listener) => listener(busy));
}
