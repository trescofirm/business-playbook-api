"use strict";

const SITE_URL =
  process.env.FRONTEND_PUBLIC_URL ||
  "https://tresco.firm.in";

function absoluteUrl(path) {
  if (!path) return null;

  if (
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }

  return `${SITE_URL.replace(/\/$/, "")}${path}`;
}

function buildProductSchema(book) {
  if (!book) return null;

  const productUrl =
    `${SITE_URL.replace(/\/$/, "")}/books/${book.id}`;

  const images = [
    absoluteUrl(book.images?.cover),
    absoluteUrl(book.images?.mockup),
  ].filter(Boolean);

  const schema = {
    "@context": "https://schema.org",
    "@type": ["Product", "Book"],

    name: book.title,

    description:
      book.description,

    image: images,

    url: productUrl,

    sku:
      book.sku || undefined,

    category:
      book.seo?.primaryTopic ||
      book.category ||
      undefined,

    bookFormat:
      "https://schema.org/EBook",

    inLanguage: "en",

    genre:
      book.genre ||
      undefined,

    brand: {
      "@type": "Brand",
      name: "Business Playbook",
    },

    offers: {
      "@type": "Offer",

      url: productUrl,

      priceCurrency:
        book.currency || "USD",

      price:
        Number(book.price).toFixed(2),

      availability: book.available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",

      itemCondition:
        "https://schema.org/NewCondition",
    },
  };

  if (book.author) {
    schema.author = {
      "@type": "Person",
      name: book.author,
    };
  }

  return schema;
}

module.exports = {
  buildProductSchema,
};