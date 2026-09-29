"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");

const paymentRoutes = require("./routes/paymentRoutes");
const downloadRoutes = require("./routes/downloadRoutes");

const app = express();

/* =========================================================
   FRONTEND PATH
========================================================= */

const frontendPath = path.join(__dirname, "../public");

/* =========================================================
   PAGE SEO METADATA
========================================================= */

const PAGE_META = {
  "/": {
    title:
      "Business Playbook | Practical Books for Confidence, Focus & Personal Growth",

    description:
      "Explore practical digital books designed to help you build confidence, improve focus, develop stronger habits, and create meaningful personal growth.",

    image: "/images/og-image.jpg",

    type: "website",
  },

  "/books": {
    title: "Books | Business Playbook",

    description:
      "Explore practical books for confidence, focus, habits, productivity and personal growth.",

    image: "/images/og-image.jpg",

    type: "website",
  },

  "/terms": {
    title: "Terms & Conditions | Business Playbook",

    description:
      "Read the terms and conditions governing purchases and use of Business Playbook.",

    image: "/images/og-image.jpg",

    type: "website",
  },

  "/privacy": {
    title: "Privacy Policy | Business Playbook",

    description:
      "Read the Business Playbook privacy policy and learn how information is handled.",

    image: "/images/og-image.jpg",

    type: "website",
  },

  "/refund": {
    title: "Refund Policy | Business Playbook",

    description:
      "Read the Business Playbook refund and cancellation policy.",

    image: "/images/og-image.jpg",

    type: "website",
  },
};

/* =========================================================
   BOOK SEO METADATA
========================================================= */

const BOOK_META = {
  "how-to-attract-women": {
    title:
      "How to Attract Women: Confidence & Social Skills Guide",

    description:
      "A practical guide for men starting at ground zero: build confidence, social skills and a real social circle. Instant PDF download.",

    image:
      "/images/books/how-to-attract-women-cover.jpeg",
  },

  "dopamine-detox": {
    title:
      "30 Day Dopamine Detox Workbook | Focus & Study Habits",

    description:
      "A 30-day workbook to cut phone distractions, set social media limits and build exam-period study focus. Instant PDF download.",

    image:
      "/images/books/dopamine-detox.jpeg",
  },

  "unlock-focus": {
    title:
      "How to Unlock Your Focus: A Guide to Beating Distraction",

    description:
      "Understand why you get distracted, then use deep work, digital detox and notification strategies to concentrate. Instant PDF download.",

    image:
      "/images/books/unlock-focus-cover.jpeg",
  },
};

/* =========================================================
   SEO / HTML HELPERS
========================================================= */

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildSocialMeta = ({
  title,
  description,
  url,
  image,
  type = "website",
}) => {
  return `
    <title>${escapeHtml(title)}</title>

    <meta
      name="description"
      content="${escapeHtml(description)}"
    />

    <link
      rel="canonical"
      href="${escapeHtml(url)}"
    />

    <meta
      property="og:type"
      content="${escapeHtml(type)}"
    />

    <meta
      property="og:title"
      content="${escapeHtml(title)}"
    />

    <meta
      property="og:description"
      content="${escapeHtml(description)}"
    />

    <meta
      property="og:url"
      content="${escapeHtml(url)}"
    />

    <meta
      property="og:image"
      content="${escapeHtml(image)}"
    />

    <meta
      property="og:site_name"
      content="Business Playbook"
    />

    <meta
      name="twitter:card"
      content="summary_large_image"
    />

    <meta
      name="twitter:title"
      content="${escapeHtml(title)}"
    />

    <meta
      name="twitter:description"
      content="${escapeHtml(description)}"
    />

    <meta
      name="twitter:image"
      content="${escapeHtml(image)}"
    />
  `;
};

/* =========================================================
   BODY PARSERS
========================================================= */

app.use(
  express.json({
    limit: "100kb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "100kb",
  })
);

/* =========================================================
   REQUEST LOGGER
========================================================= */

