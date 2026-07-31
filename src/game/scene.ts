import Phaser from 'phaser';
import {
  entityFootprint,
  footprintPositions,
  isTileRevealed,
  positionKey,
  samePosition,
  tileAt,
  TORCH_RADIUS,
} from '../sim';
import type { GameState, Position, SimEvent } from '../sim';
import { heroAssets } from '../content/hero-assets';
import { enemyAssets } from '../content/enemy-assets';
import { devFrameMonitor } from '../dev/frame-monitor';
import { tileSizeForViewport, viewRadiusForViewport } from './layout';
import { gameSession } from './session';
import {
  captureVisibilitySnapshot,
  visibilityChanged,
  visibilityColor,
  visibilityLevel,
} from './visibility';
import type { VisibilitySnapshot } from './visibility';

const COLORS = {
  grass: 0x263c2a,
  forest: 0x183b2f,
  trail: 0x6e5a3f,
  mountain: 0x414751,
  water: 0x1d3a58,
  grid: 0x3a4a48,
  unseen: 0x151719,
  remembered: 0x111722,
  enemy: 0xe86a67,
  tree: 0x79bd70,
  ore: 0xb8c9d4,
  homestead: 0xf2a85c,
};

interface EntityMotion {
  from: Position;
  to: Position;
}

type EntityToken = Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;

export class TorchScene extends Phaser.Scene {
  private board!: Phaser.GameObjects.Graphics;
  private heroImage!: Phaser.GameObjects.Image;
  private entityTokens = new Map<string, EntityToken>();
  private visualEntityPositions = new Map<string, Position>();
  private entityMotions = new Map<string, EntityMotion>();
  private unsubscribe?: () => void;
  private resizeObserver?: ResizeObserver;
  private renderResolution = 1;
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

  public constructor() {
    super('torch-world');
  }

  public preload(): void {
    this.load.image('hero-knight-marker', heroAssets.knight.marker);
    this.load.image('enemy-slime-marker', enemyAssets.slime.marker);
  }

