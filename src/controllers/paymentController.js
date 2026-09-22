"use strict";

const crypto = require("crypto");

const razorpay = require("../config/razorpay");
const { pool } = require("../config/db");

const {
  sendPurchaseEmail,
} = require("../services/emailService");

/*
|--------------------------------------------------------------------------
| PRODUCTS
|--------------------------------------------------------------------------
| USD ONLY
|--------------------------------------------------------------------------
*/

const PRODUCTS = {
  "how-to-attract-women": {
    id: "how-to-attract-women",
    name: "How to Attract Women",
    price: 19.99,
  },

  "dopamine-detox": {
    id: "dopamine-detox",
    name: "30 Day Dopamine Detox Workbook",
    price: 15.0,
  },

  "unlock-focus": {
    id: "unlock-focus",
    name: "How to Unlock Your Focus",
    price: 15.0,
  },
};

const COLLECTION_PRICE = 45.0;

/*
|--------------------------------------------------------------------------
| DOWNLOAD TOKEN SETTINGS
|--------------------------------------------------------------------------
*/

const DOWNLOAD_TOKEN_EXPIRY_DAYS = Number(
  process.env.DOWNLOAD_TOKEN_EXPIRY_DAYS || 30
);

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) + Number.EPSILON) * 100
    ) / 100
  );
}

/*
|--------------------------------------------------------------------------
| ORDER NUMBER
|--------------------------------------------------------------------------
*/

function generateOrderNumber() {
  const timestamp = Date.now();

  const random = crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();

  return `BP-${timestamp}-${random}`;
}

/*
|--------------------------------------------------------------------------
| NORMALIZE PRODUCTS
|--------------------------------------------------------------------------
*/

function normalizeItems(items) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new Error("No products selected");
  }

  const uniqueIds = [
    ...new Set(
      items.map((item) => item.id)
    ),
  ];

  if (uniqueIds.length !== items.length) {
    throw new Error(
      "Duplicate products are not allowed"
    );
  }

  if (uniqueIds.length > 3) {
    throw new Error(
      "Maximum 3 products can be purchased"
    );
  }

  return uniqueIds.map((id) => {
    const product = PRODUCTS[id];

    if (!product) {
      throw new Error(
        `Invalid product: ${id}`
      );
    }

    return product;
  });
}

/*
|--------------------------------------------------------------------------
| CALCULATE PRICING
|--------------------------------------------------------------------------
|
| USD ONLY
|
| PIR = 10% discount
|
| FREE100 REMOVED
| INR REMOVED
|--------------------------------------------------------------------------
*/

function calculatePricing(
  products,
  couponCode
) {
  const individualSubtotal = roundMoney(
    products.reduce(
      (sum, product) =>
        sum + product.price,
      0
    )
  );

  const isCompleteCollection =
    products.length === 3;

  const subtotal =
    isCompleteCollection
      ? COLLECTION_PRICE
      : individualSubtotal;

  const bundleSaving =
    isCompleteCollection
      ? roundMoney(
          individualSubtotal -
            COLLECTION_PRICE
        )
      : 0;

  const normalizedCoupon =
    String(couponCode || "")
      .trim()
      .toUpperCase();

  let discount = 0;

  /*
  |--------------------------------------------------------------------------
  | PIR COUPON
  |--------------------------------------------------------------------------
  */

  if (normalizedCoupon === "PIR") {
    discount = roundMoney(
      subtotal * 0.1
    );
  } else if (normalizedCoupon) {
    throw new Error(
      "Invalid coupon. Use PIR."
    );
  }

  let total = roundMoney(
    subtotal - discount
  );

  if (total < 0) {
    total = 0;
  }

  return {
    individualSubtotal,
    subtotal,
    bundleSaving,
    discount,
    total,
    couponCode:
      normalizedCoupon || null,
  };
}

/*
|--------------------------------------------------------------------------
| DOWNLOAD TOKEN
|--------------------------------------------------------------------------
*/

function generateDownloadToken() {
  return crypto
    .randomBytes(32)
    .toString("hex");
}

function hashDownloadToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function getDownloadExpiryDate() {
  return new Date(
    Date.now() +
      DOWNLOAD_TOKEN_EXPIRY_DAYS *
        24 *
        60 *
        60 *
        1000
  );
}

/*
|--------------------------------------------------------------------------
| CREATE DOWNLOAD LINKS
|--------------------------------------------------------------------------
*/

