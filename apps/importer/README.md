# Startime importer

Bun/Fastify service for importing user activity data. It receives a short
import command from the Next backend, then writes imported events and progress
to the shared database. The Next application polls `eventImports` normally.

## Run locally

```sh
bun --cwd apps/importer dev
```

The service uses the shared `@startime/env` package. Configure these values in
the root `.env` in addition to the existing application values:

```env
IMPORTER_URL=http://localhost:3001
IMPORTER_PORT=3001

INTERNAL_SERVICE_SECRET=<a random secret of at least 32 characters>
FILE_HASH_KEY=<a random secret of at least 32 characters>
```

`UPLOADTHING_TOKEN` is also required by the importer. It uses that token and
the supplied UploadThing file key to generate a one-hour download URL itself.

## Import command and authentication

`POST /v1/imports` accepts `{ importId, fileKey, format }` and returns `202`
immediately. Processing continues in the background. Each 500-event database
transaction inserts its events and updates the associated `eventImports` row,
which the Next app can poll. Once the job reaches either completion or failure,
the importer deletes the source object from UploadThing and removes its `files`
record.

The Next-to-importer request uses `@startime/service-auth`. It is HMAC-SHA256
signed over the HTTP method, path, timestamp, nonce, and SHA-256 body digest.
The importer verifies signatures in constant time and rejects timestamps more
than five minutes old. Keep `INTERNAL_SERVICE_SECRET` private and use HTTPS
outside a trusted private network.

## Format plug-ins

Formats implement `ImportFormat` in `src/formats` and are detected from the
CSV header row. `codetime/csv` validates the exact CodeTime headers, skips
`Absolute File`, `Git Branch`, and `Git Origin`, and creates an HMAC-SHA256
`fileHash` from `Relative File`, falling back to `Absolute File` when the
relative path is absent. `Recorded At` is used for both `eventTime` and
`createdAt`.

`startime/export-csv` imports the `events.csv` included in a Startime user-data
export. It validates every exported column and preserves the existing
`fileHash`; the export's `userId` is validated but events are always assigned
to the user who uploaded the file.
