import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import admin from "firebase-admin";

const rootDir = process.cwd();
const seedPath = path.join(rootDir, "seed.json");

function fail(message) {
  console.error(`[seed-firestore] ${message}`);
  process.exit(1);
}

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  fail("Missing FIREBASE_SERVICE_ACCOUNT_JSON env var.");
}

if (!fs.existsSync(seedPath)) {
  fail("Missing seed.json at project root.");
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} catch {
  fail("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
}

let seed;
try {
  seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
} catch {
  fail("seed.json is not valid JSON.");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function seedUniversities() {
  const universities = seed.universities ?? [];
  for (const uni of universities) {
    const { id, ...data } = uni;
    if (!id) {
      fail("Every university in seed.json must have an id.");
    }
    await db.collection("universities").doc(id).set(data, { merge: true });
    console.log(`[seed-firestore] Seeded university: ${id}`);
  }
}

async function seedUsers() {
  const users = seed.users ?? [];
  for (const user of users) {
    const { id, ...data } = user;
    if (!id) {
      fail("Every user in seed.json must have an id.");
    }
    await db.collection("users").doc(id).set(data, { merge: true });
    console.log(`[seed-firestore] Seeded user: ${id}`);
  }
}

await seedUniversities();
await seedUsers();

console.log("[seed-firestore] Done.");
