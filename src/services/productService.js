import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

const productsCol = () => collection(db, "products");

/**
 * @param {string} sellerId
 * @param {(products: import("../types.js").Product[]) => void} onData
 * @param {(err: Error) => void} onError
 */
export function subscribeProductsBySeller(sellerId, onData, onError) {
  const q = query(productsCol(), where("sellerId", "==", sellerId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(list);
    },
    onError
  );
}
