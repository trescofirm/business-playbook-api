"use strict";

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(
    process.env.DB_PORT || 3306
  ),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});


async function testDatabaseConnection() {
  const connection =
    await pool.getConnection();

  try {
        try {
      const schema = [
        `CREATE TABLE IF NOT EXISTS customers (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          email VARCHAR(255) NOT NULL,
          country VARCHAR(100) NOT NULL,
          state VARCHAR(100) DEFAULT NULL,
          notes TEXT DEFAULT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT NULL,
          PRIMARY KEY (id),
          KEY idx_customers_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS orders (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          order_number VARCHAR(50) NOT NULL,
          customer_id INT UNSIGNED NOT NULL,
          subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          coupon_code VARCHAR(50) DEFAULT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'USD',
          razorpay_order_id VARCHAR(100) DEFAULT NULL,
          razorpay_payment_id VARCHAR(100) DEFAULT NULL,
          razorpay_signature VARCHAR(255) DEFAULT NULL,
          paypal_order_id VARCHAR(255) DEFAULT NULL,
          paypal_capture_id VARCHAR(255) DEFAULT NULL,
          status ENUM('PENDING','PAID','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          paid_at DATETIME DEFAULT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY order_number (order_number),
          KEY idx_orders_customer (customer_id),
          KEY idx_orders_status (status),
          KEY idx_orders_payment (razorpay_payment_id),
          CONSTRAINT orders_ibfk_1 FOREIGN KEY (customer_id) REFERENCES customers (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS order_items (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          order_id BIGINT UNSIGNED NOT NULL,
          product_id VARCHAR(100) NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_order_items_order (order_id),
          KEY idx_order_items_product (product_id),
          CONSTRAINT order_items_ibfk_1 FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS download_tokens (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          order_item_id BIGINT UNSIGNED NOT NULL,
          token_hash CHAR(64) NOT NULL,
          expires_at DATETIME DEFAULT NULL,
          download_count INT UNSIGNED NOT NULL DEFAULT 0,
          max_downloads INT UNSIGNED NOT NULL DEFAULT 5,
          last_downloaded_at DATETIME DEFAULT NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY token_hash (token_hash),
          KEY order_item_id (order_item_id),
          CONSTRAINT download_tokens_ibfk_1 FOREIGN KEY (order_item_id) REFERENCES order_items (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

        `CREATE TABLE IF NOT EXISTS book_access_tokens (
          id BIGINT NOT NULL AUTO_INCREMENT,
          order_id BIGINT NOT NULL,
          token_hash CHAR(64) NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_used_at DATETIME NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uq_book_access_token_hash (token_hash),
          KEY idx_book_access_order_id (order_id),
          KEY idx_book_access_expires_at (expires_at)
        )`,
      ];

      for (const statement of schema) {
        await connection.query(statement);
      }

      console.log("✅ Database tables ready");
    } catch (schemaError) {
      console.error(
        "Could not create database tables:",
        schemaError.message
      );
    }

    console.log(
      "✅ MySQL database connected successfully"
    );
  } finally {
    connection.release();
  }
}


module.exports = {
  pool,
  testDatabaseConnection,
};