app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} ${req.method} ${req.originalUrl}`
  );

  next();
});

/* =========================================================
   API HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Business Playbook API is healthy",
    version: "2026-09-18-same-origin",
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
   API ROOT
========================================================= */

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "Business Playbook API is running",
  });
});

/* =========================================================
   API SEO PROTECTION
========================================================= */

app.use("/api", (req, res, next) => {
  res.setHeader(
    "X-Robots-Tag",
    "noindex, nofollow"
  );

  next();
});

/* =========================================================
   API ROUTES
========================================================= */

app.use("/api/payment", paymentRoutes);
app.use("/api/download", downloadRoutes);

/* =========================================================
   SEO: CHECKOUT SHOULD NOT BE INDEXED
========================================================= */

app.get(/^\/checkout\/?$/, (req, res, next) => {
  res.setHeader(
    "X-Robots-Tag",
    "noindex, follow"
  );

  next();
});

/* =========================================================
   STATIC REACT FRONTEND
========================================================= */

app.use(express.static(frontendPath));

/* =========================================================
   SERVER-SIDE SEO FOR STATIC FRONTEND PAGES
========================================================= */

app.get(
  ["/", "/books", "/terms", "/privacy", "/refund"],
  (req, res, next) => {
    const meta = PAGE_META[req.path];

    if (!meta) {
      return next();
    }

    const url =
      `https://tresco.firm.in${req.path}`;

    const image =
      `https://tresco.firm.in${meta.image}`;

    const head = buildSocialMeta({
      title: meta.title,
      description: meta.description,
      url,
      image,
      type: meta.type,
    });

    const html = fs
      .readFileSync(
        path.join(frontendPath, "index.html"),
        "utf8"
      )
      .replace(
        /<!--SEO_START-->[\s\S]*?<!--SEO_END-->/,
        `<!--SEO_START-->${head}<!--SEO_END-->`
      );

    res.send(html);
  }
);

/* =========================================================
   SERVER-SIDE SEO FOR BOOK PAGES
========================================================= */

app.get("/books/:slug", (req, res, next) => {
  const meta = BOOK_META[req.params.slug];

  /*
    If the book slug does not exist, continue to the
    general 404 handling instead of serving a valid page.
  */
  if (!meta) {
    return next();
  }

  const url =
    `https://tresco.firm.in/books/${req.params.slug}`;

  const image =
    `https://tresco.firm.in${meta.image}`;

  const head = `
    <title>${escapeHtml(meta.title)}</title>

    <meta
      name="description"
      content="${escapeHtml(meta.description)}"
    />

    <link
      rel="canonical"
      href="${escapeHtml(url)}"
    />

    <meta
      property="og:type"
      content="product"
    />

    <meta
      property="og:title"
      content="${escapeHtml(meta.title)}"
    />

    <meta
      property="og:description"
      content="${escapeHtml(meta.description)}"
    />

    <meta
      property="og:url"
      content="${escapeHtml(url)}"
    />

    <meta
      property="og:image"
      content="${escapeHtml(image)}"
    />

    <meta
      property="og:site_name"
      content="Business Playbook"
    />

    <meta
      name="twitter:card"
      content="summary_large_image"
    />

    <meta
      name="twitter:title"
      content="${escapeHtml(meta.title)}"
    />

    <meta
      name="twitter:description"
      content="${escapeHtml(meta.description)}"
    />

    <meta
      name="twitter:image"
      content="${escapeHtml(image)}"
    />
  `;

  const html = fs
    .readFileSync(
      path.join(frontendPath, "index.html"),
      "utf8"
    )
    .replace(
      /<!--SEO_START-->[\s\S]*?<!--SEO_END-->/,
      `<!--SEO_START-->${head}<!--SEO_END-->`
    );

  res.send(html);
});

/* =========================================================
   VALID REACT ROUTES
========================================================= */

/*
  These are valid frontend routes that must receive
  index.html with HTTP 200 so React Router can render them.

  Unknown routes must NOT be handled here.
*/

const VALID_FRONTEND_ROUTES = new Set([
  "/",
  "/books",
  "/checkout",
  "/terms",
  "/privacy",
  "/refund",
]);

app.get(/^\/(?!api(?:\/|$)).*/, (req, res, next) => {
  /*
    Exact static pages are already handled above.
  */

  if (VALID_FRONTEND_ROUTES.has(req.path)) {
    return res.sendFile(
      path.join(frontendPath, "index.html")
    );
  }

  /*
    Valid dynamic book routes.

    Only the three known book slugs are allowed.
  */

  if (
    req.path.startsWith("/books/")
  ) {
    const slug =
      req.path.split("/")[2];

    if (BOOK_META[slug]) {
      return res.sendFile(
        path.join(frontendPath, "index.html")
      );
    }

    return next();
  }

  /*
    Everything else is an unknown frontend URL.
  */

  next();
});

/* =========================================================
   API 404
========================================================= */

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({
      success: false,
      message: "API route not found",
      path: req.path,
    });
  }

  next();
});

/* =========================================================
   GENERAL 404
========================================================= */

app.use((req, res) => {
  res.status(404).sendFile(
    path.join(frontendPath, "index.html")
  );
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((err, req, res, next) => {
  console.error("❌ Server error:");
  console.error(err);

  if (req.path.startsWith("/api")) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }

  res.status(500).send(
    "Internal server error"
  );
});

/* =========================================================
   EXPORT
========================================================= */

module.exports = app;