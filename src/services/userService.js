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
