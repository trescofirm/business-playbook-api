"use strict";

/* =========================================================
   PAYPAL CONFIG
========================================================= */

const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID;

const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET;

const PAYPAL_BASE_URL =
  process.env.PAYPAL_BASE_URL ||
  "https://api-m.sandbox.paypal.com";


/* =========================================================
   VALIDATE CONFIG
========================================================= */

function validatePayPalConfig() {

  if (!PAYPAL_CLIENT_ID) {
    throw new Error(
      "PAYPAL_CLIENT_ID is not configured."
    );
  }

  if (!PAYPAL_CLIENT_SECRET) {
    throw new Error(
      "PAYPAL_CLIENT_SECRET is not configured."
    );
  }
}


/* =========================================================
   GET ACCESS TOKEN
========================================================= */

async function getAccessToken() {

  validatePayPalConfig();

  const credentials =
    Buffer
      .from(
        `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
      )
      .toString("base64");

  const response =
    await fetch(
      `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      {
        method: "POST",

        headers: {
          "Authorization":
            `Basic ${credentials}`,

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          "grant_type=client_credentials",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {

    console.error(
      "PayPal OAuth error:",
      data
    );

    throw new Error(
      data.error_description ||
      "Unable to authenticate with PayPal."
    );
  }

  return data.access_token;
}


/* =========================================================
   CREATE PAYPAL ORDER
========================================================= */

async function createPayPalOrder({
  amount,
  currency = "USD",
  orderNumber,
}) {

  const accessToken =
    await getAccessToken();

  const response =
    await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        method: "POST",

        headers: {
          "Authorization":
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",

          "PayPal-Request-Id":
            orderNumber,
        },

        body: JSON.stringify({

          intent: "CAPTURE",

          purchase_units: [
            {
              reference_id:
                orderNumber,

              custom_id:
                orderNumber,

              amount: {
                currency_code:
                  currency,

                value:
                  Number(amount)
                    .toFixed(2),
              },
            },
          ],

          application_context: {
            shipping_preference:
              "NO_SHIPPING",

            user_action:
              "PAY_NOW",
          },

        }),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {

    console.error(
      "PayPal create order error:",
      data
    );

    throw new Error(
      data.message ||
      "Unable to create PayPal order."
    );
  }

  return data;
}


/* =========================================================
   CAPTURE PAYPAL ORDER
========================================================= */

async function capturePayPalOrder(
  paypalOrderId
) {

  const accessToken =
    await getAccessToken();

  const response =
    await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(
        paypalOrderId
      )}/capture`,
      {
        method: "POST",

        headers: {
          "Authorization":
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },
      }
    );

  const data =
    await response.json();

  if (!response.ok) {

    console.error(
      "PayPal capture error:",
      data
    );

    throw new Error(
      data.message ||
      "Unable to capture PayPal payment."
    );
  }

  return data;
}


/* =========================================================
   GET PAYPAL ORDER
========================================================= */

async function getPayPalOrder(
  paypalOrderId
) {

  const accessToken =
    await getAccessToken();

  const response =
    await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(
        paypalOrderId
      )}`,
      {
        method: "GET",

        headers: {
          "Authorization":
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },
      }
    );

  const data =
    await response.json();

  if (!response.ok) {

    console.error(
      "PayPal order lookup error:",
      data
    );

    throw new Error(
      data.message ||
      "Unable to retrieve PayPal order."
    );
  }

  return data;
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getAccessToken,
  createPayPalOrder,
  capturePayPalOrder,
  getPayPalOrder,
};