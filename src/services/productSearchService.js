import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

const productsCol = () => collection(db, "products");

/**
 * Client-side name filter over products for nearby seller ids (max 10 per query).
 * @param {string[]} sellerIds
 * @param {string} q
 * @param {number} [cap]
 */
export async function searchProductsBySellerIds(sellerIds, q, cap = 36) {
  const needle = String(q || "").trim().toLowerCase();
  if (!needle || sellerIds.length === 0) return [];

  const out = [];
  for (let i = 0; i < sellerIds.length; i += 10) {
    const batch = sellerIds.slice(i, i + 10);
    const snap = await getDocs(
      query(productsCol(), where("sellerId", "in", batch), limit(80))
    );
    snap.docs.forEach((d) => {
      const data = d.data();
      const name = String(data.name || "").toLowerCase();
      if (name.includes(needle)) {
        out.push({ id: d.id, ...data });
      }
    });
  }
  return out.slice(0, cap);
}
