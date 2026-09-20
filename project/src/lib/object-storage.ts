import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

/**
 * docs/15-INFRASTRUCTURE-SPEC.md §1 Object Storage.
 *
 * Provider-agnostic lewat AWS SDK v3 (kompatibel S3 untuk MinIO, R2, dsb —
 * bukan mengasumsikan AWS S3 asli, sesuai aturan #4/#5 "provider-agnostic").
 * Database HANYA menyimpan object_key, tidak pernah binary file (docs/04-ERD.md).
 */

function getClient(): S3Client {
  // env.OBJECT_STORAGE_* sudah divalidasi (wajib ada) oleh src/lib/env.ts
  // saat aplikasi start.
  return new S3Client({
    endpoint: env.OBJECT_STORAGE_ENDPOINT,
    region: env.OBJECT_STORAGE_REGION,
    credentials: {
      accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY,
      secretAccessKey: env.OBJECT_STORAGE_SECRET_KEY,
    },
    forcePathStyle: true, // dibutuhkan untuk kompatibilitas MinIO/self-hosted
  });
}

export const Buckets = {
  photos: env.OBJECT_STORAGE_BUCKET_PHOTOS,
  reports: env.OBJECT_STORAGE_BUCKET_REPORTS,
  // Bucket TERPISAH khusus enrolment sementara — sengaja dipisah dari bucket
  // foto tampilan siswa, sesuai docs/06-SECURITY-SPEC.md §Biometric Security:
  // "Bucket sementara untuk upload enrolment terpisah dari bucket foto
  // tampilan siswa".
  enrollmentTemp: env.OBJECT_STORAGE_BUCKET_ENROLLMENT_TEMP,
};

export async function uploadObject(
  bucket: string,
  objectKey: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    })
  );
}

/**
 * Ambil isi object sebagai Buffer. Dipakai worker enrolment untuk membaca
 * kembali foto softfile yang di-upload sementara sebelum diproses menjadi
 * embedding — lihat worker/processors/face-enrollment.ts.
 */
export async function getObject(bucket: string, objectKey: string): Promise<Buffer> {
  const client = getClient();
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));

  if (!response.Body) {
    throw new Error(`Object ${bucket}/${objectKey} tidak memiliki body (kosong atau tidak ada).`);
  }

  const chunks: Uint8Array[] = [];
  // response.Body dari AWS SDK v3 di runtime Node adalah Readable stream.
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Hapus permanen satu object. Dipakai untuk foto enrolment yang WAJIB
 * dihapus segera setelah embedding dibuat — baik proses berhasil maupun
 * gagal (FR-ENROLL-005, NFR-SEC-004). Fungsi ini TIDAK melempar error kalau
 * object sudah tidak ada (idempotent by design — retry job enrolment yang
 * mengulang penghapusan tidak boleh membuat job gagal).
 */
export async function deleteObject(bucket: string, objectKey: string): Promise<void> {
  const client = getClient();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
  } catch (err) {
    console.error({ msg: "object_delete_failed", bucket, objectKey, error: err });
    // Dilempar ulang SENGAJA — penghapusan foto enrolment adalah kewajiban
    // keamanan (bukan best-effort), pemanggil (worker face-enrollment) harus
    // tahu jika ini gagal supaya bisa di-retry/di-alert, bukan diam-diam
    // dianggap sukses.
    throw err;
  }
}

export async function getPresignedDownloadUrl(
  bucket: string,
  objectKey: string,
  expiresInSeconds = 3600
): Promise<string> {
  const client = getClient();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), {
    expiresIn: expiresInSeconds,
  });
}

export async function getPresignedUploadUrl(
  bucket: string,
  objectKey: string,
  contentType: string,
  expiresInSeconds = 900
): Promise<string> {
  const client = getClient();
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: contentType }),
    { expiresIn: expiresInSeconds }
  );
}
