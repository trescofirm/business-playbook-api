"use strict";

const express = require("express");

const {
  createOrder,
  captureOrder,
} = require("../controllers/paypalController");

const router = express.Router();

const {
  paymentCreateLimiter,
  paymentVerifyLimiter,
} = require("../middleware/rateLimiters");

/* =========================================================
   CREATE PAYPAL ORDER
========================================================= */

router.post(
  "/create-order",
  paymentCreateLimiter,
  createOrder
);


/* =========================================================
   CAPTURE PAYPAL ORDER
========================================================= */

router.post(
  "/capture-order",
  paymentVerifyLimiter,
  captureOrder
);


module.exports = router;