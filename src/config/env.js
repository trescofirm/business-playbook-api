"use strict";

function required(name) {
  const value =
    process.env[name];

  if (
    !value ||
    !String(value).trim()
  ) {
    throw new Error(
      `${name} is required but is not configured.`
    );
  }

  return value;
}

function validateEnv() {
  const isProduction =
    process.env.NODE_ENV ===
    "production";

  required("DB_HOST");
  required("DB_USER");
  required("DB_PASSWORD");
  required("DB_NAME");

  required("RAZORPAY_KEY_ID");
  required("RAZORPAY_KEY_SECRET");

  required("PAYPAL_CLIENT_ID");
  required("PAYPAL_CLIENT_SECRET");

  required("SMTP_HOST");
  required("SMTP_USER");
  required("SMTP_PASSWORD");
  required("SMTP_FROM");

  required(
    "FRONTEND_PUBLIC_URL"
  );

  required(
    "BACKEND_PUBLIC_URL"
  );

  if (isProduction) {
    if (
      !process.env.FRONTEND_PUBLIC_URL.startsWith(
        "https://"
      )
    ) {
      throw new Error(
        "FRONTEND_PUBLIC_URL must use HTTPS in production."
      );
    }

    if (
      !process.env.BACKEND_PUBLIC_URL.startsWith(
        "https://"
      )
    ) {
      throw new Error(
        "BACKEND_PUBLIC_URL must use HTTPS in production."
      );
    }

    if (
      process.env.PAYPAL_BASE_URL !==
      "https://api-m.paypal.com"
    ) {
      throw new Error(
        "Production PayPal must use the live API."
      );
    }
  }
}

module.exports = {
  validateEnv,
};