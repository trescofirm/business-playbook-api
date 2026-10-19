"use strict";

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const { pool } = require("../config/db");

const {
  hashBookAccessToken,
} = require("../services/bookAccessService");

/* =========================================================
   BOOK FILE SOURCE OF TRUTH
=========================================================

   The customer can never choose an arbitrary file path.

   Only these predefined product IDs are allowed.

========================================================= */

const BOOK_FILES = {
  "how-to-attract-women": {
    filename: "how-to-attract-women.pdf",
  },

  "dopamine-detox": {
    filename: "dopamine-detox.pdf",
  },

  "unlock-focus": {
    filename: "unlock-focus.pdf",
  },
};




async function getBookAccess(req, res) {
  let connection;

  try {
    const { token } = req.params;

    // 1. Validate the access token.
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        success: false,
        message: "Invalid access token.",
      });
    }

    const tokenHash = hashBookAccessToken(token);

    // 2. Find the access token and its associated order.
    const [accessRows] = await pool.execute(
      `
        SELECT
          bat.id AS access_token_id,
          bat.order_id,
          bat.expires_at AS access_expires_at,
          o.order_number,
          o.status AS order_status
        FROM book_access_tokens bat
        INNER JOIN orders o
          ON o.id = bat.order_id
        WHERE bat.token_hash = ?
        LIMIT 1
      `,
      [tokenHash]
    );

    if (accessRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired access link.",
      });
    }

    const access = accessRows[0];

    // 3. Only paid orders can access purchased books.
    if (access.order_status !== "PAID") {
      return res.status(403).json({
        success: false,
        message: "Book access is not available.",
      });
    }

    // 4. Check whether the access link has expired.
    if (
      !access.access_expires_at ||
      new Date(access.access_expires_at).getTime() <= Date.now()
    ) {
      return res.status(410).json({
        success: false,
        message: "This book access link has expired.",
      });
    }

    // 5. Retrieve the actual items belonging to this order.
    const [items] = await pool.execute(
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
      [access.order_id]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No purchased books were found for this order.",
        books: [],
      });
    }

    // 6. Confirm every purchased product has a permitted PDF.
    for (const item of items) {
      if (!BOOK_FILES[item.product_id]) {
        console.error(
          "No configured PDF for purchased product:",
          item.product_id
        );

        return res.status(500).json({
          success: false,
          message: "A purchased book is not configured for download.",
        });
      }
    }

    const backendUrl = (
      process.env.BACKEND_PUBLIC_URL ||
      `http://localhost:${process.env.PORT || 5000}`
    ).replace(/\/$/, "");

    const downloadExpiryDays = Math.max(
      1,
      Number(process.env.DOWNLOAD_TOKEN_EXPIRY_DAYS || 30)
    );

    const configuredExpiry = Date.now() +
      downloadExpiryDays * 24 * 60 * 60 * 1000;

    const accessExpiry = new Date(
      access.access_expires_at
    ).getTime();

    // Download links cannot outlive the parent access link.
    const expiresAt = new Date(
      Math.min(configuredExpiry, accessExpiry)
    );

    // 7. Create fresh, hashed download tokens for the purchased books.
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const books = [];

    for (const item of items) {
      const rawDownloadToken = crypto
        .randomBytes(32)
        .toString("hex");

      const downloadTokenHash = crypto
        .createHash("sha256")
        .update(rawDownloadToken)
        .digest("hex");

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
          downloadTokenHash,
          expiresAt,
        ]
      );

      const downloadUrl =
        `${backendUrl}/api/download/${rawDownloadToken}`;

      books.push({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        title: item.product_name,
        price: Number(item.price),
        download_url: downloadUrl,
        downloadUrl,
        expires_at: expiresAt.toISOString(),
        max_downloads: 5,
      });
    }

    // 8. Record that the access link was used.
    await connection.execute(
      `
        UPDATE book_access_tokens
        SET last_used_at = NOW()
        WHERE id = ?
      `,
      [access.access_token_id]
    );

    await connection.commit();

    // 9. Return the purchased books to the frontend.
    res.setHeader("Cache-Control", "private, no-store");

    return res.status(200).json({
      success: true,
      message: "Purchased books loaded successfully.",
      orderNumber: access.order_number,
      books,
      items: books,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Book access rollback error:",
          rollbackError
        );
      }
    }

    console.error("Get book access error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load purchased books.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}











/* =========================================================
   DOWNLOAD BOOK
========================================================= */

const downloadBook = async (
  req,
  res
) => {
  try {

    /*
    |--------------------------------------------------------------------------
    | GET TOKEN
    |--------------------------------------------------------------------------
    */

    const token =
      String(
        req.params.token || ""
      ).trim();


    /*
    |--------------------------------------------------------------------------
    | BASIC TOKEN VALIDATION
    |--------------------------------------------------------------------------
    |
    | Tokens generated by paymentController are 32 random bytes
    | represented as hexadecimal:
    |
    | 32 bytes × 2 = 64 characters
    |
    |--------------------------------------------------------------------------
    */

    if (
      !/^[a-fA-F0-9]{64}$/.test(
        token
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid download link",
      });
    }


    /*
    |--------------------------------------------------------------------------
    | HASH CUSTOMER TOKEN
    |--------------------------------------------------------------------------
    |
    | The raw token is never stored in the database.
    | Only SHA-256(token) is stored.
    |
    |--------------------------------------------------------------------------
    */

    const tokenHash =
      crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");


    /*
    |--------------------------------------------------------------------------
    | FIND DOWNLOAD TOKEN
    |--------------------------------------------------------------------------
    */

    const [rows] =
      await pool.execute(
        `
        SELECT
          dt.id AS download_token_id,
          dt.expires_at,
          dt.download_count,
          dt.max_downloads,

          oi.id AS order_item_id,
          oi.product_id,
          oi.product_name,

          o.id AS order_id,
          o.order_number,
          o.status AS order_status

        FROM download_tokens dt

        INNER JOIN order_items oi
          ON oi.id = dt.order_item_id

        INNER JOIN orders o
          ON o.id = oi.order_id

        WHERE dt.token_hash = ?

        LIMIT 1
        `,
        [tokenHash]
      );


    /*
    |--------------------------------------------------------------------------
    | TOKEN NOT FOUND
    |--------------------------------------------------------------------------
    */

    if (
      rows.length === 0
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Download link is invalid or has expired",
      });
    }


    const download =
      rows[0];


    /*
    |--------------------------------------------------------------------------
    | PAYMENT STATUS
    |--------------------------------------------------------------------------
    */

    if (
      download.order_status !==
      "PAID"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Payment is not completed",
      });
    }


    /*
    |--------------------------------------------------------------------------
    | EXPIRY CHECK
    |--------------------------------------------------------------------------
    */

    if (
      download.expires_at &&
      new Date(
        download.expires_at
      ).getTime() <= Date.now()
    ) {
      return res.status(410).json({
        success: false,
        message:
          "Download link has expired",
      });
    }


    /*
    |--------------------------------------------------------------------------
    | BASIC DOWNLOAD LIMIT CHECK
    |--------------------------------------------------------------------------
    */

    if (
      Number(
        download.download_count
      ) >=
      Number(
        download.max_downloads
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Download limit reached",
      });
    }


    /*
    |--------------------------------------------------------------------------
    | GET PREDEFINED BOOK FILE
    |--------------------------------------------------------------------------
    */

    const book =
      BOOK_FILES[
        download.product_id
      ];


    if (!book) {
      return res.status(404).json({
        success: false,
        message:
          "Book file not found",
      });
    }


    /*
    |--------------------------------------------------------------------------
    | BUILD FILE PATH
    |--------------------------------------------------------------------------
    |
    | Only the predefined filename above is used.
    |
    |--------------------------------------------------------------------------
    */

    const booksDirectory =
      path.resolve(
        __dirname,
        "../../storage/books"
      );

    const filePath =
      path.resolve(
        booksDirectory,
        book.filename
      );


    /*
    |--------------------------------------------------------------------------
    | EXTRA PATH SAFETY
    |--------------------------------------------------------------------------
    */

    if (
      !filePath.startsWith(
        `${booksDirectory}${path.sep}`
      )
    ) {
      console.error(
        "Blocked invalid book path:",
        filePath
      );

      return res.status(403).json({
        success: false,
        message:
          "Invalid book file",
      });
    }


    /*
    |--------------------------------------------------------------------------
    | CHECK FILE EXISTS
    |--------------------------------------------------------------------------
    */

    if (
      !fs.existsSync(filePath)
    ) {
      console.error(
        "Book file missing:",
        filePath
      );

      return res.status(404).json({
        success: false,
        message:
          "Book file is currently unavailable",
      });
    }


    /*
    |--------------------------------------------------------------------------
    | ATOMIC DOWNLOAD COUNT UPDATE
    |--------------------------------------------------------------------------
    |
    | This is important.
    |
    | Instead of:
    |
    |   SELECT count
    |   then UPDATE count
    |
    | multiple simultaneous requests could potentially pass
    | the limit check.
    |
    | This UPDATE reserves one download slot atomically.
    |
    |--------------------------------------------------------------------------
    */

    const [updateResult] =
      await pool.execute(
        `
        UPDATE download_tokens
        SET
          download_count =
            download_count + 1,
          last_downloaded_at =
            NOW()
        WHERE
          id = ?
          AND download_count < max_downloads
          AND (
            expires_at IS NULL
            OR expires_at > NOW()
          )
        `,
        [
          download.download_token_id,
        ]
      );


    /*
    |--------------------------------------------------------------------------
    | DOWNLOAD SLOT NOT AVAILABLE
    |--------------------------------------------------------------------------
    */

    if (
      updateResult.affectedRows !== 1
    ) {

      /*
      | Re-check the current state so we can return
      | the correct reason.
      */

      const [currentRows] =
        await pool.execute(
          `
          SELECT
            expires_at,
            download_count,
            max_downloads
          FROM download_tokens
          WHERE id = ?
          LIMIT 1
          `,
          [
            download.download_token_id,
          ]
        );


      if (
        currentRows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Download link is invalid",
        });
      }


      const current =
        currentRows[0];


      if (
        current.expires_at &&
        new Date(
          current.expires_at
        ).getTime() <= Date.now()
      ) {
        return res.status(410).json({
          success: false,
          message:
            "Download link has expired",
        });
      }


      if (
        Number(
          current.download_count
        ) >=
        Number(
          current.max_downloads
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Download limit reached",
        });
      }


      return res.status(403).json({
        success: false,
        message:
          "Download is currently unavailable",
      });
    }


    /*
    |--------------------------------------------------------------------------
    | DOWNLOAD HEADERS
    |--------------------------------------------------------------------------
    */

    res.setHeader(
      "Cache-Control",
      "private, no-store, max-age=0"
    );


    /*
    |--------------------------------------------------------------------------
    | SEND PDF
    |--------------------------------------------------------------------------
    */

    res.download(
      filePath,
      book.filename,
      (error) => {

        if (error) {
          console.error(
            "File download error:",
            error
          );


          /*
          |------------------------------------------------------------------
          | Optional recovery
          |------------------------------------------------------------------
          |
          | If sending the file fails before completion, give the customer
          | the reserved slot back.
          |
          | The condition prevents the count from exceeding zero.
          |
          |------------------------------------------------------------------
          */

          pool.execute(
            `
            UPDATE download_tokens
            SET
              download_count =
                CASE
                  WHEN download_count > 0
                  THEN download_count - 1
                  ELSE 0
                END
            WHERE id = ?
            `,
            [
              download.download_token_id,
            ]
          ).catch(
            (rollbackError) => {
              console.error(
                "Download count rollback error:",
                rollbackError
              );
            }
          );
        }
      }
    );

  } catch (error) {

    /*
    |--------------------------------------------------------------------------
    | INTERNAL ERROR
    |--------------------------------------------------------------------------
    */

    console.error(
      "Download controller error:",
      error
    );


    /*
    | Avoid returning an error response after download
    | headers have already been sent.
    */

    if (
      !res.headersSent
    ) {
      return res.status(500).json({
        success: false,
        message:
          "Unable to download the book",
      });
    }
  }
};


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  downloadBook,
  getBookAccess,
};