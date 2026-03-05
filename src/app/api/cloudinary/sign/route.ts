import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

export async function POST(req: Request) {
  try {
    const cloudName = requiredEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
    const apiKey = requiredEnv("CLOUDINARY_API_KEY");
    const apiSecret = requiredEnv("CLOUDINARY_API_SECRET");
    const body = (await req.json().catch(() => ({}))) as { folder?: string };
    const folder = body.folder?.trim() || "coresearch/documents/misc";
    const timestamp = Math.floor(Date.now() / 1000);

    const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = createHash("sha1").update(toSign).digest("hex");

    return NextResponse.json({
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sign Cloudinary upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
