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
