import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  Gem,
  Hammer,
  LockKeyhole,
  Minus,
  PackageOpen,
  Plus,
  Search,
  Sparkles,
  TreePine,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { gameSession } from '../game/session';
import { itemDefinition } from '../content/items';
import type { ItemIconId } from '../content/items';
import type { CraftingCategory, RecipeDefinition } from '../content/recipes';
import { availableRecipes } from '../sim/crafting';
import type { GameState, RecipeAvailability, SimEvent } from '../sim';
import { TorchButton } from './primitives';

type CraftingFilterCategory = CraftingCategory | 'all';

const categoryLabels: Record<CraftingFilterCategory, string> = {
  all: 'All recipes',
  materials: 'Materials',
  consumables: 'Consumables',
  equipment: 'Equipment',
  structures: 'Structures',
};

const craftingIcons: Record<ItemIconId, LucideIcon> = {
  tree: TreePine,
  gem: Gem,
  flask: FlaskConical,
  sparkles: Sparkles,
  package: PackageOpen,
  sword: Hammer,
};

export function CraftingScreen({ state, events }: { state: GameState; events: SimEvent[] }): ReactElement {
  const [category, setCategory] = useState<CraftingFilterCategory>('all');
  const [search, setSearch] = useState('');
  const [craftableOnly, setCraftableOnly] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>();
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState('Select a recipe to inspect its ingredients.');

  const recipeEntries = useMemo(() => availableRecipes(state), [state]);
  const visibleRecipes = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return recipeEntries.filter(({ recipe, known, craftable }) => {
      if (!showLocked && !known) return false;
      if (craftableOnly && !craftable) return false;
      if (category !== 'all' && recipe.category !== category) return false;
      if (!normalizedSearch) return true;
      return `${recipe.name} ${recipe.description}`.toLocaleLowerCase().includes(normalizedSearch);
    });
  }, [category, craftableOnly, recipeEntries, search, showLocked]);

  const selectedEntry = visibleRecipes.find(({ recipe }) => recipe.id === selectedRecipeId) ?? visibleRecipes[0];
  const selectedRecipe = selectedEntry?.recipe;
  const maxQuantity = selectedEntry?.maxCraftableQuantity ?? 0;

  useEffect(() => {
    if (selectedEntry?.recipe.id !== selectedRecipeId) setSelectedRecipeId(selectedEntry?.recipe.id);
  }, [selectedEntry, selectedRecipeId]);

  useEffect(() => {
    setQuantity((current) => (maxQuantity > 0 ? Math.max(1, Math.min(current, maxQuantity)) : 1));
  }, [maxQuantity, selectedRecipe?.id]);

  useEffect(() => {
    const message = [...events]
      .reverse()
      .find((event): event is Extract<SimEvent, { type: 'message' }> => event.type === 'message');
    if (message) setFeedback(message.text);
  }, [events]);

  const selectRecipe = (recipe: RecipeDefinition): void => {
    setSelectedRecipeId(recipe.id);
    setQuantity(1);
  };

  const craftSelected = (): void => {
    if (!selectedRecipe || !selectedEntry?.craftable) return;
    gameSession.craft(selectedRecipe.id, quantity);
  };

  return (
    <div className="crafting-screen" data-testid="crafting-screen">
      <header className="crafting-heading">
        <div>
          <p className="crafting-kicker">Workshop</p>
          <h2>Crafting</h2>
          <p className="crafting-subtitle">Turn gathered resources into supplies for the next expedition.</p>
        </div>
        <div className="crafting-feedback" role="status" aria-live="polite">
          <CheckCircle2 aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      </header>

      <div className="crafting-toolbar">
        <label className="crafting-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search recipes</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Search recipes"
            aria-label="Search recipes"
            data-testid="crafting-search"
          />
        </label>
        <TorchButton
          variant="outline"
          size="lg"
          type="button"
          className="crafting-filter-button"
          aria-pressed={craftableOnly}
          data-testid="crafting-filter-craftable"
          onClick={() => setCraftableOnly((current) => !current)}
        >
          <CheckCircle2 aria-hidden="true" />
          Craftable only
        </TorchButton>
        <TorchButton
          variant="outline"
          size="lg"
          type="button"
          className="crafting-filter-button"
          aria-pressed={showLocked}
          data-testid="crafting-filter-locked"
          onClick={() => setShowLocked((current) => !current)}
        >
          <LockKeyhole aria-hidden="true" />
          Show locked
        </TorchButton>
      </div>

      <div className="crafting-category-tabs" role="tablist" aria-label="Crafting categories">
        {(Object.keys(categoryLabels) as CraftingFilterCategory[]).map((categoryId) => (
          <TorchButton
            variant={category === categoryId ? 'secondary' : 'ghost'}
            size="lg"
            type="button"
            role="tab"
            aria-selected={category === categoryId}
            className="crafting-category-tab"
            data-testid={`crafting-category-${categoryId}`}
            key={categoryId}
            onClick={() => setCategory(categoryId)}
          >
            {categoryLabels[categoryId]}
          </TorchButton>
        ))}
      </div>

      <div className="crafting-body">
        <section className="crafting-recipe-panel" aria-labelledby="crafting-recipe-list-title">
          <div className="crafting-panel-heading">
            <div>
              <p className="crafting-kicker">Catalog</p>
              <h3 id="crafting-recipe-list-title">Recipes</h3>
            </div>
            <span className="crafting-count" aria-live="polite">
              {visibleRecipes.length} shown
            </span>
          </div>
          <div className="crafting-recipe-list" role="list" data-testid="crafting-recipe-list">
            {visibleRecipes.map((entry) => (
              <RecipeListItem
                key={entry.recipe.id}
                entry={entry}
                selected={entry.recipe.id === selectedRecipe?.id}
                onSelect={() => selectRecipe(entry.recipe)}
              />
            ))}
            {visibleRecipes.length === 0 ? (
              <div className="crafting-empty" role="status">
                <PackageOpen aria-hidden="true" />
                <strong>No recipes match those filters.</strong>
                <span>Try another category or show locked recipes.</span>
              </div>
            ) : null}
          </div>
        </section>

        <aside
          className="crafting-inspector"
          aria-labelledby="crafting-inspector-title"
          data-testid="crafting-inspector"
        >
          {selectedEntry ? (
            <RecipeInspector
              entry={selectedEntry}
              quantity={quantity}
              onQuantityChange={setQuantity}
              onCraft={craftSelected}
            />
          ) : (
            <div className="crafting-empty crafting-empty-inspector">
              <Hammer aria-hidden="true" />
              <strong id="crafting-inspector-title">Choose a recipe</strong>
              <span>Ingredient requirements and the craft action will appear here.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function RecipeListItem({
  entry,
  selected,
  onSelect,
}: {
  entry: RecipeAvailability;
  selected: boolean;
  onSelect: () => void;
}): ReactElement {
  const OutputIcon = itemIcon(entry.recipe.output.itemId);
  const status = statusForAvailability(entry);
  return (
    <div role="listitem">
      <TorchButton
        variant="ghost"
        size="lg"
        type="button"
        className={`crafting-recipe-button${selected ? ' is-selected' : ''}`}
        aria-pressed={selected}
        aria-label={`${entry.recipe.name}, ${status}`}
        data-testid={`crafting-recipe-${entry.recipe.id}`}
        onClick={onSelect}
      >
        <span className="crafting-recipe-icon" aria-hidden="true">
          <OutputIcon />
        </span>
        <span className="crafting-recipe-copy">
          <strong>{entry.recipe.name}</strong>
          <small>{status}</small>
        </span>
        {entry.known ? (
          <span className="crafting-recipe-quantity">×{entry.recipe.output.quantity}</span>
        ) : (
          <LockKeyhole aria-hidden="true" />
        )}
      </TorchButton>
    </div>
  );
}

function RecipeInspector({
  entry,
  quantity,
  onQuantityChange,
  onCraft,
}: {
  entry: RecipeAvailability;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onCraft: () => void;
}): ReactElement {
  const { recipe } = entry;
  const OutputIcon = itemIcon(recipe.output.itemId);
  const status = statusForAvailability(entry);
  const canCraft = entry.craftable && entry.maxCraftableQuantity > 0;
  return (
    <div className="crafting-inspector-inner">
      <div className="crafting-inspector-heading">
        <div className="crafting-output-icon" aria-hidden="true">
          <OutputIcon />
        </div>
        <div>
          <p className="crafting-kicker">Recipe detail</p>
          <h3 id="crafting-inspector-title">{recipe.name}</h3>
          <span className={`crafting-status ${canCraft ? 'is-ready' : 'is-blocked'}`}>
            {canCraft ? <CheckCircle2 aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
            {status}
          </span>
        </div>
      </div>
      <p className="crafting-description">{recipe.description}</p>

      <section className="crafting-requirements" aria-labelledby="crafting-requirements-title">
        <div className="crafting-section-label">
          <span id="crafting-requirements-title">Ingredients</span>
          <span>Per craft</span>
        </div>
        <div className="crafting-ingredient-list">
          {recipe.ingredients.map((ingredient) => {
            const definition = itemDefinition(ingredient.itemId);
            const available = Math.max(
              0,
              entry.missingIngredients.find((missing) => missing.itemId === ingredient.itemId)
                ? ingredient.quantity -
                    (entry.missingIngredients.find((missing) => missing.itemId === ingredient.itemId)?.quantity ?? 0)
                : ingredient.quantity,
            );
            const IngredientIcon = itemIcon(ingredient.itemId);
            return (
              <div className="crafting-ingredient" key={ingredient.itemId}>
                <span className="crafting-ingredient-icon" aria-hidden="true">
                  <IngredientIcon />
                </span>
                <span>
                  <strong>{definition?.name ?? ingredient.itemId}</strong>
                  <small>
                    {available} / {ingredient.quantity}
                  </small>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="crafting-output-row">
        <span>Output</span>
        <strong>
          {recipe.output.quantity * quantity} {itemDefinition(recipe.output.itemId)?.name ?? recipe.output.itemId}
        </strong>
      </div>

      <div className="crafting-action-row">
        <div className="crafting-quantity-control" aria-label="Craft quantity">
          <TorchButton
            variant="outline"
            size="icon-lg"
            type="button"
            aria-label="Decrease craft quantity"
            data-testid="crafting-quantity-decrease"
            disabled={!canCraft || quantity <= 1}
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
          >
            <Minus aria-hidden="true" />
          </TorchButton>
          <output data-testid="crafting-quantity" aria-label={`Craft quantity ${quantity}`}>
            {quantity}
          </output>
          <TorchButton
            variant="outline"
            size="icon-lg"
            type="button"
            aria-label="Increase craft quantity"
            data-testid="crafting-quantity-increase"
            disabled={!canCraft || quantity >= entry.maxCraftableQuantity}
            onClick={() => onQuantityChange(Math.min(entry.maxCraftableQuantity, quantity + 1))}
          >
            <Plus aria-hidden="true" />
          </TorchButton>
        </div>
        <TorchButton
          variant="default"
          size="lg"
          type="button"
          className="crafting-craft-button"
          data-testid="crafting-craft"
          disabled={!canCraft}
          onClick={onCraft}
        >
          <Hammer aria-hidden="true" />
          Craft {quantity > 1 ? `${quantity} batches` : 'one batch'}
        </TorchButton>
      </div>
    </div>
  );
}

function itemIcon(itemId: string): LucideIcon {
  return craftingIcons[itemDefinition(itemId)?.icon ?? 'package'];
}

function statusForAvailability(entry: RecipeAvailability): string {
  if (entry.craftable) return `Ready · up to ${entry.maxCraftableQuantity}`;
  if (entry.reason === 'locked') return 'Locked';
  if (entry.reason === 'requires-station') return 'Requires a station';
  if (entry.reason === 'unknown-recipe') return 'Unavailable';
  if (entry.reason === 'invalid-quantity') return 'Choose a valid quantity';
  if (entry.missingIngredients.length > 0) {
    return `Missing ${entry.missingIngredients.map((missing) => itemDefinition(missing.itemId)?.name ?? missing.itemId).join(', ')}`;
  }
  return 'Not ready';
}
