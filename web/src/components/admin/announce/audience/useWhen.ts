import { useLang } from "@/components/dashboard/i18n";

export function useWhen() {
  const lang = useLang();
  return (iso?: string) => (iso ? new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", { dateStyle: "medium" }).format(new Date(iso)) : "");
}
