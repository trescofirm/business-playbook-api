"use strict";

const express = require("express");
const helmet = require("helmet");
const path = require("path");

const fs = require("fs");

const {
  buildProductSchema,
} = require("./seo/productSchema");

const {
  buildBookBreadcrumbSchema,
} = require("./seo/breadcrumbSchema");

const paymentRoutes = require("./routes/paymentRoutes");
const paypalRoutes = require("./routes/paypalRoutes");
const downloadRoutes = require("./routes/downloadRoutes");

const app = express();

app.disable(
  "x-powered-by"
);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

const {
  apiLimiter,
} = require("./middleware/rateLimiters");

const trustProxyHops =
  Number(
    process.env.TRUST_PROXY_HOPS || 0
  );

if (
  Number.isInteger(trustProxyHops) &&
  trustProxyHops > 0
) {
  app.set(
    "trust proxy",
    trustProxyHops
  );
}



const GUIDE_META = {
  "how-to-build-social-confidence": {
    title:
      "How to Build Social Confidence | Business Playbook",

    description:
      "Practical ways to build social confidence, improve communication and create stronger connections.",

    image:
      "/images/og-image.png",
  },

  "how-to-build-a-social-circle": {
    title:
      "How to Build a Stronger Social Circle | Business Playbook",

    description:
      "Learn practical ways to meet people, build meaningful connections and become more socially confident.",

    image:
      "/images/og-image.png",
  },

  "how-to-reduce-phone-distractions": {
    title:
      "How to Reduce Phone Distractions | Business Playbook",

    description:
      "Practical strategies for reducing phone interruptions, limiting screen distractions and protecting your attention.",

    image:
      "/images/og-image.png",
  },

  "dopamine-detox-for-students": {
    title:
      "Dopamine Detox for Students | Business Playbook",

    description:
      "A practical approach to reducing digital distractions and creating better study habits.",

    image:
      "/images/og-image.png",
  },

  "how-to-improve-focus-and-concentration": {
    title:
      "How to Improve Focus and Concentration | Business Playbook",

    description:
      "Practical strategies for reducing distractions, protecting your attention and building more consistent focus.",

    image:
      "/images/og-image.png",
  },

  "how-to-stop-multitasking": {
    title:
      "How to Stop Multitasking and Improve Focus | Business Playbook",

    description:
      "Understand task switching and learn practical ways to protect your attention and improve focused work.",

    image:
      "/images/og-image.png",
  },
};


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

    image: "/images/og-image.png",

    type: "website",
  },

  "/books": {
    title: "Books | Business Playbook",

    description:
      "Explore practical books for confidence, focus, habits, productivity and personal growth.",

    image: "/images/og-image.png",

    type: "website",
  },

  "/terms": {
    title: "Terms & Conditions | Business Playbook",

    description:
      "Read the terms and conditions governing purchases and use of Business Playbook.",

    image: "/images/og-image.png",

    type: "website",
  },

  "/privacy": {
    title: "Privacy Policy | Business Playbook",

    description:
      "Read the Business Playbook privacy policy and learn how information is handled.",

    image: "/images/og-image.png",

    type: "website",
  },

  "/refund": {
    title: "Refund Policy | Business Playbook",

    description:
      "Read the Business Playbook refund and cancellation policy.",

    image: "/images/og-image.png",

    type: "website",
  },
};

/* =========================================================
   BOOK SEO METADATA
========================================================= */

const BOOK_META = {
  "how-to-attract-women": {
    title:
      "How to Attract Women | Confidence & Social Skills Guide",

    description:
      "A practical guide to building confidence, improving social skills and creating genuine connections. Instant PDF download.",

    image:
      "/images/books/how-to-attract-women-cover.jpeg",

    mockup:
      "/images/books/how-to-attract-women-cover.jpeg",

    product: {
      name:
        "How to Attract Women",

      description:
        "A practical guide focused on confidence, communication, social skills and building genuine connections.",

      sku:
        "BP-HTAW",

      price:
        19.99,

      currency:
        "USD",

      available:
        true,

      author:
        "Vishal Kumar",

      category:
        "Confidence & Social Skills",

      genre:
        "Self-Help",
    },
  },

  "dopamine-detox": {
    title:
      "30 Day Dopamine Detox Workbook | Focus & Study Habits",

    description:
      "A practical 30-day workbook for reducing phone distractions, improving digital habits and building more consistent study focus.",

    image:
      "/images/books/dopamine-detox.jpeg",

    mockup:
      "/images/books/book2-mockup.jpeg",

    product: {
      name:
        "30 Day Dopamine Detox Workbook",

      description:
        "A 30-day workbook designed to help reduce digital distractions, build better routines and support more consistent focus.",

      sku:
        "BP-DD30",

      price:
        15.99,

      currency:
        "USD",

      available:
        true,

      category:
        "Dopamine Detox & Digital Distraction",

      genre:
        "Self-Help",
    },
  },

  "unlock-focus": {
    title:
      "How to Unlock Your Focus | A Guide to Beating Distraction",

    description:
      "A practical guide to improving concentration, reducing distractions and building better focus through structured strategies.",

    image:
      "/images/books/unlock-focus-cover.jpeg",

    mockup:
      "/images/books/unlock-focus.jpeg",

    product: {
      name:
        "How to Unlock Your Focus",

      description:
        "A practical guide focused on improving concentration, reducing distractions and developing better focus.",

      sku:
        "BP-UF01",

      price:
        15.99,

      currency:
        "USD",

      available:
        true,

      author:
        "Vishal Kumar",

      category:
        "Focus & Productivity",

      genre:
        "Personal Development",
    },
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
  let safePath = req.path;

  if (
    /^\/api\/download\/(?:access\/)?[a-f0-9]{64}$/i.test(
      safePath
    )
  ) {
    safePath =
      safePath.includes("/access/")
        ? "/api/download/access/[redacted]"
        : "/api/download/[redacted]";
  }

  console.log(
    `${new Date().toISOString()} ${req.method} ${safePath}`
  );

  next();
});

