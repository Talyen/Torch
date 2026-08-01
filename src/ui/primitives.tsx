import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../lib/utils';
import { Select as SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button as ButtonPrimitive } from '../components/ui/button';

/**
 * Torch's behavior primitive boundary.
 *
 * Base UI owns the difficult interaction contracts (focus management,
 * keyboard navigation, dismissal, and ARIA wiring). Screens import these
 * names instead of importing the vendor package directly so the visual and
 * component API remains Torch-owned.
 */
export { Dialog as TorchDialog } from '@base-ui/react/dialog';
export { Button as TorchButton } from '../components/ui/button';

export {
  DropdownMenu as TorchMenuRoot,
  DropdownMenuContent as TorchMenuContent,
  DropdownMenuRadioGroup as TorchMenuRadioGroup,
  DropdownMenuRadioItem as TorchMenuRadioItem,
  DropdownMenuTrigger as TorchMenuTrigger,
} from '../components/ui/dropdown-menu';

export { Popover as TorchPopover } from '@base-ui/react/popover';

export {
  Select as TorchSelectRoot,
  SelectContent as TorchSelectContent,
  SelectItem as TorchSelectItem,
  SelectTrigger as TorchSelectTrigger,
  SelectValue as TorchSelectValue,
} from '../components/ui/select';

export {
  Tabs as TorchTabsRoot,
  TabsList as TorchTabsList,
  TabsContent as TorchTabsContent,
  TabsTrigger as TorchTabsTab,
} from '../components/ui/tabs';

export type TorchSelectOption = {
  value: string;
  label: string;
};

export type TorchSelectFieldProps = {
  value: string;
  options: readonly TorchSelectOption[];
  onValueChange: (value: string) => void;
  ariaLabel: string;
  testId?: string;
  className?: string;
};

/** A Torch-owned select composition with one canonical trigger/content contract. */
export function TorchSelectField({
  value,
  options,
  onValueChange,
  ariaLabel,
  testId,
  className,
}: TorchSelectFieldProps): ReactNode {
  return (
    <SelectRoot value={value} onValueChange={(nextValue) => onValueChange(nextValue ?? value)}>
      <SelectTrigger
        className={cn('torch-select-field-trigger', className)}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        <SelectValue>{options.find((option) => option.value === value)?.label ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent className="torch-select-field-content">
        {options.map((option) => (
          <SelectItem className="torch-select-field-option" value={option.value} key={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}

export type TorchIconButtonProps = Omit<ComponentProps<typeof ButtonPrimitive>, 'aria-label' | 'children'> & {
  label: string;
  children: ReactNode;
};

/** Icon-only controls keep their accessible name at the shared boundary. */
export function TorchIconButton({ label, children, className, ...props }: TorchIconButtonProps): ReactNode {
  return (
    <ButtonPrimitive
      {...props}
      className={cn('torch-icon-button', className)}
      variant="ghost"
      size="icon-lg"
      aria-label={label}
      title={label}
    >
      {children}
    </ButtonPrimitive>
  );
}

export type TorchArtworkCardProps = {
  artSrc?: string;
  artAlt?: string;
  eyebrow: string;
  title: string;
  ariaLabel: string;
  onClick: () => void;
  selected?: boolean;
  className?: string;
  testId?: string;
};

/** Shared 3:4 authored-art card used by collection and ability summaries. */
export function TorchArtworkCard({
  artSrc,
  artAlt,
  eyebrow,
  title,
  ariaLabel,
  onClick,
  selected = false,
  className,
  testId,
}: TorchArtworkCardProps): ReactNode {
  return (
    <ButtonPrimitive
      type="button"
      variant="ghost"
      className={cn('torch-artwork-card', selected && 'is-selected', className)}
      aria-label={ariaLabel}
      aria-pressed={selected}
      data-selected={selected ? 'true' : undefined}
      data-testid={testId}
      onClick={onClick}
    >
      <span className="torch-artwork-card-art">
        {artSrc ? <img src={artSrc} alt={artAlt ?? ''} /> : <span className="torch-artwork-card-empty">+</span>}
      </span>
      <span className="torch-artwork-card-copy">
        <small>{eyebrow}</small>
        <strong>{title}</strong>
      </span>
    </ButtonPrimitive>
  );
}
