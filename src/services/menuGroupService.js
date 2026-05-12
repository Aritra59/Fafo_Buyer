import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { BUYER_MENU_GROUP_SEQUENCE_KEYS, compareBySequenceAndCreatedAt } from "../utils/menuAssignment";

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
 *  comboIds?: string[],
 *  items?: unknown[],
 *  active?: boolean,
 *  sequence?: number,
 *  sortOrder?: number,
 *  createdAt?: unknown,
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
  const sid = String(sellerId || "").trim();
  const q = query(col(), where("sellerId", "==", sid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => {
          const data = d.data() || {};
          const comboRaw = data.comboIds ?? data.combo_ids ?? data.comboIDList;
          const itemsRaw = data.items ?? data.menuItems ?? data.products;
          const seq = data.sequence;
          const seqNum = seq != null && Number.isFinite(Number(seq)) ? Number(seq) : undefined;
          return /** @type {MenuGroupDoc} */ ({
            id: d.id,
            sellerId: data.sellerId,
            name: data.name,
            slug: data.slug,
            productIds: Array.isArray(data.productIds) ? data.productIds : [],
            comboIds: Array.isArray(comboRaw) ? comboRaw.map((x) => String(x)) : [],
            items: Array.isArray(itemsRaw) ? itemsRaw : [],
            active: data.active,
            sortOrder: data.sortOrder,
            ...(seqNum != null ? { sequence: seqNum } : {}),
            createdAt: data.createdAt ?? data.created_at,
          });
        })
        .filter((g) => g.active !== false);
      list.sort((a, b) =>
        compareBySequenceAndCreatedAt(
          /** @type {Record<string, unknown>} */ (a),
          /** @type {Record<string, unknown>} */ (b),
          BUYER_MENU_GROUP_SEQUENCE_KEYS
        )
      );
      onData(list);
    },
    (e) => onError(e instanceof Error ? e : new Error(String(e)))
  );
}
