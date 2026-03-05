import { NextResponse } from "next/server";

function has(name: string) {
  return Boolean(process.env[name]);
}

function safeValue(name: string) {
  const value = process.env[name];
  if (!value) return null;
  if (name === "NEXT_PUBLIC_FIREBASE_PROJECT_ID") return value;
  if (name === "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") return value;
  return `${value.slice(0, 4)}...`;
}

export async function GET() {
  const keys = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
    "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ] as const;

  const report = keys.reduce<Record<string, { present: boolean; sample: string | null }>>(
    (acc, key) => {
      acc[key] = { present: has(key), sample: safeValue(key) };
      return acc;
    },
    {},
  );

  return NextResponse.json(
    {
      ok: true,
      environment: process.env.VERCEL_ENV ?? "unknown",
      report,
    },
    { status: 200 },
  );
}