async function createDownloadLinks(
  connection,
  items
) {
  const backendUrl =
    process.env.BACKEND_PUBLIC_URL ||
    `http://localhost:${
      process.env.PORT || 5000
    }`;

  const downloads = [];

  for (const item of items) {
    /*
    |--------------------------------------------------------------------------
    | CHECK EXISTING TOKEN
    |--------------------------------------------------------------------------
    */

    const [existingTokens] =
      await connection.execute(
        `
          SELECT
            id,
            expires_at,
            download_count,
            max_downloads
          FROM download_tokens
          WHERE order_item_id = ?
          LIMIT 1
        `,
        [item.id]
      );

    if (existingTokens.length > 0) {
      continue;
    }

    /*
    |--------------------------------------------------------------------------
    | GENERATE TOKEN
    |--------------------------------------------------------------------------
    */

    const rawToken =
      generateDownloadToken();

    const tokenHash =
      hashDownloadToken(
        rawToken
      );

    const expiresAt =
      getDownloadExpiryDate();

    /*
    |--------------------------------------------------------------------------
    | SAVE TOKEN HASH
    |--------------------------------------------------------------------------
    */

    await connection.execute(
      `
        INSERT INTO download_tokens
        (
          order_item_id,
          token_hash,
          expires_at,
          download_count,
          max_downloads
        )
        VALUES (?, ?, ?, 0, 5)
      `,
      [
        item.id,
        tokenHash,
        expiresAt,
      ]
    );

    /*
    |--------------------------------------------------------------------------
    | RETURN DOWNLOAD URL
    |--------------------------------------------------------------------------
    */

    downloads.push({
      productId:
        item.product_id,

      productName:
        item.product_name,

      url:
        `${backendUrl}/api/download/${rawToken}`,

      expiresAt:
        expiresAt.toISOString(),

      maxDownloads: 5,
    });
  }

  return downloads;
}

/*
|--------------------------------------------------------------------------
| CREATE ORDER
|--------------------------------------------------------------------------
*/

