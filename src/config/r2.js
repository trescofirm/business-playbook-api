"use strict";

/*
| CLOUDFLARE R2 (PRIVATE BOOK STORAGE)
| Required env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
| Optional:     R2_ENDPOINT (only for EU-jurisdiction buckets)
*/

const { S3Client } = require("@aws-sdk/client-s3");

function clean(name) {
  const value = process.env[name];
  // Remove spaces / line breaks / quotes that sneak in when pasting into a dashboard
  return value
    ? String(value).trim().replace(/^["']|["']$/g, "").trim()
    : "";
}

const R2_ACCOUNT_ID = clean("R2_ACCOUNT_ID");
const R2_ACCESS_KEY_ID = clean("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = clean("R2_SECRET_ACCESS_KEY");
const R2_BUCKET = clean("R2_BUCKET");
const R2_ENDPOINT = (
  clean("R2_ENDPOINT") ||
  (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "")
).replace(/\/$/, "");

const missing = [];
if (!R2_ACCOUNT_ID && !clean("R2_ENDPOINT")) missing.push("R2_ACCOUNT_ID");
if (!R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
if (!R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
if (!R2_BUCKET) missing.push("R2_BUCKET");

const r2Client =
  missing.length === 0
    ? new S3Client({
        region: "auto",
        endpoint: R2_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
        // New AWS SDK versions add checksums R2 doesn't fully support
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      })
    : null;

function describeR2Error(error) {
  const status = error?.$metadata?.httpStatusCode;
  const name = error?.name || error?.Code || "UnknownError";
  let hint = "";

  if (status === 403 || name === "AccessDenied" || name === "Forbidden") {
    hint = "Credentials rejected. Check R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY and that the token has Object Read access to this bucket.";
  } else if (name === "NoSuchBucket") {
    hint = `Bucket "${R2_BUCKET}" not found. Check R2_BUCKET and R2_ACCOUNT_ID.`;
  } else if (status === 404 || name === "NotFound" || name === "NoSuchKey") {
    hint = "Object key (or bucket) not found. Check the file name / R2_BUCKET.";
  } else if (name === "SignatureDoesNotMatch") {
    hint = "R2_SECRET_ACCESS_KEY is wrong (or has extra characters).";
  } else if (name === "InvalidAccessKeyId") {
    hint = "R2_ACCESS_KEY_ID is wrong.";
  } else if (
    error?.code === "ENOTFOUND" ||
    error?.code === "EAI_AGAIN" ||
    /getaddrinfo/i.test(error?.message || "")
  ) {
    hint = `Cannot resolve ${R2_ENDPOINT}. R2_ACCOUNT_ID is probably wrong.`;
  }

  return `${name}${status ? ` (HTTP ${status})` : ""}: ${error?.message || ""}${hint ? ` -> ${hint}` : ""}`;
}

function logStorageMode() {
  if (r2Client) {
    console.log(`📚 Book storage: Cloudflare R2 (bucket "${R2_BUCKET}" at ${R2_ENDPOINT})`);
  } else {
    console.warn(
      `⚠️ Book storage: LOCAL files (storage/books). R2 disabled — missing env: ${missing.join(", ")}. Downloads will fail unless the PDFs exist on this server.`
    );
  }
}

module.exports = {
  r2Client,
  R2_BUCKET,
  R2_ENDPOINT,
  missingR2Env: missing,
  describeR2Error,
  logStorageMode,
};