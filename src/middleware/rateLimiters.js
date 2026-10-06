"use strict";

const {
  rateLimit,
} = require("express-rate-limit");

const standardOptions = {
  standardHeaders: "draft-8",
  legacyHeaders: false,
};

const apiLimiter = rateLimit({
  ...standardOptions,

  windowMs:
    15 * 60 * 1000,

  limit: 100,

  message: {
    success: false,
    message:
      "Too many requests. Please try again later.",
  },
});

const paymentCreateLimiter =
  rateLimit({
    ...standardOptions,

    windowMs:
      15 * 60 * 1000,

    limit: 10,

    message: {
      success: false,
      message:
        "Too many payment attempts. Please try again later.",
    },
  });

const paymentVerifyLimiter =
  rateLimit({
    ...standardOptions,

    windowMs:
      15 * 60 * 1000,

    limit: 20,

    message: {
      success: false,
      message:
        "Too many payment verification attempts. Please try again later.",
    },
  });

const downloadLimiter =
  rateLimit({
    ...standardOptions,

    windowMs:
      15 * 60 * 1000,

    limit: 30,

    message: {
      success: false,
      message:
        "Too many download requests. Please try again later.",
    },
  });

module.exports = {
  apiLimiter,
  paymentCreateLimiter,
  paymentVerifyLimiter,
  downloadLimiter,
};