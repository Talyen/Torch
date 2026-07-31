import type Phaser from 'phaser';

const TARGET_FRAME_MS = 1000 / 60;
const WINDOW_MS = 2_000;
const PANEL_UPDATE_MS = 500;
const CONSOLE_REPORT_MS = 2_000;
const STUTTER_THRESHOLD_MS = 25;

export interface FramePerformanceSnapshot {
  fps: number;
  onePercentLowFps: number;
  averageFrameMs: number;
  p50FrameMs: number;
  p99FrameMs: number;
  maxFrameMs: number;
  frameCount: number;
  frameBudgetMisses: number;
  stutters: number;
  longTasks: number;
  phaseAverages: Record<string, number>;
  phaserLoopDeltaMs: number;
  latestStutter?: {
    frameMs: number;
    cause: string;
    phases: Record<string, number>;
    longTaskMs?: number;
  };
}

interface FrameRecord {
  timestamp: number;
  deltaMs: number;
  phaserLoopDeltaMs: number;
  phases: Record<string, number>;
}

interface LongTaskRecord {
  startTime: number;
  duration: number;
  attribution?: string;
}

interface TorchPerformanceWindow extends Window {
  __torchPerf?: FramePerformanceSnapshot;
}

export function percentile(values: number[], rank: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * rank));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];

  const weight = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

class DevFrameMonitor {
  private game?: Phaser.Game;
  private frameRequest?: number;
  private observer?: PerformanceObserver;
  private panel?: HTMLPreElement;
  private lastTimestamp?: number;
  private lastPanelUpdate = 0;
  private lastConsoleReport = 0;
  private lastLoggedStutter = -Infinity;
  private frames: FrameRecord[] = [];
  private longTasks: LongTaskRecord[] = [];
  private pendingPhases: Record<string, number> = {};
  private running = false;

  public start(game: Phaser.Game): void {
    if (!import.meta.env.DEV || this.running || typeof window === 'undefined') return;

    this.game = game;
    this.running = true;
    this.lastTimestamp = undefined;
    this.ensurePanel();
    this.observeLongTasks();
    this.frameRequest = window.requestAnimationFrame((timestamp) => this.handleFrame(timestamp));
  }

  public stop(): void {
    if (!this.running) return;

    if (this.frameRequest !== undefined) window.cancelAnimationFrame(this.frameRequest);
    this.observer?.disconnect();
    this.panel?.remove();
    delete (window as TorchPerformanceWindow).__torchPerf;
    this.frameRequest = undefined;
    this.observer = undefined;
    this.panel = undefined;
    this.running = false;
  }

  public measure<T>(phase: string, callback: () => T): T {
    if (!this.running) return callback();

    const start = performance.now();
    try {
      return callback();
    } finally {
      this.pendingPhases[phase] = (this.pendingPhases[phase] ?? 0) + (performance.now() - start);
    }
  }

  public snapshot(): FramePerformanceSnapshot {
    const frameTimes = this.frames.map((frame) => frame.deltaMs);
    const averageFrameMs = average(frameTimes);
    const p50FrameMs = percentile(frameTimes, 0.5);
    const p99FrameMs = percentile(frameTimes, 0.99);
    const phaseAverages: Record<string, number> = {};

    for (const phase of Object.keys(this.pendingPhases)) {
      phaseAverages[phase] = this.pendingPhases[phase] / Math.max(1, this.frames.length);
    }
    for (const frame of this.frames) {
      for (const [phase, duration] of Object.entries(frame.phases)) {
        phaseAverages[phase] = (phaseAverages[phase] ?? 0) + duration / Math.max(1, this.frames.length);
      }
    }

    const overlappingLongTasks = this.longTasks.filter((task) => {
      const windowStart = this.frames[0]?.timestamp ?? 0;
      const windowEnd = this.frames.at(-1)?.timestamp ?? 0;
      return task.startTime <= windowEnd && task.startTime + task.duration >= windowStart;
    });
    const latestStutter = this.latestStutter();

    return {
      fps: averageFrameMs > 0 ? 1000 / averageFrameMs : 0,
      onePercentLowFps: p99FrameMs > 0 ? Math.min(60, 1000 / p99FrameMs) : 0,
      averageFrameMs,
      p50FrameMs,
      p99FrameMs,
      maxFrameMs: frameTimes.length > 0 ? Math.max(...frameTimes) : 0,
      frameCount: this.frames.length,
      frameBudgetMisses: this.frames.filter((frame) => frame.deltaMs > TARGET_FRAME_MS).length,
      stutters: this.frames.filter((frame) => frame.deltaMs >= STUTTER_THRESHOLD_MS).length,
      longTasks: overlappingLongTasks.length,
      phaseAverages,
      phaserLoopDeltaMs: this.frames.at(-1)?.phaserLoopDeltaMs ?? 0,
      latestStutter,
    };
  }

