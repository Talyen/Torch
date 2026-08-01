import Phaser from 'phaser';
import { entityFootprint, footprintPositions, positionKey, samePosition, tileAt } from '../sim';
import type { GameState, Position, SimEvent } from '../sim';
import { heroAssets } from '../content/hero-assets';
import { enemyAssets } from '../content/enemy-assets';
import { devFrameMonitor } from '../dev/frame-monitor';
import { tileSizeForViewport, viewRadiusForViewport } from './layout';
import { gameSession } from './session';
import { cssHexColorToNumber, readCssColorToken } from './presentation-colors';
import {
  captureVisibilitySnapshot,
  entityVisibilityAlpha,
  fogAlphaForVisibility,
  gridAlphaForVisibility,
  interpolatedVisibilityLevel,
  visibilityChanged,
} from './visibility';
import type { VisibilitySnapshot } from './visibility';
import {
  REDUCE_MOTION_EVENT,
  SHOW_GRID_EVENT,
  readReduceMotionPreference,
  readShowGridPreference,
} from './presentation-settings';
import {
  directionForKey,
  directionForInputAction,
  keyMatchesBinding,
  KEY_BINDINGS_EVENT,
  OPEN_JOURNAL_EVENT,
  OPEN_MAP_EVENT,
  readKeyBindings,
} from './input-bindings';
import { ControllerInputTracker, readConnectedGamepad } from './controller-input';

const COLORS = {
  grass: 0x789f55,
  mountain: 0x7c8992,
  enemy: 0xe86a67,
  tree: 0x79bd70,
  ore: 0xb8c9d4,
};

interface EntityMotion {
  from: Position;
  to: Position;
}

type EntityToken = Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;

export class TorchScene extends Phaser.Scene {
  private board!: Phaser.GameObjects.Graphics;
  private fogLayer!: Phaser.GameObjects.Container;
  private fogTiles: Phaser.GameObjects.Rectangle[] = [];
  private gridLayer!: Phaser.GameObjects.Container;
  private gridTiles: Phaser.GameObjects.Rectangle[] = [];
  private heroImage!: Phaser.GameObjects.Image;
  private entityTokens = new Map<string, EntityToken>();
  private visualEntityPositions = new Map<string, Position>();
  private entityMotions = new Map<string, EntityMotion>();
  private unsubscribe?: () => void;
  private resizeObserver?: ResizeObserver;
  private resizeFrame?: number;
  private dprMediaQuery?: MediaQueryList;
  private viewportSize = { width: 960, height: 640 };
  private heroTween?: Phaser.Tweens.Tween;
  private heroAnimating = false;
  private lastSimulationHeroPosition?: Position;
  private cameraPosition?: Position;
  private visualHeroPosition?: Position;
  private boardBaseCamera?: Position;
  private movementProgress = { value: 0 };
  private visibilityProgress = { value: 1 };
  private lastVisibilitySnapshot?: VisibilitySnapshot;
  private tileCache = new Map<string, ReturnType<typeof tileAt>>();
  private tileCacheSeed?: number;
  private entityTokenTileSize?: number;
  private showGrid = false;
  private reduceMotion = false;
  private keyBindings = readKeyBindings();
  private controllerInput = new ControllerInputTracker();
  private terrainDrawKey?: string;
  private fogDrawKey?: string;
  private presentationColors = {
    grid: 0x3a3328,
    fog: 0x15130f,
  };

