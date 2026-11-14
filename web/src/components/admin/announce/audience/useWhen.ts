import { useLang } from "@/components/dashboard/i18n";
import { formatWhen } from "@/lib/safeTime";

export function useWhen() {
  const lang = useLang();
  return (iso?: string) => formatWhen(iso, lang, { dateStyle: "medium" });
}
