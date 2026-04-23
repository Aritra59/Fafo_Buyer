import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * Public buyer reads: ensure Firestore rules allow `list` on `menuGroups` for active docs
 * (e.g. by `sellerId` or public read) so the storefront can subscribe.
 */

const col = () => collection(db, "menuGroups");

/**
 * @typedef {{
 *  id: string,
 *  sellerId?: string,
 *  name?: string,
 *  slug?: string,
 *  productIds?: string[],
 *  active?: boolean,
 *  sortOrder?: number
 * }} MenuGroupDoc
 */

/**
 * Real-time active menu groups for a seller. Sorted client-side by `sortOrder` (and filters `active`).
 * @param {string} sellerId
 * @param {(rows: MenuGroupDoc[]) => void} onData
 * @param {(e: Error) => void} onError
 * @returns {() => void}
 */
export function subscribeMenuGroupsBySeller(sellerId, onData, onError) {
  if (!sellerId) {
    onData([]);
    return () => {};
  }
  const q = query(col(), where("sellerId", "==", String(sellerId).trim()));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => {
          const data = d.data() || {};
          return /** @type {MenuGroupDoc} */ ({
            id: d.id,
            sellerId: data.sellerId,
            name: data.name,
            slug: data.slug,
            productIds: Array.isArray(data.productIds) ? data.productIds : [],
            active: data.active,
            sortOrder: data.sortOrder,
          });
        })
        .filter((g) => g.active !== false);
      list.sort(
        (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
      );
      onData(list);
    },
    (e) => onError(e instanceof Error ? e : new Error(String(e)))
  );
}
