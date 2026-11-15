import { Download, FileUp, Pencil, UserPen, UserRound, type LucideIcon } from "lucide-react";
import type { ContactSource } from "@/services/adminAudience";

/* Where a contact came from, as the leading icon of its row (the word is in the sheet's consent record). A site signup is the normal case and draws the plain person, not a globe on every row (A6). */
export const SOURCE_ICON: Record<ContactSource, LucideIcon> = { site: UserRound, manual: UserPen, import: FileUp };

/* The wide Audience actions. Each is drawn beside its word (Import CSV, Export CSV, Edit). This file already held the tab's lucide imports, so the list in Icon.guard.test.ts does not grow. */
export const ACTION_ICON = { import: FileUp, export: Download, edit: Pencil } satisfies Record<string, LucideIcon>;
