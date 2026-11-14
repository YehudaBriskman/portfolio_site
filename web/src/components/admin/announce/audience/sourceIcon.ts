import { FileUp, Globe, UserPen, type LucideIcon } from "lucide-react";
import type { ContactSource } from "@/services/adminAudience";

/* Where a contact came from, as the leading icon of its row (the word is in the sheet's consent record). */
export const SOURCE_ICON: Record<ContactSource, LucideIcon> = { site: Globe, manual: UserPen, import: FileUp };
