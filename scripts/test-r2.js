"use strict";

require("dotenv").config();

const { HeadObjectCommand } = require("@aws-sdk/client-s3");
const {
  r2Client,
  R2_BUCKET,
  R2_ENDPOINT,
  missingR2Env,
  describeR2Error,
} = require("../src/config/r2");

const BOOKS = [
  "how-to-attract-women.pdf",
  "dopamine-detox.pdf",
  "unlock-focus.pdf",
];

async function main() {
  if (!r2Client) {
    console.error(`❌ R2 is NOT configured. Missing env: ${missingR2Env.join(", ")}`);
    process.exit(1);
  }

  console.log(`Endpoint: ${R2_ENDPOINT}`);
  console.log(`Bucket:   ${R2_BUCKET}\n`);

  let failed = 0;
  for (const key of BOOKS) {
    try {
      const head = await r2Client.send(
        new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })
      );
      console.log(`✅ ${key}  (${(head.ContentLength / 1024 / 1024).toFixed(2)} MB)`);
    } catch (error) {
      failed += 1;
      console.error(`❌ ${key}  ${describeR2Error(error)}`);
    }
  }

  process.exit(failed ? 1 : 0);
}

main();