const createOrder = async (
  req,
  res
) => {
  let connection;

  try {
    const {
      items,
      couponCode,
      customer,
    } = req.body;

    /*
    |--------------------------------------------------------------------------
    | CUSTOMER REQUIRED
    |--------------------------------------------------------------------------
    */

    if (!customer) {
      return res.status(400).json({
        success: false,
        message:
          "Customer details are required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | REQUIRED CUSTOMER FIELDS
    |--------------------------------------------------------------------------
    |
    | address     ❌ removed
    | city        ❌ removed
    | pincode     ❌ removed
    |
    | country     ✅ kept
    | state       ✅ kept
    |--------------------------------------------------------------------------
    */

    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "country",
      "state",
    ];

    for (const field of requiredFields) {
      if (!customer[field]) {
        return res.status(400).json({
          success: false,
          message:
            `${field} is required`,
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | EMAIL
    |--------------------------------------------------------------------------
    */

    const email = String(
      customer.email
    )
      .trim()
      .toLowerCase();

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid email address",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | PRODUCTS
    |--------------------------------------------------------------------------
    */

    const products =
      normalizeItems(items);

    /*
    |--------------------------------------------------------------------------
    | PRICING
    |--------------------------------------------------------------------------
    */

    const pricing =
      calculatePricing(
        products,
        couponCode
      );

    /*
    |--------------------------------------------------------------------------
    | USD ONLY
    |--------------------------------------------------------------------------
    */

    const currency = "USD";

    /*
    |--------------------------------------------------------------------------
    | PAID ORDER ONLY
    |--------------------------------------------------------------------------
    */

    if (pricing.total <= 0) {
      throw new Error(
        "A paid order must have a total greater than zero."
      );
    }

    /*
    |--------------------------------------------------------------------------
    | ORDER NUMBER
    |--------------------------------------------------------------------------
    */

    const orderNumber =
      generateOrderNumber();

    /*
    |--------------------------------------------------------------------------
    | CREATE RAZORPAY ORDER
    |--------------------------------------------------------------------------
    */

    const razorpayOrder =
      await razorpay.orders.create({
        amount:
          Math.round(
            pricing.total * 100
          ),

        currency: "USD",

        receipt: orderNumber,

        notes: {
          order_number:
            orderNumber,

          products:
            products
              .map(
                (product) =>
                  product.id
              )
              .join(","),
        },
      });

    /*
    |--------------------------------------------------------------------------
    | DATABASE CONNECTION
    |--------------------------------------------------------------------------
    */

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    /*
    |--------------------------------------------------------------------------
    | SAVE CUSTOMER
    |--------------------------------------------------------------------------
    |
    | ONLY:
    | first_name
    | last_name
    | email
    | country
    | state
    | notes
    |
    | address ❌
    | city    ❌
    | pincode ❌
    |--------------------------------------------------------------------------
    */

    const [
      customerResult,
    ] = await connection.execute(
      `
        INSERT INTO customers
        (
          first_name,
          last_name,
          email,
          country,
          state,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        customer.firstName,
        customer.lastName,
        email,
        customer.country,
        customer.state || null,
        customer.notes || null,
      ]
    );

    const customerId =
      customerResult.insertId;

    /*
    |--------------------------------------------------------------------------
    | SAVE ORDER
    |--------------------------------------------------------------------------
    */

    const [
      orderResult,
    ] = await connection.execute(
      `
        INSERT INTO orders
        (
          order_number,
          customer_id,
          subtotal,
          discount,
          total,
          coupon_code,
          currency,
          razorpay_order_id,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        orderNumber,

        customerId,

        pricing.subtotal,

        pricing.discount,

        pricing.total,

        pricing.couponCode,

        "USD",

        razorpayOrder.id,

        "PENDING",
      ]
    );

    const orderId =
      orderResult.insertId;

    /*
    |--------------------------------------------------------------------------
    | SAVE ORDER ITEMS
    |--------------------------------------------------------------------------
    */

    const savedItems = [];

    for (const product of products) {
      const [
        itemResult,
      ] = await connection.execute(
        `
          INSERT INTO order_items
          (
            order_id,
            product_id,
            product_name,
            price
          )
          VALUES (?, ?, ?, ?)
        `,
        [
          orderId,
          product.id,
          product.name,
          product.price,
        ]
      );

      savedItems.push({
        id:
          itemResult.insertId,

        order_id:
          orderId,

        product_id:
          product.id,

        product_name:
          product.name,

        price:
          product.price,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | COMMIT
    |--------------------------------------------------------------------------
    */

    await connection.commit();

    /*
    |--------------------------------------------------------------------------
    | IMPORTANT
    |--------------------------------------------------------------------------
    |
    | Download links are NOT created yet.
    |
    | They are created only after Razorpay payment
    | is successfully verified.
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,

      message:
        "Payment order created successfully",

      freeOrder: false,

      order: razorpayOrder,

      orderNumber,

      items: savedItems,

      downloads: [],

      pricing: {
        subtotal:
          pricing.subtotal,

        bundleSaving:
          pricing.bundleSaving,

        discount:
          pricing.discount,

        total:
          pricing.total,

        currency: "USD",
      },
    });
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | ROLLBACK
    |--------------------------------------------------------------------------
    */

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Rollback error:",
          rollbackError
        );
      }
    }

    console.error(
      "Create order error:",
      error
    );

    return res.status(400).json({
      success: false,

      message:
        error.message ||
        "Unable to create payment order",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/*
|--------------------------------------------------------------------------
| VERIFY PAYMENT
|--------------------------------------------------------------------------
*/

const verifyPayment = async (
  req,
  res
) => {
  let connection;

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    /*
    |--------------------------------------------------------------------------
    | VALIDATE PAYMENT DATA
    |--------------------------------------------------------------------------
    */

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing payment details",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | RAZORPAY SECRET
    |--------------------------------------------------------------------------
    */

    const secret =
      process.env
        .RAZORPAY_KEY_SECRET;

    if (!secret) {
      console.error(
        "RAZORPAY_KEY_SECRET is not configured."
      );

      return res.status(500).json({
        success: false,
        message:
          "Payment verification is not configured.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | VERIFY SIGNATURE
    |--------------------------------------------------------------------------
    */

    const body =
      razorpay_order_id +
      "|" +
      razorpay_payment_id;

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          secret
        )
        .update(body)
        .digest("hex");

    const receivedSignature =
      String(
        razorpay_signature
      );

    if (
      expectedSignature.length !==
      receivedSignature.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment signature",
      });
    }

    const isValid =
      crypto.timingSafeEqual(
        Buffer.from(
          expectedSignature,
          "utf8"
        ),
        Buffer.from(
          receivedSignature,
          "utf8"
        )
      );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment signature",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | DATABASE
    |--------------------------------------------------------------------------
    */

    connection =
      await pool.getConnection();

    /*
    |--------------------------------------------------------------------------
    | FIND ORDER
    |--------------------------------------------------------------------------
    */

    const [orders] =
      await connection.execute(
        `
          SELECT
            id,
            order_number,
            customer_id,
            total,
            currency,
            status,
            razorpay_payment_id
          FROM orders
          WHERE razorpay_order_id = ?
          LIMIT 1
        `,
        [
          razorpay_order_id,
        ]
      );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Order not found",
      });
    }

    const order =
      orders[0];

    /*
    |--------------------------------------------------------------------------
    | ENSURE USD
    |--------------------------------------------------------------------------
    */

    if (order.currency !== "USD") {
      return res.status(400).json({
        success: false,
        message:
          "Only USD payments are supported.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | GET ORDER ITEMS
    |--------------------------------------------------------------------------
    */

    const [items] =
      await connection.execute(
        `
          SELECT
            id,
            product_id,
            product_name,
            price
          FROM order_items
          WHERE order_id = ?
          ORDER BY id ASC
        `,
        [order.id]
      );

    /*
    |--------------------------------------------------------------------------
    | GET CUSTOMER
    |--------------------------------------------------------------------------
    |
    | address ❌
    | city    ❌
    | pincode ❌
    |--------------------------------------------------------------------------
    */

    const [customers] =
      await connection.execute(
        `
          SELECT
            id,
            first_name,
            last_name,
            email,
            country,
            state
          FROM customers
          WHERE id = ?
          LIMIT 1
        `,
        [
          order.customer_id,
        ]
      );

    const customer =
      customers[0] || null;

    /*
    |--------------------------------------------------------------------------
    | ALREADY PAID
    |--------------------------------------------------------------------------
    */

    if (
      order.status === "PAID"
    ) {
      return res.status(200).json({
        success: true,

        message:
          "Payment already verified",

        payment_id:
          order.razorpay_payment_id ||
          razorpay_payment_id,

        order_id:
          razorpay_order_id,

        orderNumber:
          order.order_number,

        currency: "USD",

        total:
          Number(order.total),

        customer,

        items,

        downloads: [],
      });
    }

    /*
    |--------------------------------------------------------------------------
    | START TRANSACTION
    |--------------------------------------------------------------------------
    */

    await connection.beginTransaction();

    /*
    |--------------------------------------------------------------------------
    | MARK ORDER PAID
    |--------------------------------------------------------------------------
    */

    await connection.execute(
      `
        UPDATE orders
        SET
          razorpay_payment_id = ?,
          razorpay_signature = ?,
          status = 'PAID',
          paid_at = NOW()
        WHERE id = ?
      `,
      [
        razorpay_payment_id,

        razorpay_signature,

        order.id,
      ]
    );

    /*
    |--------------------------------------------------------------------------
    | CREATE SECURE DOWNLOAD LINKS
    |--------------------------------------------------------------------------
    */

    const downloads =
      await createDownloadLinks(
        connection,
        items
      );

    /*
    |--------------------------------------------------------------------------
    | COMMIT
    |--------------------------------------------------------------------------
    */

    await connection.commit();

    /*
    |--------------------------------------------------------------------------
    | SEND PURCHASE EMAIL
    |--------------------------------------------------------------------------
    */

    try {
      if (
        customer &&
        customer.email &&
        downloads.length > 0
      ) {
        const emailItems =
          items
            .map((item) => {
              const download =
                downloads.find(
                  (downloadItem) =>
                    downloadItem.productId ===
                    item.product_id
                );

              if (!download) {
                return null;
              }

              return {
                product_name:
                  item.product_name,

                download_url:
                  download.url,
              };
            })
            .filter(Boolean);

        if (
          emailItems.length > 0
        ) {
          await sendPurchaseEmail({
            customer: {
              first_name:
                customer.first_name,

              email:
                customer.email,
            },

            orderNumber:
              order.order_number,

            items:
              emailItems,

            total:
              order.total,
          });
        }
      }
    } catch (emailError) {
      console.error(
        "Purchase email could not be sent:",
        emailError.message
      );
    }

    /*
    |--------------------------------------------------------------------------
    | FINAL RESPONSE
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,

      message:
        "Payment verified successfully",

      payment_id:
        razorpay_payment_id,

      order_id:
        razorpay_order_id,

      orderNumber:
        order.order_number,

      currency: "USD",

      total:
        Number(order.total),

      customer,

      items,

      downloads,
    });
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | ROLLBACK
    |--------------------------------------------------------------------------
    */

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Rollback error:",
          rollbackError
        );
      }
    }

    console.error(
      "Payment verification error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Payment verification failed",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {
  createOrder,
  verifyPayment,
};