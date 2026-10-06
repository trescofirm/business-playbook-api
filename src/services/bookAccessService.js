"use strict";

const crypto = require("crypto");

const ACCESS_TOKEN_EXPIRY_DAYS =
  Number(
    process.env.DOWNLOAD_TOKEN_EXPIRY_DAYS || 30
  );

/* =========================================================
   GENERATE RAW ACCESS TOKEN
========================================================= */

function generateBookAccessToken() {
  return crypto
    .randomBytes(32)
    .toString("hex");
}

/* =========================================================
   HASH ACCESS TOKEN
========================================================= */

function hashBookAccessToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

/* =========================================================
   ACCESS TOKEN EXPIRY
========================================================= */

function getBookAccessExpiryDate() {
  return new Date(
    Date.now() +
      ACCESS_TOKEN_EXPIRY_DAYS *
        24 *
        60 *
        60 *
        1000
  );
}

/* =========================================================
   CREATE BOOK ACCESS TOKEN
========================================================= */

async function createBookAccessToken(
  connection,
  orderId
) {
  if (!orderId) {
    throw new Error(
      "Order ID is required to create book access."
    );
  }

  const rawToken =
    generateBookAccessToken();

  const tokenHash =
    hashBookAccessToken(
      rawToken
    );

  const expiresAt =
    getBookAccessExpiryDate();

  await connection.execute(
    `
      INSERT INTO book_access_tokens
      (
        order_id,
        token_hash,
        expires_at
      )
      VALUES (?, ?, ?)
    `,
    [
      orderId,
      tokenHash,
      expiresAt,
    ]
  );

  return {
    token: rawToken,
    tokenHash,
    expiresAt,
  };
}

module.exports = {
  generateBookAccessToken,
  hashBookAccessToken,
  getBookAccessExpiryDate,
  createBookAccessToken,
};