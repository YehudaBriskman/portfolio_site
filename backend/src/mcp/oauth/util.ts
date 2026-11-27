import { couch, CouchError } from "../../db/couch.js";

export async function tryGet<T>(id: string): Promise<T | null> {
  try {
    return await couch.get<T>(id);
  } catch (e) {
    if (e instanceof CouchError && e.status === 404) return null;
    throw e;
  }
}

export { safeEqual } from "../../services/safeEqual.js";
