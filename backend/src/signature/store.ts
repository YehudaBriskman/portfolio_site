import { CouchError, couch } from "../db/couch.js";
import { DEFAULT_SHOW, SHOW_ID, ShowBody, slotId, type SigLang, type SigShow, type SigShowDoc, type SigSlotDoc } from "./schemas.js";

export async function tryGet<T>(id: string): Promise<T | null> {
  try {
    return await couch.get<T>(id);
  } catch (e) {
    if (e instanceof CouchError && e.status === 404) return null;
    throw e;
  }
}
export const getSlot = (lang: SigLang) => tryGet<SigSlotDoc>(slotId(lang));
export const getShow = async (): Promise<SigShow> => {
  const d = await tryGet<SigShowDoc>(SHOW_ID);
  const p = d ? ShowBody.safeParse({ show: d.show }) : null;
  return p?.success ? p.data.show : DEFAULT_SHOW;
};
