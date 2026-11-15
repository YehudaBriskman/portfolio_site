import { StatusGlyph, type StatusKind } from "@/components/ui/StatusGlyph";
import { useAdminWords } from "@/i18n/admin";
import type { TranslationStatus } from "@/services/translations";
import { CODE } from "./words";
import styles from "./posts.module.css";

const KIND: Record<TranslationStatus, StatusKind> = { missing: "missing", stale: "stale", draft: "draft", unverified: "unverified", translated: "translated" };

/* The Hebrew half of the language pair on its own: HE and one glyph for its state, always left to right. */
export default function HeGlyph({ status }: { status: TranslationStatus | null | undefined }) {
  const w = useAdminWords();
  const s = status ?? "translated";
  return (
    <span className={styles.lang} dir="ltr" role="img" aria-label={`${w.areaHebrew}: ${w.heLong[s]}`} title={w.heLong[s]}>
      {CODE.he}
      <StatusGlyph kind={KIND[s]} size={16} showDefault label={w.heLong[s]} />
    </span>
  );
}
