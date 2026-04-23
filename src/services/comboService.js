import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

const combosCol = () => collection(db, "combos");

/**
 * @param {string} sellerId
 * @param {(combos: { id: string }[]) => void} onData
 * @param {(err: Error) => void} onError
 */
export function subscribeCombosBySeller(sellerId, onData, onError) {
  if (!sellerId) {
    onData([]);
    return () => {};
  }
  const q = query(combosCol(), where("sellerId", "==", sellerId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(list);
    },
    onError
  );
}
