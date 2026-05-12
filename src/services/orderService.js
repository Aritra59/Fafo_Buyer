import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";

const ordersCol = () => collection(db, "orders");
const orderDoc = (id) => doc(db, "orders", id);
const dailyOrderCounterDoc = (dateKey) => doc(db, "orderCounters", dateKey);

function localDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function nextFormattedOrderId() {
  const dateKey = localDateKey();
  const counterRef = dailyOrderCounterDoc(dateKey);
  const nextSeq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const prev = snap.exists() ? Number(snap.data()?.lastSequence || 0) : 0;
    const next = Number.isFinite(prev) && prev >= 0 ? prev + 1 : 1;
    tx.set(
      counterRef,
      {
        dateKey,
        lastSequence: next,
        updatedAtMs: Date.now(),
      },
      { merge: true }
    );
    return next;
  });
  return `FF-ORD-${dateKey}-${String(nextSeq).padStart(5, "0")}`;
}

/**
 * @param {{ buyerId?: string, buyerPhone?: string }} keys
 * @param {(orders: { id: string }[]) => void} onData
 * @param {(err: Error) => void} onError
 */
export function subscribeBuyerOrders(keys, onData, onError) {
  const buyerId = String(keys.buyerId || "").trim();
  const buyerPhone = String(keys.buyerPhone || "").trim();

  if (!buyerId && !buyerPhone) {
    onData([]);
    return () => {};
  }

  /** @type {Map<string, { id: string } & Record<string, unknown>>} */
  const byBuyerId = new Map();
  /** @type {Map<string, { id: string } & Record<string, unknown>>} */
  const byPhone = new Map();

  function emit() {
    const merged = new Map();
    byBuyerId.forEach((v, k) => merged.set(k, v));
    byPhone.forEach((v, k) => merged.set(k, v));
    const list = Array.from(merged.values()).sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    onData(list);
  }

  const unsubs = [];
  if (buyerId) {
    unsubs.push(
      onSnapshot(
        query(ordersCol(), where("buyerId", "==", buyerId)),
        (snap) => {
          byBuyerId.clear();
          snap.docs.forEach((d) => {
            byBuyerId.set(d.id, { id: d.id, ...d.data() });
          });
          emit();
        },
        (err) => onError(err instanceof Error ? err : new Error(String(err)))
      )
    );
  }
  if (buyerPhone) {
    unsubs.push(
      onSnapshot(
        query(ordersCol(), where("buyerPhone", "==", buyerPhone)),
        (snap) => {
          byPhone.clear();
          snap.docs.forEach((d) => {
            byPhone.set(d.id, { id: d.id, ...d.data() });
          });
          emit();
        },
        (err) => onError(err instanceof Error ? err : new Error(String(err)))
      )
    );
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}

/**
 * @param {string} orderId
 * @param {(o: (Record<string, unknown> & { id: string }) | null) => void} onData
 * @param {(err: Error) => void} onError
 */
export function subscribeOrderById(orderId, onData, onError) {
  if (!orderId) {
    onData(null);
    return () => {};
  }
  return onSnapshot(
    orderDoc(orderId),
    (snap) => {
      if (!snap.exists()) onData(null);
      else onData({ id: snap.id, ...snap.data() });
    },
    (e) => onError(e instanceof Error ? e : new Error(String(e)))
  );
}

/**
 * @param {{
 *   sellerId: string,
 *   buyerId?: string,
 *   buyerPhone: string,
 *   buyerName?: string,
 *   buyerAddress?: string,
 *   buyerLandmark?: string,
 *   sellerPhone?: string,
 *   items: Record<string, unknown>[],
 *   total: number,
 *   subtotal?: number,
 *   savings?: number,
 *   paymentMode: string,
 *   source?: string,
 *   sellerName?: string,
 *   buyerGuest?: boolean,
 * }} payload
 * @returns {Promise<{ id: string, orderId: string }>} new order identifiers
 */
export async function createOrder(payload) {
  const formattedOrderId = await nextFormattedOrderId();
  const ts = serverTimestamp();
  const ref = await addDoc(ordersCol(), {
    sellerId: payload.sellerId,
    sellerName: String(payload.sellerName || "").trim(),
    buyerId: payload.buyerId || "",
    buyerPhone: payload.buyerPhone,
    buyerName: payload.buyerName || "",
    buyerAddress: payload.buyerAddress || "",
    buyerLandmark: String(payload.buyerLandmark || "").trim(),
    buyerGuest: payload.buyerGuest === true,
    sellerPhone: payload.sellerPhone || "",
    items: payload.items,
    total: payload.total,
    subtotal:
      payload.subtotal != null ? payload.subtotal : payload.total,
    savings: payload.savings != null ? payload.savings : 0,
    paymentMode: payload.paymentMode,
    source: String(payload.source || "app").trim() || "app",
    status: "new",
    orderId: formattedOrderId,
    createdAt: ts,
    updatedAt: ts,
  });
  await updateDoc(ref, { orderId: formattedOrderId });
  return { id: ref.id, orderId: formattedOrderId };
}

/**
 * Latest order for a guest (phone), sorted client-side by `createdAt`.
 * @param {string} phone E.164 or local digits — normalized in caller
 * @returns {Promise<({ id: string } & Record<string, unknown>) | null>}
 */
export async function fetchLatestOrderByPhone(phone) {
  const p = String(phone || "").trim();
  if (!p) return null;
  const snap = await getDocs(
    query(ordersCol(), where("buyerPhone", "==", p))
  );
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? 0;
    const tb = b.createdAt?.toMillis?.() ?? 0;
    return tb - ta;
  });
  return list[0] || null;
}
