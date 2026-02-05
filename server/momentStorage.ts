import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { encode } from 'blurhash';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export interface StoredImage {
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  blurhash?: string;
}

function getExtFromMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return { mime, buffer };
}

function getR2Config() {
  const endpoint = String(process.env.CLOUDFLARE_R2_ENDPOINT ?? '').trim();
  const accessKeyId = String(process.env.CLOUDFLARE_R2_ACCESS_KEY ?? '').trim();
  const secretAccessKey = String(process.env.CLOUDFLARE_R2_SECRET_KEY ?? '').trim();
  const bucket = String(process.env.CLOUDFLARE_R2_BUCKET ?? '').trim();
  const publicBase = String(process.env.CLOUDFLARE_R2_PUBLIC_BASE ?? '').trim();
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { endpoint, accessKeyId, secretAccessKey, bucket, publicBase };
}

function buildKey(prefix = 'moments', ext = 'jpg') {
  const rand = crypto.randomBytes(6).toString('hex');
  return `${prefix}/${Date.now()}_${rand}.${ext}`;
}

export async function storeMomentImage(input: string): Promise<StoredImage> {
  if (!input) throw new Error('missing image');
  if (input.startsWith('http')) {
    return { url: input };
  }

  const parsed = parseDataUrl(input);
  if (!parsed) {
    return { url: input };
  }

  const maxBytes = Number(process.env.NF_MOMENTS_MAX_BYTES ?? 4_000_000);
  if (parsed.buffer.length > maxBytes) {
    throw new Error('image_too_large');
  }

  const r2 = getR2Config();
  const ext = getExtFromMime(parsed.mime);
  const key = buildKey('moments', ext);
  const thumbKey = buildKey('moments/thumb', ext);

  const image = sharp(parsed.buffer).rotate();
  const meta = await image.metadata();
  const width = meta.width ?? undefined;
  const height = meta.height ?? undefined;

  const fullBuffer = await image
    .resize({ width: 1920, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  const thumbBuffer = await image
    .resize({ width: 512, withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();

  const raw = await sharp(thumbBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const blurhash = encode(raw.data, raw.info.width, raw.info.height, 4, 4);

  if (r2) {
    const client = new S3Client({
      region: 'auto',
      endpoint: r2.endpoint,
      credentials: {
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey
      },
      forcePathStyle: true
    });

    await client.send(new PutObjectCommand({
      Bucket: r2.bucket,
      Key: key,
      Body: fullBuffer,
      ContentType: 'image/jpeg'
    }));
    await client.send(new PutObjectCommand({
      Bucket: r2.bucket,
      Key: thumbKey,
      Body: thumbBuffer,
      ContentType: 'image/jpeg'
    }));

    const base = r2.publicBase || `${r2.endpoint.replace(/\/$/, '')}/${r2.bucket}`;
    return {
      url: `${base.replace(/\/$/, '')}/${key}`,
      thumbnail_url: `${base.replace(/\/$/, '')}/${thumbKey}`,
      width,
      height,
      blurhash
    };
  }

  const uploadDir = path.resolve(process.cwd(), 'server', 'uploads', 'moments');
  const thumbDir = path.resolve(process.cwd(), 'server', 'uploads', 'moments', 'thumb');
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(thumbDir, { recursive: true });
  const filePath = path.join(uploadDir, key.replace('moments/', ''));
  const thumbPath = path.join(thumbDir, thumbKey.replace('moments/thumb/', ''));
  fs.writeFileSync(filePath, fullBuffer);
  fs.writeFileSync(thumbPath, thumbBuffer);
  return {
    url: `/uploads/moments/${path.basename(filePath)}`,
    thumbnail_url: `/uploads/moments/thumb/${path.basename(thumbPath)}`,
    width,
    height,
    blurhash
  };
}