  public create(): void {
    this.board = this.add.graphics();
    this.textures.get('hero-knight-marker').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.textures.get('enemy-slime-marker').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.heroImage = this.add
      .image(0, 0, 'hero-knight-marker')
      .setDepth(2);
    this.cameras.main.setBackgroundColor('#080b10');
    this.unsubscribe = gameSession.subscribe((_state, events) => this.redraw(true, events));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this);
    this.renderResolution = Math.min(2, Math.max(1, this.game.device.os.pixelRatio || 1));
    this.resizeObserver = typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(() => this.resizeToViewport());
    this.resizeObserver?.observe(this.game.canvas.parentElement ?? this.game.canvas);
    window.addEventListener('resize', this.resizeToViewport);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.handlePointer(pointer.x, pointer.y);
    });

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (gameSession.inputMode !== 'world' || this.heroAnimating) return;

      const direction = this.directionForKey(event.key);
      if (direction) {
        event.preventDefault();
        gameSession.move(direction);
      } else if (event.key.toLowerCase() === ' ') {
        event.preventDefault();
        gameSession.wait();
      } else if (event.key.toLowerCase() === 'g') {
        event.preventDefault();
        gameSession.gather();
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleScaleResize, this);
      this.heroTween?.stop();
      this.resizeObserver?.disconnect();
      window.removeEventListener('resize', this.resizeToViewport);
    });

    this.resizeToViewport();
    this.redraw();
  }

  private handleScaleResize = (): void => {
    this.redraw(false);
  };

  private resizeToViewport = (): void => {
    const container = this.game.canvas.parentElement;
    if (!container) return;

    const bounds = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width * this.renderResolution));
    const height = Math.max(1, Math.round(bounds.height * this.renderResolution));

    if (this.scale.width === width && this.scale.height === height) return;

    this.scale.resize(width, height);
  };

  private directionForKey(key: string): 'north' | 'south' | 'west' | 'east' | undefined {
    switch (key.toLowerCase()) {
      case 'arrowup':
      case 'w':
        return 'north';
      case 'arrowdown':
      case 's':
        return 'south';
      case 'arrowleft':
      case 'a':
        return 'west';
      case 'arrowright':
      case 'd':
        return 'east';
      default:
        return undefined;
    }
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
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
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
      x: this.scale.width / 2 + (position.x - camera.x) * tileSize - tileSize / 2,
      y: this.scale.height / 2 + (position.y - camera.y) * tileSize - tileSize / 2,
    };
  }

  private tileSize(): number {
    return tileSizeForViewport(this.scale.width, this.scale.height);
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

    if (!animateHero || (!heroMoved && !entityMoved) || (heroMoved && !previousHero)) {
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
      duration: 180,
      ease: 'Linear',
      onUpdate: () => this.renderMovementFrame(previousHero ?? hero, hero, previousVisibility, currentVisibility),
      onComplete: () => {
        this.heroTween = undefined;
        this.heroAnimating = false;
        this.cameraPosition = { ...hero };
        this.visualHeroPosition = { ...hero };
        this.renderMovementFrame(previousHero ?? hero, hero, previousVisibility, currentVisibility, hasVisibilityChanged);
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
    const heroProgress = Math.sin(progress * Math.PI / 2);
    this.cameraPosition = interpolatePosition(previousHero, currentHero, progress);
    this.visualHeroPosition = interpolatePosition(previousHero, currentHero, heroProgress);
    devFrameMonitor.measure('scene.render', () => {
      const tileSize = this.tileSize();
      const baseCamera = this.boardBaseCamera ?? previousHero;
      if (forceBoardRedraw || this.visibilityProgress.value < 1) {
        this.drawBoardFrame(previousVisibility, currentVisibility, this.visibilityProgress.value, baseCamera, tileSize);
      } else {
        this.positionBoard(baseCamera, tileSize);
      }
      for (const [entityId, motion] of this.entityMotions) {
        this.visualEntityPositions.set(entityId, interpolatePosition(motion.from, motion.to, progress));
      }
      this.positionEntityTokens(gameSession.state, tileSize, false);
      this.positionHeroImage(tileSize);
    });
  }

  private renderFrame(
    previousVisibility?: VisibilitySnapshot,
    currentVisibility?: VisibilitySnapshot,
    visibilityProgress = 1,
  ): void {
    devFrameMonitor.measure('scene.render', () => this.renderFrameInternal(previousVisibility, currentVisibility, visibilityProgress));
  }

  private renderFrameInternal(
    previousVisibility?: VisibilitySnapshot,
    currentVisibility?: VisibilitySnapshot,
    visibilityProgress = 1,
  ): void {
    const state = gameSession.state;
    const hero = state.hero.position;
    const tileSize = this.tileSize();
    const viewRadius = viewRadiusForViewport(this.scale.width, this.scale.height, tileSize);
    this.prewarmNearbyTiles(state.seed, hero, viewRadius.x + 1, viewRadius.y + 1);
    const baseCamera = this.cameraPosition ?? hero;
    this.boardBaseCamera = { ...baseCamera };
    const sourceVisibility = previousVisibility ?? captureVisibilitySnapshot(state);
    const targetVisibility = currentVisibility ?? captureVisibilitySnapshot(state);
    this.drawBoardFrame(sourceVisibility, targetVisibility, visibilityProgress, baseCamera, tileSize);
    this.positionEntityTokens(state, tileSize, true);
    this.positionHeroImage(tileSize);
  }

  private drawBoardFrame(
    previousVisibility: VisibilitySnapshot,
    currentVisibility: VisibilitySnapshot,
    progress: number,
    baseCamera: Position,
    tileSize: number,
  ): void {
    const state = gameSession.state;
    const hero = state.hero.position;
    const viewRadius = viewRadiusForViewport(this.scale.width, this.scale.height, tileSize);
    this.positionBoard(baseCamera, tileSize);
    this.board.clear();

    for (let y = hero.y - viewRadius.y; y <= hero.y + viewRadius.y; y += 1) {
      for (let x = hero.x - viewRadius.x; x <= hero.x + viewRadius.x; x += 1) {
        const position = { x, y };
        const screen = this.tileScreenPosition(position, tileSize, baseCamera);
        const baseColor = this.tileColor(this.cachedTileAt(state.seed, position));
        const fromVisibility = visibilityLevel(previousVisibility, position);
        const toVisibility = visibilityLevel(currentVisibility, position);
        const visibility = fromVisibility + (toVisibility - fromVisibility) * progress;
        this.board.fillStyle(visibilityColor(baseColor, visibility, COLORS.unseen, COLORS.remembered), 1);
        this.board.fillRect(screen.x, screen.y, tileSize - 1, tileSize - 1);

        const gridAlpha = Math.max(0, Math.min(1, (visibility - 1.25) / 0.75)) * 0.32;
        if (gridAlpha > 0) {
          this.board.lineStyle(1, COLORS.grid, gridAlpha);
          this.board.strokeRect(screen.x, screen.y, tileSize - 1, tileSize - 1);
        }
      }
    }
  }

  private positionBoard(baseCamera: Position, tileSize: number): void {
    const camera = this.cameraPosition ?? baseCamera;
    this.board.setPosition(
      (baseCamera.x - camera.x) * tileSize,
      (baseCamera.y - camera.y) * tileSize,
    );
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

  private positionEntityTokens(state: GameState, tileSize: number, redrawTokens = false): void {
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
          .setPosition(
            screen.x + (tileSize * footprint.width) / 2,
            screen.y + (tileSize * footprint.height) / 2,
          );
      } else {
        token.setPosition(screen.x, screen.y);
      }
      token.setVisible(this.shouldShowEntity(state, entity, entityId));
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

  private shouldShowEntity(state: GameState, entity: GameState['entities'][string], entityId: string): boolean {
    const motion = this.entityMotions.get(entityId);
    const positions = motion ? [entity.position, motion.from] : [entity.position];
    return positions.some((position) => footprintPositions(position, entityFootprint(entity)).some((tile) => {
      if (!isTileRevealed(state, tile)) return false;
      const distanceSquared = (tile.x - state.hero.position.x) ** 2 + (tile.y - state.hero.position.y) ** 2;
      return distanceSquared <= TORCH_RADIUS ** 2 || samePosition(tile, state.hero.position);
    }));
  }

  private positionHeroImage(tileSize: number, visualHero = this.visualHeroPosition ?? gameSession.state.hero.position): void {
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
      case 'forest':
        return COLORS.forest;
      case 'trail':
        return COLORS.trail;
      case 'mountain':
        return COLORS.mountain;
      case 'water':
        return COLORS.water;
      case 'grass':
      default:
        return COLORS.grass;
    }
  }

  private drawEntity(target: Phaser.GameObjects.Graphics, entity: GameState['entities'][string], tileSize: number): void {
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

    target.lineStyle(2, COLORS.homestead, 1);
    target.strokeRoundedRect(0, 0, width, height, cornerRadius);
  }
}

function interpolatePosition(from: Position, to: Position, progress: number): Position {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}
