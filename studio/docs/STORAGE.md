# Aurrin Platform — Storage Guide

This document describes how file uploads, signed URLs, retention, and storage RLS policies work in the Aurrin platform.

---

## Architecture Overview

Files are stored in **Supabase Storage** across four private buckets. All access is via signed URLs with expiration — no direct public links. Metadata for every file is stored in the `files` PostgreSQL table.

```
Browser / Server
    │
    ▼
POST /api/upload  (multipart/form-data)
    │
    ├─► uploadFile()  ──► Supabase Storage bucket
    │                       pitch-decks
    │                       generated-reports
    │                       social-assets
    │                       exports
    │
    └─► Files table (metadata: path, owner, size, type, expiry)
```

---

## Storage Buckets

| Bucket | Contents | Max Size | Signed URL Expiry | Retention |
|---|---|---|---|---|
| `pitch-decks` | Founder PDF pitches | 50 MB | 7 days | 365 days |
| `generated-reports` | System-generated PDFs | 100 MB | 1 hour | 90 days |
| `social-assets` | Images for social sharing | 5 MB | 1 hour | 90 days |
| `exports` | CSV / JSON data exports | 100 MB | 1 hour | 30 days |

All buckets are **private** — files are never directly accessible without a signed URL.

---

## Uploading a File

### Via API (recommended for client-side uploads)

```http
POST /api/upload
Authorization: Bearer <JWT>
Content-Type: multipart/form-data

file=<binary>
bucket=pitch-decks
```

**Response (200)**
```json
{
  "file_id": "uuid",
  "path": "pitch-decks/user-id/1711234567890-uuid.pdf",
  "signed_url": "https://project.supabase.co/storage/v1/object/sign/..."
}
```

**Error responses**

| Status | Reason |
|--------|--------|
| 400 | Invalid MIME type, file too large, missing fields, invalid bucket |
| 401 | Missing or expired auth token |
| 500 | Storage or database error |

### Via TypeScript utility

```typescript
import { uploadFile } from '@/lib/storage/upload';

const result = await uploadFile(file, 'pitch-decks', userId);
// result: { file_id: string, path: string }
```

### Using the React component

```tsx
import { FileUpload } from '@/components/FileUpload';

<FileUpload
  bucket="pitch-decks"
  onUploadComplete={(result) => console.log('Uploaded:', result.file_id)}
  onUploadError={(msg) => console.error(msg)}
/>
```

---

## Getting a Signed URL

Signed URLs allow time-limited access to private files. Only the file owner or an Admin may request one.

```typescript
import { getSignedUrl } from '@/lib/storage/signedUrl';

// Use default expiry for the bucket (7 days for decks, 1 hour for others)
const url = await getSignedUrl(fileId, currentUserId);

// Or specify custom expiry in seconds
const url = await getSignedUrl(fileId, currentUserId, 600); // 10 minutes
```

**Expiry defaults**

| Bucket | Default |
|--------|---------|
| `pitch-decks` | 604800 seconds (7 days) |
| `generated-reports` | 3600 seconds (1 hour) |
| `social-assets` | 3600 seconds (1 hour) |
| `exports` | 3600 seconds (1 hour) |

---

## Deleting a File

Deletion removes both the Storage object and the `files` metadata row. Ownership is verified before deletion.

```typescript
import { deleteFile } from '@/lib/storage/delete';

await deleteFile(fileId, currentUserId);
// Throws DeleteError if file not found or user is not the owner
```

Admin users can delete any file:

```typescript
await deleteFile(fileId, adminUserId, /* isAdmin */ true);
```

---

## Retention Policies

Files have a `retention_days` value set at upload time. The `expires_at` column is computed from `created_at + retention_days`. A daily job runs `runRetentionPolicy()` which:

1. Queries `files WHERE expires_at < NOW()`
2. Deletes each file from Storage
3. Removes the metadata row
4. Writes an entry to `audit_logs` (action: `retention_delete`)

### Running the job manually

```typescript
import { runRetentionPolicy } from '@/lib/storage/retention';

const result = await runRetentionPolicy('system-user-id');
console.log(`Deleted ${result.deletedCount} files`);
```

### Adjusting retention at upload time

```typescript
const result = await uploadFile(file, 'generated-reports', userId, {
  retentionDays: 7, // keep for only 7 days instead of the 90-day default
});
```

---

## File Type & Size Limits

| Bucket | Allowed MIME Types | Max Size |
|--------|--------------------|----------|
| `pitch-decks` | `application/pdf` | 50 MB |
| `generated-reports` | `application/pdf` | 100 MB |
| `social-assets` | `image/jpeg`, `image/png` | 5 MB |
| `exports` | `application/json`, `text/csv` | 100 MB |

Violations throw an `UploadError` with code `INVALID_MIME_TYPE` or `FILE_TOO_LARGE`.

---

## Malware Scanning

A stub `scanFile(filePath)` is included in `studio/src/lib/storage/retention.ts`. It currently returns `'safe'` unconditionally. Phase 2 will integrate a real scanner (VirusTotal or ClamAV).

```typescript
import { scanFile } from '@/lib/storage/retention';

const verdict = await scanFile('pitch-decks/user/file.pdf');
// 'safe' | 'unsafe'
```

---

## Row-Level Security (RLS)

RLS policies on the `files` table are defined in `studio/src/lib/db/migrations/004_files_rls.sql`.

| Policy | Who |
|--------|-----|
| `files_select_own` | Owner sees own files |
| `files_select_public` | Everyone sees `is_public = true` files |
| `files_select_admin` | Admins see all files |
| `files_insert_authenticated` | Authenticated users may insert (owner_id = self) |
| `files_update_own` | Owner may update metadata |
| `files_delete_own` | Owner may delete own files |
| `files_delete_admin` | Admins may delete any file |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | ✅ | Service role key (server-side only) |
| `SUPABASE_ANON_KEY` | Optional | Anon key (client-side reads) |

---

## Running Migrations

```bash
# Apply all migrations to your Supabase project
npx supabase db push

# Or apply a specific migration manually
psql $DATABASE_URL -f studio/src/lib/db/migrations/004_files_rls.sql
```