/* =========================================================
   Guide Page route
========================================================= */

app.get(
  "/guides/:slug",
  (req, res, next) => {
    const meta =
      GUIDE_META[req.params.slug];

    if (!meta) {
      return next();
    }

    const url =
      `https://tresco.firm.in/guides/${req.params.slug}`;

    const image =
      `https://tresco.firm.in${meta.image}`;

    const head =
      buildSocialMeta({
        title: meta.title,
        description: meta.description,
        url,
        image,
        type: "article",
      });

    const html = fs
      .readFileSync(
        path.join(
          frontendPath,
          "index.html"
        ),
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
   API HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message:
      "Business Playbook API is healthy",
    timestamp:
      new Date().toISOString(),
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
   API ROOT
========================================================= */

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "Business Playbook API is running",
  });
});

/* =========================================================
   API ROUTES
========================================================= */

/*
|------------------------------------------------------------------
| Razorpay
|------------------------------------------------------------------
*/
app.use(
  "/api",
  apiLimiter
);


app.use("/api/payment", paymentRoutes);


/*
|------------------------------------------------------------------
| PayPal
|------------------------------------------------------------------
*/

app.use("/api/paypal", paypalRoutes);


/*
|------------------------------------------------------------------
| Downloads
|------------------------------------------------------------------
*/

app.use("/api/download", downloadRoutes);

/* =========================================================
   STATIC REACT FRONTEND
========================================================= *

app.use(express.static(frontendPath));

/* =========================================================
   REACT ROUTER FALLBACK
   Do not send index.html for API URLs
========================================================= *

app.get(/^\/(?!api(?:\/|$)).*, (req, res) => {
  res.sendFile(
    path.join(frontendPath, "index.html")
  );
});
*/
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

app.get(
  /^\/my-books\/?$/,
  (req, res, next) => {
    res.setHeader(
      "X-Robots-Tag",
      "noindex, nofollow"
    );

    next();
  }
);

/* =========================================================
   STATIC REACT FRONTEND
========================================================= */

app.use(
  express.static(frontendPath, {
    index: false,
  })
);

/* =========================================================
   SERVER-SIDE SEO FOR STATIC FRONTEND PAGES
========================================================= */

app.get(
  ["/", "/books", "/terms", "/privacy", "/refund"],
  (req, res, next) => {
    const meta = PAGE_META[req.path];

    if (!meta) {
      return res.status(404).sendFile(
        path.join(frontendPath, "index.html")
      );
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

app.get(
  "/books/:slug",
  (req, res, next) => {
    const meta =
      BOOK_META[req.params.slug];

    if (!meta) {
      return next();
    }

    const url =
      `https://tresco.firm.in/books/${req.params.slug}`;

    const image =
      `https://tresco.firm.in${meta.image}`;

    const book = {
      id: req.params.slug,

      title:
        meta.product.name,

      description:
        meta.product.description,

      price:
        meta.product.price,

      currency:
        meta.product.currency,

      available:
        meta.product.available,

      author:
        meta.product.author,

      category:
        meta.product.category,

      genre:
        meta.product.genre,

      sku:
        meta.product.sku,

      images: {
        cover:
          meta.image,

        mockup:
          meta.mockup,
      },

      seo: {
        primaryTopic:
          meta.product.category,
      },
    };

    const productSchema =
      buildProductSchema(book);

    const breadcrumbSchema =
      buildBookBreadcrumbSchema(book);

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

      <script type="application/ld+json">
        ${JSON.stringify(productSchema)}
      </script>

      <script type="application/ld+json">
        ${JSON.stringify(breadcrumbSchema)}
      </script>
    `;

    const html = fs
      .readFileSync(
        path.join(
          frontendPath,
          "index.html"
        ),
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
  "/my-books",
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

app.use(
  (req, res) => {
    res.status(404).send(
      "Page not found"
    );
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((err, req, res, next) => {

  console.error(
    "❌ Server error:"
  );

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