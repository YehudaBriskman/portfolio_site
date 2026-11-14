import AudienceDesktop from "./AudienceDesktop";
import AudiencePhone from "./AudiencePhone";
import { usePhone } from "./usePhone";

/* The Audience tab: a table from 600px, rows and sheets below it. Both read and write through the same service. */
export default function AudienceTab() {
  return usePhone() ? <AudiencePhone /> : <AudienceDesktop />;
}
