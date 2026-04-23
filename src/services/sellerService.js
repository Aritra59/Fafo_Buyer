import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";

const sellersCol = () => collection(db, "sellers");

/** @param {string} sellerId */
export async function getSellerById(sellerId) {
  const ref = doc(db, "sellers", sellerId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** @param {string} code */
export async function getSellerByShopCode(code) {
  const raw = String(code || "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  let qy = query(sellersCol(), where("shopCode", "==", upper), limit(1));
  let snap = await getDocs(qy);
  if (snap.empty) {
    qy = query(sellersCol(), where("shopCode", "==", raw), limit(1));
    snap = await getDocs(qy);
  }
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/** @param {string} slug */
export async function getSellerByShopSlug(slug) {
  const s = String(slug || "")
    .trim()
    .toLowerCase();
  if (!s) return null;
  let qy = query(sellersCol(), where("shopSlug", "==", s), limit(1));
  let snap = await getDocs(qy);
  if (snap.empty) {
    qy = query(sellersCol(), where("slug", "==", s), limit(1));
    snap = await getDocs(qy);
  }
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * All sellers — no Firestore query filters (temporary / listing debug).
 * @param {(sellers: import("../types.js").Seller[]) => void} onData
 * @param {(err: Error) => void} onError
 */
export function subscribeAllSellers(onData, onError) {
  return onSnapshot(
    sellersCol(),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(list);
    },
    onError
  );
}

/**
 * Realtime single seller doc (shop image, name, flags).
 * @param {string} sellerId
 * @param {(seller: import("../types.js").Seller | null) => void} onData
 * @param {(err: Error) => void} onError
 */
export function subscribeSellerById(sellerId, onData, onError) {
  if (!sellerId) {
    onData(null);
    return () => {};
  }
  const ref = doc(db, "sellers", sellerId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) onData(null);
      else onData({ id: snap.id, ...snap.data() });
    },
    onError
  );
}
