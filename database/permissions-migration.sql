-- B4-Class: run this once on an existing database.
CREATE TABLE IF NOT EXISTS user_permissions(
  user_id BIGINT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  granted_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,permission_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY(granted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO permissions(code,label) VALUES
('MANAGE_ADMINS','Manage admins');

INSERT IGNORE INTO role_permissions(role,permission_id)
SELECT 'SUPER_ADMIN',id FROM permissions;