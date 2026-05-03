import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

/** Firestore path: `terms/buyer` */
const buyerTermsRef = () => doc(db, "terms", "buyer");

/**
 * @returns {Promise<{ title: string, text: string, html: string | null }>}
 */
export async function fetchBuyerTerms() {
  const snap = await getDoc(buyerTermsRef());
  if (!snap.exists()) {
    return { title: "Buyer terms", text: "", html: null };
  }
  const d = snap.data() || {};
  const title = String(d.title ?? "Buyer terms").trim() || "Buyer terms";
  const text = String(d.text ?? d.body ?? d.content ?? d.plainText ?? "").trim();
  const html =
    typeof d.html === "string" && d.html.trim() ? String(d.html).trim() : null;
  return { title, text, html };
}
