"use client";

function getCloudNameOrThrow() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    throw new Error("Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME in .env.local.");
  }
  return cloudName;
}

async function getCloudinarySignature(folder: string) {
  const response = await fetch("/api/cloudinary/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to get Cloudinary signature.");
  }

  return response.json() as Promise<{
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
  }>;
}

export async function uploadDocumentImage(
  documentId: string,
  userId: string,
  file: File,
): Promise<string> {
  const cloudName = getCloudNameOrThrow();
  const folder = `coresearch/documents/${documentId}/images/${userId}`;
  const { apiKey, timestamp, signature } = await getCloudinarySignature(folder);

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);

  const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  const payload = await uploadResponse.json() as { secure_url?: string; error?: { message?: string } };
  if (!uploadResponse.ok || !payload.secure_url) {
    throw new Error(payload.error?.message ?? "Cloudinary upload failed.");
  }
  return payload.secure_url;
}

export async function uploadDocumentCover(
  documentId: string,
  userId: string,
  file: File,
): Promise<string> {
  const cloudName = getCloudNameOrThrow();
  const folder = `coresearch/documents/${documentId}/cover/${userId}`;
  const { apiKey, timestamp, signature } = await getCloudinarySignature(folder);

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);

  const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  const payload = await uploadResponse.json() as { secure_url?: string; error?: { message?: string } };
  if (!uploadResponse.ok || !payload.secure_url) {
    throw new Error(payload.error?.message ?? "Cloudinary cover upload failed.");
  }
  return payload.secure_url;
}

export async function uploadChatImage(
  userId: string,
  file: File,
): Promise<string> {
  const cloudName = getCloudNameOrThrow();
  const folder = `coresearch/chat/${userId}`;
  const { apiKey, timestamp, signature } = await getCloudinarySignature(folder);

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);

  const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  const payload = await uploadResponse.json() as { secure_url?: string; error?: { message?: string } };
  if (!uploadResponse.ok || !payload.secure_url) {
    throw new Error(payload.error?.message ?? "Chat image upload failed.");
  }
  return payload.secure_url;
}

export function isFirebaseStorageUrl(url: string): boolean {
  return (
    url.startsWith("gs://") ||
    url.includes("firebasestorage.googleapis.com") ||
    url.includes("storage.googleapis.com")
  );
}

export async function deleteDocumentImageByUrl(url: string): Promise<void> {
  if (!isFirebaseStorageUrl(url)) {
    return;
  }
  // Kept for backward compatibility with older Firebase Storage URLs.
}
