"use strict";

const SITE_URL =
  process.env.FRONTEND_PUBLIC_URL ||
  "https://tresco.firm.in";

function buildBookBreadcrumbSchema(book) {
  if (!book) return null;

  const baseUrl =
    SITE_URL.replace(/\/$/, "");

  return {
    "@context": "https://schema.org",

    "@type": "BreadcrumbList",

    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${baseUrl}/`,
      },

      {
        "@type": "ListItem",
        position: 2,
        name: "Books",
        item: `${baseUrl}/books`,
      },

      {
        "@type": "ListItem",
        position: 3,
        name: book.title,
        item:
          `${baseUrl}/books/${book.id}`,
      },
    ],
  };
}

module.exports = {
  buildBookBreadcrumbSchema,
};