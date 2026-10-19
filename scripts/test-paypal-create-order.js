"use strict";

require("dotenv").config();

const crypto = require("crypto");

const {
  createPayPalOrder,
} = require("../src/services/paypalService");

async function testPayPalCreateOrder() {
  const orderNumber =
    `BP-TEST-${Date.now()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

  console.log("Testing PayPal Sandbox Create Order...");
  console.log(`Test order number: ${orderNumber}`);
  console.log("Amount: 1.00 USD");

  const paypalOrder =
    await createPayPalOrder({
      amount: 1.00,
      currency: "USD",
      orderNumber,
    });

  console.log("\nPayPal Create Order successful.");
  console.log(`PayPal Order ID: ${paypalOrder.id}`);
  console.log(`PayPal Status: ${paypalOrder.status}`);

  const approvalLink =
    paypalOrder.links?.find(
      (link) =>
        link.rel === "approve" ||
        link.rel === "payer-action"
    );

  if (approvalLink) {
    console.log(`Approval URL: ${approvalLink.href}`);
  } else {
    console.log("Approval URL: Not returned.");
  }

  console.log("\nPhase 2 test completed successfully.");
}

testPayPalCreateOrder().catch((error) => {
  console.error("\nPayPal Create Order test failed.");
  console.error(error.message);
  process.exit(1);
});