  private handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    this.handlePointer(pointer.x, pointer.y);
  };

  private handleDevicePixelRatioChange = (): void => {
    this.bindDevicePixelRatioListener();
    this.scheduleViewportSync();
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (gameSession.inputMode !== 'world' || this.heroAnimating) return;

    const direction = directionForKey(this.keyBindings, event.key);
    if (direction) {
      event.preventDefault();
      gameSession.move(direction);
    } else if (keyMatchesBinding(this.keyBindings, 'wait', event.key)) {
      event.preventDefault();
      gameSession.wait();
    } else if (keyMatchesBinding(this.keyBindings, 'gather', event.key)) {
      event.preventDefault();
      gameSession.gather();
    } else if (keyMatchesBinding(this.keyBindings, 'map', event.key)) {
      event.preventDefault();
      window.dispatchEvent(new Event(OPEN_MAP_EVENT));
    } else if (keyMatchesBinding(this.keyBindings, 'journal', event.key)) {
      event.preventDefault();
      window.dispatchEvent(new Event(OPEN_JOURNAL_EVENT));
    }
  };

  public constructor() {
    super('torch-world');
  }

  public preload(): void {
    this.load.image('hero-knight-marker', heroAssets.knight.marker);
    this.load.image('enemy-slime-marker', enemyAssets.slime.marker);
  }

  public create(): void {
    this.board = this.add.graphics();
    // Fog tiles are mounted once and updated in place. Clearing and redrawing
    // one large Graphics object during a reveal was the source of the WebGL
    // one-frame pops we saw around newly revealed trees and terrain.
    this.fogLayer = this.add.container(0, 0).setDepth(0.5);
    // Grid strokes need their own layer: a lit tile has no fog fill alpha,
    // so drawing the stroke on that same rectangle would make the grid
    // disappear with the fill.
    this.gridLayer = this.add.container(0, 0).setDepth(0.6);
    this.showGrid = readShowGridPreference();
    this.reduceMotion = readReduceMotionPreference();
    this.keyBindings = readKeyBindings();
    this.controllerInput.reset();
    this.textures.get('hero-knight-marker').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.textures.get('enemy-slime-marker').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.heroImage = this.add.image(0, 0, 'hero-knight-marker').setDepth(2);
    this.presentationColors = {
      grid: cssHexColorToNumber(readCssColorToken('--ui-color-grid', '#3a3328'), 0x3a3328),
      fog: cssHexColorToNumber(readCssColorToken('--ui-color-fog', '#15130f'), 0x15130f),
    };
    this.cameras.main.setBackgroundColor(readCssColorToken('--ui-color-background', '#0c0b09'));
    this.unsubscribe = gameSession.subscribe((_state, events) => this.redraw(true, events));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this);
    this.bindDevicePixelRatioListener();
    this.resizeObserver =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(this.scheduleViewportSync);
    this.resizeObserver?.observe(this.game.canvas.parentElement ?? this.game.canvas);
    window.addEventListener('resize', this.scheduleViewportSync);
    window.visualViewport?.addEventListener('resize', this.scheduleViewportSync);
    window.addEventListener(SHOW_GRID_EVENT, this.handleShowGridChange);
    window.addEventListener(REDUCE_MOTION_EVENT, this.handleReduceMotionChange);
    window.addEventListener(KEY_BINDINGS_EVENT, this.handleKeyBindingsChange);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    this.input.keyboard?.on('keydown', this.handleKeyDown);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
      this.input.keyboard?.off('keydown', this.handleKeyDown);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this);
      this.heroTween?.stop();
      this.resizeObserver?.disconnect();
      window.removeEventListener('resize', this.scheduleViewportSync);
      window.visualViewport?.removeEventListener('resize', this.scheduleViewportSync);
      this.unbindDevicePixelRatioListener();
      if (this.resizeFrame !== undefined) window.cancelAnimationFrame(this.resizeFrame);
      window.removeEventListener(SHOW_GRID_EVENT, this.handleShowGridChange);
      window.removeEventListener(REDUCE_MOTION_EVENT, this.handleReduceMotionChange);
      window.removeEventListener(KEY_BINDINGS_EVENT, this.handleKeyBindingsChange);
      this.controllerInput.reset();
    });

    this.syncLogicalViewport();
    this.redraw();
  }

  public update(): void {
    // Poll even while UI or animation owns input so a held control does not
    // unexpectedly fire when the world becomes available again.
    const action = this.controllerInput.poll(readConnectedGamepad());
    if (!action || gameSession.inputMode !== 'world' || this.heroAnimating) return;

    const direction = directionForInputAction(action);
    if (direction) gameSession.move(direction);
    else if (action === 'wait') gameSession.wait();
    else if (action === 'gather') gameSession.gather();
    else if (action === 'map') window.dispatchEvent(new Event(OPEN_MAP_EVENT));
    else if (action === 'journal') window.dispatchEvent(new Event(OPEN_JOURNAL_EVENT));
  }

  private handleScaleResize = (): void => {
    this.syncLogicalViewport();
    this.redraw(false);
  };

  private handleShowGridChange = (event: Event): void => {
    const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
    this.showGrid = enabled ?? readShowGridPreference();
    this.redraw(false);
  };

  private handleReduceMotionChange = (event: Event): void => {
    const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
    this.reduceMotion = enabled ?? readReduceMotionPreference();
    this.heroTween?.stop();
    this.heroTween = undefined;
    this.heroAnimating = false;
    this.redraw(false);
  };

  private handleKeyBindingsChange = (): void => {
    this.keyBindings = readKeyBindings();
  };

  private scheduleViewportSync = (): void => {
    if (this.resizeFrame !== undefined) return;
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      this.syncLogicalViewport();
      return;
    }
    this.resizeFrame = window.requestAnimationFrame(() => {
      this.resizeFrame = undefined;
      this.syncLogicalViewport();
    });
  };

  private syncLogicalViewport = (): void => {
    const container = this.game.canvas.parentElement;
    if (!container) return;

    const bounds = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width || this.scale.width));
    const height = Math.max(1, Math.round(bounds.height || this.scale.height));

    if (this.viewportSize.width === width && this.viewportSize.height === height) return;

    this.viewportSize = { width, height };
    this.redraw(false);
  };

  private bindDevicePixelRatioListener(): void {
    this.unbindDevicePixelRatioListener();
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    this.dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    if (typeof this.dprMediaQuery.addEventListener === 'function') {
      this.dprMediaQuery.addEventListener('change', this.handleDevicePixelRatioChange);
    } else {
      this.dprMediaQuery.addListener(this.handleDevicePixelRatioChange);
    }
  }

  private unbindDevicePixelRatioListener(): void {
    if (!this.dprMediaQuery) return;
    if (typeof this.dprMediaQuery.removeEventListener === 'function') {
      this.dprMediaQuery.removeEventListener('change', this.handleDevicePixelRatioChange);
    } else {
      this.dprMediaQuery.removeListener(this.handleDevicePixelRatioChange);
    }
    this.dprMediaQuery = undefined;
  }

  private handlePointer(screenX: number, screenY: number): void {
    if (gameSession.inputMode !== 'world' || this.heroAnimating) return;

    const target = this.screenToTile(screenX, screenY);
    const hero = gameSession.state.hero.position;
    const distance = Math.abs(target.x - hero.x) + Math.abs(target.y - hero.y);

    if (distance !== 1) return;

    const deltaX = target.x - hero.x;
    const deltaY = target.y - hero.y;
    if (deltaX === 1) gameSession.move('east');
    else if (deltaX === -1) gameSession.move('west');
    else if (deltaY === 1) gameSession.move('south');
    else if (deltaY === -1) gameSession.move('north');
  }

  private screenToTile(screenX: number, screenY: number): Position {
    const tileSize = this.tileSize();
    const hero = gameSession.state.hero.position;
    const centerX = this.viewportSize.width / 2;
    const centerY = this.viewportSize.height / 2;
    return {
      x: hero.x + Math.floor((screenX - centerX + tileSize / 2) / tileSize),
      y: hero.y + Math.floor((screenY - centerY + tileSize / 2) / tileSize),
    };
  }

  private tileScreenPosition(
    position: Position,
    tileSize: number,
    camera = this.cameraPosition ?? gameSession.state.hero.position,
  ): Position {
    return {
      x: this.viewportSize.width / 2 + (position.x - camera.x) * tileSize - tileSize / 2,
      y: this.viewportSize.height / 2 + (position.y - camera.y) * tileSize - tileSize / 2,
    };
  }

  private tileSize(): number {
    return tileSizeForViewport(this.viewportSize.width, this.viewportSize.height);
  }

  private redraw(animateHero = true, events: SimEvent[] = []): void {
    if (!this.board) return;

    const state = gameSession.state;
    const hero = state.hero.position;
    const previousHero = this.lastSimulationHeroPosition;
    const heroMoved = previousHero !== undefined && !samePosition(previousHero, hero);
    const previousVisibility = this.lastVisibilitySnapshot ?? captureVisibilitySnapshot(state);
    const currentVisibility = captureVisibilitySnapshot(state);
    const hasVisibilityChanged = visibilityChanged(previousVisibility, currentVisibility);
    const entityMoved = this.prepareEntityMotion(state, events);
    this.lastSimulationHeroPosition = { ...hero };
    this.lastVisibilitySnapshot = currentVisibility;

    if (this.reduceMotion || !animateHero || (!heroMoved && !entityMoved) || (heroMoved && !previousHero)) {
      this.heroTween?.stop();
      this.heroTween = undefined;
      this.heroAnimating = false;
      this.visibilityProgress.value = 1;
      this.cameraPosition = { ...hero };
      this.visualHeroPosition = { ...hero };
      this.renderFrame(previousVisibility, currentVisibility);
      return;
    }

    this.heroTween?.stop();
    this.movementProgress.value = 0;
    this.visibilityProgress.value = hasVisibilityChanged ? 0 : 1;
    this.cameraPosition = { ...(previousHero ?? hero) };
    this.visualHeroPosition = { ...(previousHero ?? hero) };
    this.heroAnimating = true;
    this.boardBaseCamera = { ...(previousHero ?? hero) };
    this.renderFrame(previousVisibility, currentVisibility, hasVisibilityChanged ? 0 : 1);
    this.heroTween = this.tweens.add({
      targets: [this.movementProgress, this.visibilityProgress],
      value: 1,
      // Keep the action boundary discrete while giving the Torch reveal a
      // little more time to breathe between tiles.
      duration: 240,
      ease: 'Linear',
      onUpdate: () => this.renderMovementFrame(previousHero ?? hero, hero, previousVisibility, currentVisibility),
      onComplete: () => {
        this.heroTween = undefined;
        this.heroAnimating = false;
        this.cameraPosition = { ...hero };
        this.visualHeroPosition = { ...hero };
        this.renderMovementFrame(
          previousHero ?? hero,
          hero,
          previousVisibility,
          currentVisibility,
          hasVisibilityChanged,
        );
      },
    });
    this.renderMovementFrame(previousHero ?? hero, hero, previousVisibility, currentVisibility);
  }

  private renderMovementFrame(
    previousHero: Position,
    currentHero: Position,
    previousVisibility: VisibilitySnapshot,
    currentVisibility: VisibilitySnapshot,
    forceBoardRedraw = false,
  ): void {
    const progress = this.movementProgress.value;
    const heroProgress = Math.sin((progress * Math.PI) / 2);
    this.cameraPosition = interpolatePosition(previousHero, currentHero, progress);
    this.visualHeroPosition = interpolatePosition(previousHero, currentHero, heroProgress);
    devFrameMonitor.measure('scene.render', () => {
      const tileSize = this.tileSize();
      const baseCamera = this.boardBaseCamera ?? previousHero;
      this.renderBoardLayers(
        previousVisibility,
        currentVisibility,
        this.visibilityProgress.value,
        baseCamera,
        tileSize,
        forceBoardRedraw,
      );
      for (const [entityId, motion] of this.entityMotions) {
        this.visualEntityPositions.set(entityId, interpolatePosition(motion.from, motion.to, progress));
      }
      this.positionEntityTokens(
        gameSession.state,
        tileSize,
        false,
        previousVisibility,
        currentVisibility,
        this.visibilityProgress.value,
      );
      this.positionHeroImage(tileSize);
    });
  }

  private renderFrame(
    previousVisibility?: VisibilitySnapshot,
    currentVisibility?: VisibilitySnapshot,
    visibilityProgress = 1,
  ): void {
    devFrameMonitor.measure('scene.render', () =>
      this.renderFrameInternal(previousVisibility, currentVisibility, visibilityProgress),
    );
  }

  private renderFrameInternal(
    previousVisibility?: VisibilitySnapshot,
    currentVisibility?: VisibilitySnapshot,
    visibilityProgress = 1,
  ): void {
    const state = gameSession.state;
    const hero = state.hero.position;
    const tileSize = this.tileSize();
    const viewRadius = viewRadiusForViewport(this.viewportSize.width, this.viewportSize.height, tileSize);
    this.prewarmNearbyTiles(state.seed, hero, viewRadius.x + 1, viewRadius.y + 1);
    const baseCamera = this.cameraPosition ?? hero;
    this.boardBaseCamera = { ...baseCamera };
    const sourceVisibility = previousVisibility ?? captureVisibilitySnapshot(state);
    const targetVisibility = currentVisibility ?? captureVisibilitySnapshot(state);
    this.renderBoardLayers(sourceVisibility, targetVisibility, visibilityProgress, baseCamera, tileSize, false);
    this.positionEntityTokens(state, tileSize, true, sourceVisibility, targetVisibility, visibilityProgress);
    this.positionHeroImage(tileSize);
  }

  private renderBoardLayers(
    previousVisibility: VisibilitySnapshot,
    currentVisibility: VisibilitySnapshot,
    progress: number,
    baseCamera: Position,
    tileSize: number,
    forceRedraw: boolean,
  ): void {
    const terrainKey = this.terrainFrameKey(baseCamera, tileSize);
    if (forceRedraw || this.terrainDrawKey !== terrainKey) {
      this.drawTerrainFrame(baseCamera, tileSize);
      this.terrainDrawKey = terrainKey;
    }

    const fogKey = this.fogFrameKey(previousVisibility, currentVisibility, progress, baseCamera, tileSize);
    if (forceRedraw || progress < 1 || this.fogDrawKey !== fogKey) {
      this.drawFogFrame(previousVisibility, currentVisibility, progress, baseCamera, tileSize);
      this.fogDrawKey = fogKey;
    } else {
      this.positionBoard(baseCamera, tileSize);
    }
  }

  private drawTerrainFrame(baseCamera: Position, tileSize: number): void {
    const state = gameSession.state;
    const viewRadius = viewRadiusForViewport(this.viewportSize.width, this.viewportSize.height, tileSize);
    this.positionBoard(baseCamera, tileSize);
    this.board.clear();

    for (let y = baseCamera.y - viewRadius.y - 1; y <= baseCamera.y + viewRadius.y + 1; y += 1) {
      for (let x = baseCamera.x - viewRadius.x - 1; x <= baseCamera.x + viewRadius.x + 1; x += 1) {
        const position = { x, y };
        const screen = this.tileScreenPosition(position, tileSize, baseCamera);
        const baseColor = this.tileColor(this.cachedTileAt(state.seed, position));
        this.board.fillStyle(baseColor, 1);
        this.board.fillRect(screen.x, screen.y, tileSize, tileSize);
      }
    }
  }

  private drawFogFrame(
    previousVisibility: VisibilitySnapshot,
    currentVisibility: VisibilitySnapshot,
    progress: number,
    baseCamera: Position,
    tileSize: number,
  ): void {
    const viewRadius = viewRadiusForViewport(this.viewportSize.width, this.viewportSize.height, tileSize);
    this.positionBoard(baseCamera, tileSize);
    let tileIndex = 0;

    for (let y = baseCamera.y - viewRadius.y - 1; y <= baseCamera.y + viewRadius.y + 1; y += 1) {
      for (let x = baseCamera.x - viewRadius.x - 1; x <= baseCamera.x + viewRadius.x + 1; x += 1) {
        const position = { x, y };
        const screen = this.tileScreenPosition(position, tileSize, baseCamera);
        const visibility = interpolatedVisibilityLevel(previousVisibility, currentVisibility, position, progress);
        const fogAlpha = fogAlphaForVisibility(visibility);
        const gridAlpha = gridAlphaForVisibility(this.showGrid, visibility);
        const fogTile = this.fogTileAt(tileIndex, tileSize);
        fogTile
          .setPosition(screen.x + tileSize / 2, screen.y + tileSize / 2)
          .setAlpha(fogAlpha)
          .setVisible(fogAlpha > 0.005 || gridAlpha > 0);
        fogTile.setStrokeStyle(0, this.presentationColors.grid, 0);

        const gridTile = this.gridTileAt(tileIndex, tileSize);
        gridTile
          .setPosition(screen.x + tileSize / 2, screen.y + tileSize / 2)
          .setAlpha(1)
          .setVisible(gridAlpha > 0)
          .setStrokeStyle(2, this.presentationColors.grid, gridAlpha);
        tileIndex += 1;
      }
    }

    for (let index = tileIndex; index < this.fogTiles.length; index += 1) {
      this.fogTiles[index].setVisible(false);
    }
    for (let index = tileIndex; index < this.gridTiles.length; index += 1) {
      this.gridTiles[index].setVisible(false);
    }
  }

  private fogTileAt(index: number, tileSize: number): Phaser.GameObjects.Rectangle {
    const existing = this.fogTiles[index];
    if (existing) {
      existing.setSize(tileSize, tileSize).setDisplaySize(tileSize, tileSize);
      return existing;
    }

    const tile = this.add.rectangle(0, 0, tileSize, tileSize, this.presentationColors.fog, 1);
    this.fogLayer.add(tile);
    this.fogTiles.push(tile);
    return tile;
  }

  private gridTileAt(index: number, tileSize: number): Phaser.GameObjects.Rectangle {
    const existing = this.gridTiles[index];
    if (existing) {
      existing.setSize(tileSize, tileSize).setDisplaySize(tileSize, tileSize);
      return existing;
    }

    const tile = this.add.rectangle(0, 0, tileSize, tileSize, 0x000000, 0);
    this.gridLayer.add(tile);
    this.gridTiles.push(tile);
    return tile;
  }

  private terrainFrameKey(baseCamera: Position, tileSize: number): string {
    const viewRadius = viewRadiusForViewport(this.viewportSize.width, this.viewportSize.height, tileSize);
    return [
      gameSession.state.seed,
      gameSession.state.generationVersion,
      baseCamera.x,
      baseCamera.y,
      tileSize,
      viewRadius.x,
      viewRadius.y,
      this.showGrid,
    ].join(':');
  }

  private fogFrameKey(
    previousVisibility: VisibilitySnapshot,
    currentVisibility: VisibilitySnapshot,
    progress: number,
    baseCamera: Position,
    tileSize: number,
  ): string {
    return [
      previousVisibility.hero.x,
      previousVisibility.hero.y,
      currentVisibility.hero.x,
      currentVisibility.hero.y,
      previousVisibility.revealedTiles.size,
      currentVisibility.revealedTiles.size,
      progress >= 1 ? 1 : 0,
      baseCamera.x,
      baseCamera.y,
      tileSize,
      this.showGrid,
    ].join(':');
  }

  private positionBoard(baseCamera: Position, tileSize: number): void {
    const camera = this.cameraPosition ?? baseCamera;
    this.board.setPosition((baseCamera.x - camera.x) * tileSize, (baseCamera.y - camera.y) * tileSize);
    this.fogLayer.setPosition((baseCamera.x - camera.x) * tileSize, (baseCamera.y - camera.y) * tileSize);
    this.gridLayer.setPosition((baseCamera.x - camera.x) * tileSize, (baseCamera.y - camera.y) * tileSize);
  }

  private prepareEntityMotion(state: GameState, events: SimEvent[]): boolean {
    const eventMotions = new Map<string, EntityMotion>();
    for (const event of events) {
      if (event.type === 'enemy-moved') {
        eventMotions.set(event.entityId, { from: event.from, to: event.to });
      }
    }

    this.entityMotions.clear();
    const currentEntityIds = new Set(Object.keys(state.entities));
    for (const [entityId, entity] of Object.entries(state.entities)) {
      const currentPosition = { ...entity.position };
      const previousPosition = this.visualEntityPositions.get(entityId);
      const eventMotion = eventMotions.get(entityId);
      const from = eventMotion?.from ?? previousPosition ?? currentPosition;
      const to = eventMotion?.to ?? currentPosition;

      if (!samePosition(from, to)) {
        this.entityMotions.set(entityId, { from: { ...from }, to: { ...to } });
        this.visualEntityPositions.set(entityId, { ...from });
      } else {
        this.visualEntityPositions.set(entityId, currentPosition);
      }
    }

    for (const entityId of this.visualEntityPositions.keys()) {
      if (!currentEntityIds.has(entityId)) {
        this.visualEntityPositions.delete(entityId);
      }
    }

    return this.entityMotions.size > 0;
  }

  private positionEntityTokens(
    state: GameState,
    tileSize: number,
    redrawTokens = false,
    previousVisibility = captureVisibilitySnapshot(state),
    currentVisibility = previousVisibility,
    visibilityProgress = 1,
  ): void {
    const visibleEntityIds = new Set<string>();

    for (const [entityId, entity] of Object.entries(state.entities)) {
      visibleEntityIds.add(entityId);
      let token = this.entityTokens.get(entityId);
      if (!token) {
        token = this.createEntityToken(entity);
        this.entityTokens.set(entityId, token);
        redrawTokens = true;
      }

      const position = this.visualEntityPositions.get(entityId) ?? entity.position;
      const screen = this.tileScreenPosition(position, tileSize);
      if (token instanceof Phaser.GameObjects.Graphics && (redrawTokens || this.entityTokenTileSize !== tileSize)) {
        token.clear();
        this.drawEntity(token, entity, tileSize);
      }
      const footprint = entityFootprint(entity);
      if (token instanceof Phaser.GameObjects.Image) {
        token
          .setDisplaySize(tileSize * footprint.width, tileSize * footprint.height)
          .setPosition(screen.x + (tileSize * footprint.width) / 2, screen.y + (tileSize * footprint.height) / 2);
      } else {
        token.setPosition(screen.x, screen.y);
      }
      const alpha = this.calculateEntityVisibilityAlpha(
        entity,
        previousVisibility,
        currentVisibility,
        visibilityProgress,
      );
      token.setAlpha(alpha);
      // Keep the token mounted while it dissolves. Toggling the display-list
      // visibility at the reveal threshold can produce a one-frame pop in
      // WebGL, especially while the fog Graphics layer is being rebuilt.
      token.setVisible(true);
    }

    for (const [entityId, token] of this.entityTokens) {
      if (!visibleEntityIds.has(entityId)) {
        token.destroy();
        this.entityTokens.delete(entityId);
      }
    }

    this.entityTokenTileSize = tileSize;
  }

  private createEntityToken(entity: GameState['entities'][string]): EntityToken {
    if (entity.assetId === enemyAssets.slime.id) {
      return this.add.image(0, 0, 'enemy-slime-marker').setDepth(1);
    }

    return this.add.graphics().setDepth(1);
  }

  private calculateEntityVisibilityAlpha(
    entity: GameState['entities'][string],
    previousVisibility: VisibilitySnapshot,
    currentVisibility: VisibilitySnapshot,
    visibilityProgress: number,
  ): number {
    if (entity.kind === 'homestead') return 0;

    const motion = this.entityMotions.get(entity.id);
    const positions = motion ? [entity.position, motion.from] : [entity.position];
    const level = positions
      .flatMap((position) => footprintPositions(position, entityFootprint(entity)))
      .reduce(
        (highest, tile) =>
          Math.max(
            highest,
            interpolatedVisibilityLevel(previousVisibility, currentVisibility, tile, visibilityProgress),
          ),
        0,
      );
    return entityVisibilityAlpha(level);
  }

  private positionHeroImage(
    tileSize: number,
    visualHero = this.visualHeroPosition ?? gameSession.state.hero.position,
  ): void {
    const heroScreen = this.tileScreenPosition(visualHero, tileSize);
    this.heroImage
      .setDisplaySize(tileSize, tileSize)
      .setPosition(heroScreen.x + tileSize / 2, heroScreen.y + tileSize / 2);
  }

  private prewarmNearbyTiles(seed: number, center: Position, radiusX: number, radiusY: number): void {
    if (this.tileCacheSeed !== seed) {
      this.tileCache.clear();
      this.tileCacheSeed = seed;
    }

    for (let y = center.y - radiusY; y <= center.y + radiusY; y += 1) {
      for (let x = center.x - radiusX; x <= center.x + radiusX; x += 1) {
        const key = `${x},${y}`;
        if (!this.tileCache.has(key)) {
          this.tileCache.set(key, tileAt(seed, { x, y }));
        }
      }
    }
  }

  private cachedTileAt(seed: number, position: Position): ReturnType<typeof tileAt> {
    const key = positionKey(position);
    const cached = this.tileCache.get(key);
    if (cached) return cached;

    const generated = tileAt(seed, position);
    this.tileCache.set(key, generated);
    return generated;
  }

  private tileColor(kind: ReturnType<typeof tileAt>): number {
    switch (kind) {
      case 'mountain':
        return COLORS.mountain;
      case 'grass':
      default:
        return COLORS.grass;
    }
  }

  private drawEntity(
    target: Phaser.GameObjects.Graphics,
    entity: GameState['entities'][string],
    tileSize: number,
  ): void {
    const footprint = entityFootprint(entity);
    const width = tileSize * footprint.width;
    const height = tileSize * footprint.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const cornerRadius = tileSize * 0.12;

    if (entity.kind === 'enemy') {
      target.fillStyle(COLORS.enemy, 1);
      target.fillRoundedRect(0, 0, width, height, cornerRadius);
      return;
    }

    if (entity.kind === 'tree') {
      target.fillStyle(COLORS.tree, 1);
      target.fillCircle(centerX, centerY - tileSize * 0.06, tileSize * 0.19);
      target.fillStyle(0x7b5135, 1);
      target.fillRect(centerX - tileSize * 0.04, centerY + tileSize * 0.06, tileSize * 0.08, tileSize * 0.17);
      return;
    }

    if (entity.kind === 'ore') {
      target.fillStyle(COLORS.ore, 1);
      target.fillRoundedRect(0, 0, width, height, cornerRadius);
      target.fillStyle(0x6f8292, 1);
      target.fillRect(width * 0.25, height * 0.23, tileSize * 0.11, tileSize * 0.11);
      return;
    }

    // The homestead remains in simulation state for respawn and persistence,
    // but it is intentionally not rendered as a world-space marker yet.
  }
}

function interpolatePosition(from: Position, to: Position, progress: number): Position {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}
