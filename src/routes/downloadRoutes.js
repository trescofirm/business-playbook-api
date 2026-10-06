"use strict";

const express = require("express");

const {
  downloadBook,
  getBookAccess,
} = require("../controllers/downloadController");

const router = express.Router();

const {
  downloadLimiter,
} = require("../middleware/rateLimiters");

/*
|--------------------------------------------------------------------------
| SECURE BOOK DOWNLOAD
|--------------------------------------------------------------------------
|
| Example:
| GET /api/download/<secure-token>
|
*/
router.get(
  "/access/:token",
  downloadLimiter,
  getBookAccess
);


router.get(
  "/:token",
  downloadBook
);


module.exports = router;