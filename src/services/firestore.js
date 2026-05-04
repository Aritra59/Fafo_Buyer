import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

export const getSellerBySlug = async (slug) => {
  const normalized = String(slug || "").trim().toLowerCase();
  if (!normalized) return null;

  const q = query(
    collection(db, "sellers"),
    where("shopSlug", "==", normalized),
    limit(1)
  );

  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};
