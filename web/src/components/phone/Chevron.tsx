import { ChevronRight } from "lucide-react";
import "@/components/phone/tokens.css";
import styles from "@/components/phone/phone.module.css";

/** The row's trailing chevron: phone only, 18px, mirrored in Hebrew (R9). Hidden above 640px. */
export default function Chevron() {
  return <ChevronRight className={styles.chevron} data-phone-chevron="" aria-hidden="true" focusable="false" />;
}
