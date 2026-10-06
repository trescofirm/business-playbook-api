"use strict";

const express = require("express");

const {
  createOrder,
  verifyPayment,
} = require("../controllers/paymentController");

const router = express.Router();

const {
  paymentCreateLimiter,
  paymentVerifyLimiter,
} = require("../middleware/rateLimiters");

/* =========================================================
   CREATE PAYMENT ORDER
========================================================= */

router.post(
  "/create-order",
  paymentCreateLimiter,
  createOrder
);


/* =========================================================
   VERIFY PAYMENT
========================================================= */

router.post(
  "/verify-payment",
  paymentVerifyLimiter,
  verifyPayment
);


module.exports = router;