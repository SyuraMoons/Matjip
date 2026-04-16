import { PinataSDK } from "pinata";
import sharp from "sharp";

export type CleanedImage = {
  buffer: Buffer;
  fileName: string;
  contentType: "image/jpeg";
};

function getPinata() {
  const jwt = process.env.PINATA_JWT;

  if (!jwt) {
    throw new Error("PINATA_JWT is not configured");
  }

  return new PinataSDK({
    pinataJwt: jwt,
    pinataGateway: process.env.NEXT_PUBLIC_GATEWAY_URL,
  });
}

function safeFileStem(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, "");
  return stem.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60) || "memory";
}

export async function cleanImageForUpload(file: File): Promise<CleanedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name || "File"} is not an image`);
  }

  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  const cleaned = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  return {
    buffer: cleaned,
    fileName: `${safeFileStem(file.name)}.jpg`,
    contentType: "image/jpeg",
  };
}

export async function pinFile(image: CleanedImage) {
  const arrayBuffer = image.buffer.buffer.slice(
    image.buffer.byteOffset,
    image.buffer.byteOffset + image.buffer.byteLength
  ) as ArrayBuffer;
  const file = new File([arrayBuffer], image.fileName, {
    type: image.contentType,
  });
  const result = await getPinata().upload.public.file(file).name(image.fileName);

  return `ipfs://${result.cid}`;
}

export async function pinJson(body: unknown, name: string) {
  if (!body || typeof body !== "object") {
    throw new Error("Pinata JSON upload requires an object body");
  }

  const result = await getPinata().upload.public.json(body).name(name);

  return `ipfs://${result.cid}`;
}
