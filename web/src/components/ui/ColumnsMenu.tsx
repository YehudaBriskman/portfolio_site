import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/IconButton";
import { ICON } from "@/components/ui/icons";

/*
 * Show or hide columns (principle 9): one icon button, a menu of checkbox items,
 * "Show all" last. It is a view choice, separate from filtering, and the
 * caller saves it (`useTablePrefs`). The identifier column is never offered:
 * a row with no name is not a row. Items keep the menu open so several columns
 * change in one visit. Words are the caller's.
 */

export interface ColumnsMenuItem {
  id: string;
  header: string;
}

export interface ColumnsMenuProps {
  /** Names the button and the menu: "Columns". */
  label: string;
  showAll: string;
  columns: ColumnsMenuItem[];
  hidden: string[];
  onChange: (hidden: string[]) => void;
}

export function ColumnsMenu({ label, showAll, columns, hidden, onChange }: ColumnsMenuProps) {
  if (columns.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton icon={ICON.columns} label={label} size="sm" badge={hidden.length > 0 ? hidden.length : undefined} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label={label}>
        {columns.map((c) => {
          const shown = !hidden.includes(c.id);
          return (
            <DropdownMenuCheckboxItem
              key={c.id}
              checked={shown}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(on) => onChange(on ? hidden.filter((h) => h !== c.id) : [...hidden, c.id])}
            >
              {c.header}
            </DropdownMenuCheckboxItem>
          );
        })}
        {hidden.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange([])}>{showAll}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