  private handleFrame(timestamp: number): void {
    if (!this.running) return;

    const previousTimestamp = this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.frameRequest = window.requestAnimationFrame((nextTimestamp) => this.handleFrame(nextTimestamp));

    if (previousTimestamp === undefined) return;

    const deltaMs = timestamp - previousTimestamp;
    if (deltaMs <= 0 || deltaMs > 1_000) {
      this.pendingPhases = {};
      return;
    }

    const frame: FrameRecord = {
      timestamp,
      deltaMs,
      phaserLoopDeltaMs: this.game?.loop.delta ?? 0,
      phases: this.pendingPhases,
    };
    this.pendingPhases = {};
    this.frames.push(frame);
    this.prune(timestamp);

    if (timestamp - this.lastPanelUpdate >= PANEL_UPDATE_MS) {
      this.lastPanelUpdate = timestamp;
      this.updatePanel(this.snapshot());
    }

    if (deltaMs >= STUTTER_THRESHOLD_MS && timestamp - this.lastLoggedStutter >= 1_000) {
      this.lastLoggedStutter = timestamp;
      console.warn('[Torch perf] frame hitch', {
        frameMs: round(deltaMs),
        fps: round(1000 / deltaMs),
        cause: this.classifyFrame(frame),
        phases: frame.phases,
        longTaskMs: this.overlappingLongTask(frame)?.duration,
        phaserLoopDeltaMs: round(frame.phaserLoopDeltaMs),
      });
    }

    if (timestamp - this.lastConsoleReport >= CONSOLE_REPORT_MS) {
      this.lastConsoleReport = timestamp;
      console.debug('[Torch perf] window', this.snapshot());
    }
  }

  private prune(timestamp: number): void {
    const windowStart = timestamp - WINDOW_MS;
    this.frames = this.frames.filter((frame) => frame.timestamp >= windowStart);
    this.longTasks = this.longTasks.filter((task) => task.startTime + task.duration >= windowStart);
  }

  private latestStutter(): FramePerformanceSnapshot['latestStutter'] {
    const frame = [...this.frames].reverse().find((candidate) => candidate.deltaMs >= STUTTER_THRESHOLD_MS);
    if (!frame) return undefined;

    return {
      frameMs: frame.deltaMs,
      cause: this.classifyFrame(frame),
      phases: frame.phases,
      longTaskMs: this.overlappingLongTask(frame)?.duration,
    };
  }

  private classifyFrame(frame: FrameRecord): string {
    const longestPhase = Object.entries(frame.phases).sort((a, b) => b[1] - a[1])[0];
    if (longestPhase && longestPhase[1] >= Math.min(5, frame.deltaMs * 0.5)) {
      return `${longestPhase[0]} took ${round(longestPhase[1])}ms`;
    }

    const longTask = this.overlappingLongTask(frame);
    if (longTask) {
      return longTask.attribution
        ? `browser long task (${longTask.attribution})`
        : 'browser long task';
    }

    if (frame.phaserLoopDeltaMs >= STUTTER_THRESHOLD_MS) {
      return 'Phaser loop or renderer';
    }

    return 'browser, OS, GPU, or uninstrumented work';
  }

  private overlappingLongTask(frame: FrameRecord): LongTaskRecord | undefined {
    const frameStart = frame.timestamp - frame.deltaMs;
    return this.longTasks
      .filter((task) => task.startTime <= frame.timestamp && task.startTime + task.duration >= frameStart)
      .sort((a, b) => b.duration - a.duration)[0];
  }

  private observeLongTasks(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) return;

    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const longTaskEntry = entry as PerformanceEntry & {
          attribution?: Array<{ name?: string }>;
        };
        this.longTasks.push({
          startTime: entry.startTime,
          duration: entry.duration,
          attribution: longTaskEntry.attribution?.[0]?.name,
        });
      }
    });
    this.observer.observe({ type: 'longtask', buffered: true });
  }

  private ensurePanel(): void {
    this.panel = document.createElement('pre');
    this.panel.id = 'torch-dev-performance';
    this.panel.dataset.testid = 'dev-performance';
    this.panel.setAttribute('aria-hidden', 'true');
    this.panel.style.cssText = [
      'position:fixed',
      'top:max(10px,env(safe-area-inset-top) + 10px)',
      'left:max(10px,env(safe-area-inset-left) + 10px)',
      'z-index:1000',
      'margin:0',
      'padding:3px 6px',
      'border:1px solid rgba(242,196,99,.24)',
      'border-radius:5px',
      'background:rgba(8,11,16,.68)',
      'color:#f2c463',
      'font:10px/1 Inter,ui-sans-serif,system-ui,sans-serif',
      'pointer-events:none',
      'white-space:pre',
      'opacity:.9',
    ].join(';');
    document.body.appendChild(this.panel);
  }

  private updatePanel(snapshot: FramePerformanceSnapshot): void {
    if (!this.panel) return;

    this.panel.textContent = `${snapshot.fps.toFixed(0)} FPS`;

    (window as TorchPerformanceWindow).__torchPerf = snapshot;
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export const devFrameMonitor = new DevFrameMonitor();
