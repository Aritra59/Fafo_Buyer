import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { normalizeLocation } from "../utils/location";

/** @param {string} uid */
export function userDocRef(uid) {
  return doc(db, "users", uid);
}

/**
 * @param {string} uid
 * @param {(data: object | null) => void} onData
 * @param {(err: Error) => void} onError
 */
export function subscribeUser(uid, onData, onError) {
  return onSnapshot(
    userDocRef(uid),
    (snap) => {
      onData(snap.exists() ? snap.data() : null);
    },
    onError
  );
}

/**
 * First-time Google / any sign-in: ensure `users/{uid}` exists with buyer role.
 * @param {import('firebase/auth').User} user
 */
export async function ensureBuyerProfileOnSignIn(user) {
  if (!user?.uid) return;
  const ref = userDocRef(user.uid);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : null;

  const phone =
    user.phoneNumber || String(existing?.phone || "").trim() || "";
  const email = user.email || String(existing?.email || "").trim() || "";
  const display = user.displayName || String(existing?.name || "").trim() || "";

  /** @type {Record<string, unknown>} */
  const data = {
    userId: user.uid,
    updatedAt: serverTimestamp(),
  };
  if (email) data.email = email;
  if (phone) data.phone = phone;
  if (display && !existing?.name) data.name = display;

  if (!existing) {
    data.role = "buyer";
    data.createdAt = serverTimestamp();
    data.name = display || "Buyer";
    data.address = "";
    await setDoc(ref, data, { merge: true });
    return;
  }

  if (existing.role === "seller") {
    await setDoc(
      ref,
      {
        userId: user.uid,
        email: email || existing.email || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  if (!existing.createdAt && !existing.created_at) {
    data.createdAt = serverTimestamp();
  }

  await setDoc(ref, data, { merge: true });
}

/**
 * Canonical guest-linked user doc id derived from normalized phone digits.
 * @param {string} phoneE164
 */
export function guestBuyerDocIdFromPhone(phoneE164) {
  const digits = String(phoneE164 || "").replace(/\D/g, "");
  return digits ? `buyer_guest_${digits}` : "";
}

/**
 * Persist guest checkout identity as `users/{buyer_guest_*}` — role buyer — for CRM / merges.
 * @param {string} phoneE164
 * @param {string} displayName
 */
export async function ensureGuestBuyerUserDoc(phoneE164, displayName) {
  const id = guestBuyerDocIdFromPhone(phoneE164);
  if (!id) return;
  const ref = doc(db, "users", id);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : null;

  /** @type {Record<string, unknown>} */
  const data = {
    userId: id,
    updatedAt: serverTimestamp(),
    phone: String(phoneE164 || "").trim(),
    name: String(displayName || "").trim() || "Guest",
    role: "buyer",
    buyerGuestIdentity: true,
  };

  if (!existing || (!existing.createdAt && !existing.created_at)) {
    data.createdAt = serverTimestamp();
  }

  await setDoc(ref, data, { merge: true });
}

/**
 * At order submission: upsert Firebase-auth buyer row with latest name / phone without touching order payloads.
 * @param {string} uid
 * @param {{ name: string, phone: string }} checkout
 */
export async function ensureBuyerProfileAtOrder(uid, checkout) {
  const u = String(uid || "").trim();
  if (!u) return;

  const name = String(checkout?.name || "").trim() || "Buyer";
  const phone = String(checkout?.phone || "").trim();

  const ref = userDocRef(u);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : null;

  if (existing?.role === "seller") return;

  /** @type {Record<string, unknown>} */
  const data = {
    userId: u,
    name,
    updatedAt: serverTimestamp(),
    role: "buyer",
  };
  if (phone) data.phone = phone;

  if (!existing) {
    data.createdAt = serverTimestamp();
    await setDoc(ref, data, { merge: true });
    return;
  }

  if (!existing.createdAt && !existing.created_at) {
    data.createdAt = serverTimestamp();
  }

  await setDoc(ref, data, { merge: true });
}

/**
 * Buyer app: upsert profile with role "buyer", unless existing user is a seller.
 * @param {string} uid
 * @param {{
 *   phone: string,
 *   name: string,
 *   address: string,
 *   location: { lat: number, lng: number },
 *   email?: string,
 * }} payload
 */
export async function saveUserProfile(uid, payload) {
  const ref = userDocRef(uid);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : null;

  const loc = normalizeLocation(payload.location);
  if (!loc) {
    throw new Error("Invalid location: expected { lat, lng }.");
  }

  /** @type {Record<string, unknown>} */
  const data = {
    userId: uid,
    phone: payload.phone,
    name: payload.name,
    address: payload.address,
    location: { lat: loc.lat, lng: loc.lng },
    savedLocation: { lat: loc.lat, lng: loc.lng },
    updatedAt: serverTimestamp(),
  };

  if (payload.email != null && String(payload.email).trim()) {
    data.email = String(payload.email).trim();
  }

  if (!existing) {
    data.role = "buyer";
    data.createdAt = serverTimestamp();
  } else if (existing.role !== "seller") {
    data.role = "buyer";
  }

  await setDoc(ref, data, { merge: true });
}

/** @param {object | null} data */
export function isProfileComplete(data) {
  if (!data) return false;
  const name = String(data.name || "").trim();
  const address = String(data.address || "").trim();
  const loc = normalizeLocation(data.location);
  return name.length > 0 && address.length > 0 && loc !== null;
}
