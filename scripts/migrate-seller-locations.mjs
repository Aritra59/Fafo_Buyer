/**
 * One-time migration: normalize each seller's `location` to { lat, lng }.
 *
 * Prerequisites:
 * - Service account with Firestore write access to `sellers`
 * - Set env: GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *
 * Run from project root:
 *   npm run migrate:sellers
 */

import { readFileSync, existsSync } from "fs";
import admin from "firebase-admin";
import { normalizeLocation } from "../src/utils/location.js";

function initAdmin() {
  if (admin.apps.length) return;

  const keyPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (keyPath && existsSync(keyPath)) {
    const sa = JSON.parse(readFileSync(keyPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id,
    });
    return;
  }

  try {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "nomad-815ab",
    });
  } catch (e) {
    console.error(
      "Failed to initialize Firebase Admin. Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path."
    );
    console.error(e);
    process.exit(1);
  }
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const snap = await db.collection("sellers").get();

  let updated = 0;
  let skipped = 0;

  const batchSize = 400;
  let batch = db.batch();
  let ops = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const raw = data.location;
    const next = normalizeLocation(raw);

    if (!next) {
      console.warn(`[skip] ${docSnap.id}: invalid or missing location`, raw);
      skipped += 1;
      continue;
    }

    const same =
      raw &&
      typeof raw === "object" &&
      typeof raw.lat === "number" &&
      typeof raw.lng === "number" &&
      raw.lat === next.lat &&
      raw.lng === next.lng;

    if (same) {
      skipped += 1;
      continue;
    }

    batch.update(docSnap.ref, { location: next });
    ops += 1;
    updated += 1;

    if (ops >= batchSize) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  console.log(
    `Done. Updated: ${updated}, unchanged or invalid (skipped): ${skipped}, total docs: ${snap.size}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
