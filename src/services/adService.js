import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

const adsCol = () => collection(db, "ads");

/**
 * Placements used by the buyer app (align with admin when creating ads).
 * - `buyer_explore` — home / explore screen carousel
 */
export const AD_PLACEMENTS = /** @type {const} */ ({
  BUYER_EXPLORE: "buyer_explore",
  /** Global promos on shared shop URL (storefront) */
  BUYER_STOREFRONT: "buyer_storefront",
});

/**
 * @typedef {{ id: string, placement?: string, active?: boolean, title?: string, subtitle?: string, imageUrl?: string, linkUrl?: string, ctaLink?: string, href?: string, sortOrder?: number, background?: string, autoPlay?: boolean }} BuyerAd
 */

/**
 * @param {string} placement
 * @param {(ads: BuyerAd[]) => void} onData
 * @param {(err: Error) => void} onError
 */
export function subscribeAdsByPlacement(placement, onData, onError) {
  if (!placement) {
    onData([]);
    return () => {};
  }
  const q = query(adsCol(), where("placement", "==", placement));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => (/** @type {BuyerAd} */ ({ id: d.id, ...d.data() })))
        .filter((a) => a.active !== false);
      list.sort(
        (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
      );
      onData(list);
    },
    (e) => onError(e instanceof Error ? e : new Error(String(e)))
  );
}
