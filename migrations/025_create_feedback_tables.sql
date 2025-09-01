-- Create feedback table for storing user feedback
CREATE TABLE IF NOT EXISTS feedback (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  household_id INT,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  category ENUM('bug', 'feature_request', 'general', 'praise') DEFAULT 'general',
  message TEXT,
  page_context VARCHAR(255) NOT NULL,
  user_agent VARCHAR(500),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('new', 'reviewed', 'actioned', 'closed') DEFAULT 'new',
  admin_notes TEXT,
  reviewed_at TIMESTAMP NULL,
  reviewed_by INT NULL,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_created_at (created_at),
  INDEX idx_status (status),
  INDEX idx_user_id (user_id),
  INDEX idx_rating (rating)
);

-- Create feedback_responses table for admin responses
CREATE TABLE IF NOT EXISTS feedback_responses (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  feedback_id INT NOT NULL,
  admin_id INT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert migration record
INSERT INTO schema_migrations (version, executed_at) VALUES ('025_create_feedback_tables', NOW());