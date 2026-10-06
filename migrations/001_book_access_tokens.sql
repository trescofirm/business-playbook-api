CREATE TABLE book_access_tokens (
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
);