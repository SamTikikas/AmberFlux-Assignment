-- ===============================================
-- MERN Screen Recorder - Database Setup Script
-- ===============================================

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS media_recorder_db
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE media_recorder_db;

-- Drop existing table if you want to reset (uncomment the line below)
-- DROP TABLE IF EXISTS recordings;

-- Create recordings table with proper schema
CREATE TABLE IF NOT EXISTS recordings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL COMMENT 'Original filename of the recording',
    size BIGINT NOT NULL COMMENT 'File size in bytes',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When the recording was uploaded',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modified timestamp',
    
    -- Add indexes for better performance
    INDEX idx_created_at (created_at),
    INDEX idx_filename (filename),
    INDEX idx_size (size)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Table to store screen recording metadata';

-- Insert sample data (optional - remove if not needed)
INSERT INTO recordings (filename, size) VALUES 
('sample-recording-1.webm', 1048576),
('sample-recording-2.webm', 2097152),
('demo-screen-capture.webm', 5242880);

-- Display table structure
DESCRIBE recordings;

-- Show created table
SHOW TABLES;

-- Count records
SELECT COUNT(*) as total_recordings FROM recordings;

-- Display all recordings
SELECT 
    id,
    filename,
    ROUND(size / 1024 / 1024, 2) as size_mb,
    created_at,
    updated_at
FROM recordings 
ORDER BY created_at DESC;

-- Success message
SELECT 'Database setup completed successfully!' as message;

-- ===============================================
-- Additional Queries for Development/Testing
-- ===============================================

-- Query to check file sizes
SELECT 
    filename,
    CASE 
        WHEN size < 1024 THEN CONCAT(size, ' B')
        WHEN size < 1048576 THEN CONCAT(ROUND(size/1024, 1), ' KB')
        WHEN size < 1073741824 THEN CONCAT(ROUND(size/1048576, 1), ' MB')
        ELSE CONCAT(ROUND(size/1073741824, 1), ' GB')
    END as formatted_size,
    created_at
FROM recordings
ORDER BY size DESC;

-- Query to get recordings from last 7 days
SELECT * FROM recordings 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY created_at DESC;

-- Query to get average file size
SELECT 
    COUNT(*) as total_recordings,
    ROUND(AVG(size) / 1048576, 2) as avg_size_mb,
    ROUND(SUM(size) / 1048576, 2) as total_size_mb
FROM recordings;

-- ===============================================
-- Maintenance Queries (Use with caution)
-- ===============================================

-- Delete recordings older than 30 days (uncomment to use)
-- DELETE FROM recordings WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Delete all recordings (uncomment to use)
-- DELETE FROM recordings;

-- Reset auto increment (uncomment to use)
-- ALTER TABLE recordings AUTO_INCREMENT = 1;