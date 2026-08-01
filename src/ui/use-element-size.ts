import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { ResponsiveSize } from './responsive-layout';

const ZERO_SIZE: ResponsiveSize = { width: 0, height: 0 };

/**
 * Measure the element that owns a responsive surface.  A surface measurement
 * is more reliable than window.innerWidth for dialogs, split panes, and
 * browser-embedded game shells. Updates are coalesced to one animation frame
 * so ResizeObserver, visualViewport, and window resize notifications cannot
 * trigger a resize cascade.
 */
export function useElementSize<T extends Element>(ref: RefObject<T | null>): ResponsiveSize {
  const [size, setSize] = useState<ResponsiveSize>(ZERO_SIZE);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    let frame: number | undefined;
    const measure = (): void => {
      frame = undefined;
      const next = {
        width: Math.max(0, element.getBoundingClientRect().width),
        height: Math.max(0, element.getBoundingClientRect().height),
      };
      setSize((previous) => (previous.width === next.width && previous.height === next.height ? previous : next));
    };
    const schedule = (): void => {
      if (frame !== undefined) return;
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        measure();
        return;
      }
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    observer?.observe(element);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [ref]);

  return size;
}
