import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton, type ControlIcon, type ControlSize, type ShowLabel } from "@/components/ui/IconButton";
import styles from "@/components/ui/ControlBar.module.css";

/*
 * The "+" button: one named control that opens a menu of the things that can
 * be made. Icon, button name and every item's words are the caller's props.
 * Primary by default, because a create button is the one loud action of a bar.
 */

export interface CreateMenuItem {
  id: string;
  label: string;
  icon?: ControlIcon;
  disabled?: boolean;
  onSelect: () => void;
}

export interface CreateMenuProps {
  icon: ControlIcon;
  label: string;
  items: CreateMenuItem[];
  showLabel?: ShowLabel;
  size?: ControlSize;
  align?: "start" | "center" | "end";
}

export function CreateMenu({ icon, label, items, showLabel = "never", size = "md", align = "end" }: CreateMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton icon={icon} label={label} tone="primary" size={size} showLabel={showLabel} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {items.map((it) => (
          <DropdownMenuItem key={it.id} disabled={it.disabled} onSelect={() => it.onSelect()}>
            {it.icon && <it.icon className={styles.menuIcon} aria-hidden="true" />}
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
