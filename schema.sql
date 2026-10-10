-- WebSound Academy database (MySQL)
-- Use this ONLY if you want a fresh empty database.
-- If you already have data on InfinityFree, export it from phpMyAdmin and import that file instead.
-- These tables were rebuilt from what your PHP code reads and writes, so check them against your old tables.

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  reset_token_hash VARCHAR(64) NULL,
  reset_expires DATETIME NULL,
  reset_attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_name VARCHAR(190) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NULL,
  thumbnail_url VARCHAR(500) NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_free TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS course_content (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_name VARCHAR(190) NOT NULL,
  lesson_title VARCHAR(190) NOT NULL,
  content_type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '',
  youtube_url VARCHAR(500) NOT NULL DEFAULT '',
  youtube_id VARCHAR(50) NOT NULL DEFAULT '',
  thumbnail_url VARCHAR(500) NOT NULL DEFAULT '',
  content_text MEDIUMTEXT NULL,
  external_url VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_course_name (course_name)
) CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS course_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_content_id INT NOT NULL,
  note_title VARCHAR(255) NOT NULL,
  note_content VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_content (course_content_id)
) CHARACTER SET utf8mb4;
