"use strict";

require("dotenv").config();

const BASE_URL =
  process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

async function testPayPalAuth() {
  if (!clientId) {
    throw new Error("PAYPAL_CLIENT_ID is missing from .env");
  }

  if (!clientSecret) {
    throw new Error("PAYPAL_CLIENT_SECRET is missing from .env");
  }

  if (!BASE_URL) {
    throw new Error("PAYPAL_BASE_URL is missing from .env");
  }

  console.log("Testing PayPal Sandbox OAuth...");
  console.log(`PayPal environment: ${BASE_URL}`);

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const response = await fetch(
    `${BASE_URL}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("PayPal OAuth failed.");
    console.error(`HTTP Status: ${response.status}`);
    console.error(data);
    process.exit(1);
  }

  console.log("PayPal OAuth successful.");
  console.log(`Token type: ${data.token_type}`);
  console.log(`Expires in: ${data.expires_in} seconds`);
  console.log(`App ID: ${data.app_id}`);
  console.log("Access token received: YES");
}

testPayPalAuth().catch((error) => {
  console.error("PayPal OAuth test failed.");
  console.error(error.message);
  process.exit(1);
});