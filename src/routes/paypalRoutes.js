"use strict";

const express = require("express");

const {
  createOrder,
  captureOrder,
} = require("../controllers/paypalController");

const router = express.Router();


/* =========================================================
   CREATE PAYPAL ORDER
========================================================= */

router.post(
  "/create-order",
  createOrder
);


/* =========================================================
   CAPTURE PAYPAL ORDER
========================================================= */

router.post(
  "/capture-order",
  captureOrder
);


module.exports = router;