-- Additive FlowTrack tables only. Run in a dedicated Hostinger MySQL database.
CREATE TABLE IF NOT EXISTS ft_users (
 id CHAR(32) PRIMARY KEY,
 email VARCHAR(254) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 registered_at BIGINT NOT NULL,
 trial_ends_at BIGINT NOT NULL,
 verified_at BIGINT NULL,
 paid_until BIGINT NULL,
 is_admin TINYINT NOT NULL DEFAULT 0,
 CONSTRAINT ft_trial_duration CHECK (trial_ends_at = registered_at + 2592000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS ft_sessions (
 id CHAR(64) PRIMARY KEY,
 user_id CHAR(32) NULL,
 csrf CHAR(64) NOT NULL,
 created_at BIGINT NOT NULL,
 last_seen_at BIGINT NOT NULL,
 expires_at BIGINT NOT NULL,
 admin_verified_at BIGINT NULL,
 INDEX ft_session_user(user_id),
 INDEX ft_session_expiry(expires_at),
 FOREIGN KEY(user_id) REFERENCES ft_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS ft_tokens (
 id CHAR(32) PRIMARY KEY,
 user_id CHAR(32) NOT NULL,
 purpose VARCHAR(10) NOT NULL,
 token_hash CHAR(64) NOT NULL,
 session_id CHAR(64) NULL,
 expires_at BIGINT NOT NULL,
 used_at BIGINT NULL,
 INDEX ft_token_lookup(purpose,token_hash),
 INDEX ft_token_user(user_id,purpose),
 FOREIGN KEY(user_id) REFERENCES ft_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS ft_payments (
 id CHAR(32) PRIMARY KEY,
 user_id CHAR(32) NOT NULL,
 provider VARCHAR(60) NOT NULL,
 reference VARCHAR(100) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 sender_number VARCHAR(40) NOT NULL,
 amount INTEGER NOT NULL,
 currency CHAR(3) NOT NULL,
 status VARCHAR(10) NOT NULL,
 submitted_at BIGINT NOT NULL,
 reviewed_at BIGINT NULL,
 reviewed_by CHAR(32) NULL,
 review_note VARCHAR(500) NULL,
 access_until BIGINT NULL,
 UNIQUE KEY ft_unique_reference(provider,reference),
 INDEX ft_payment_history(user_id,submitted_at),
 INDEX ft_pending(status,submitted_at),
 FOREIGN KEY(user_id) REFERENCES ft_users(id),
 FOREIGN KEY(reviewed_by) REFERENCES ft_users(id),
 CONSTRAINT ft_payment_status CHECK(status IN ('pending','approved','rejected')),
 CONSTRAINT ft_payment_amount CHECK(amount > 0),
 CONSTRAINT ft_review_state CHECK((status='pending' AND reviewed_at IS NULL AND reviewed_by IS NULL) OR (status<>'pending' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS ft_rate_limits (
 bucket CHAR(64) PRIMARY KEY,
 hits INTEGER NOT NULL,
 expires_at BIGINT NOT NULL,
 INDEX ft_rate_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS ft_audit (
 id CHAR(32) PRIMARY KEY,
 actor_id CHAR(32) NULL,
 action VARCHAR(32) NOT NULL,
 payment_id CHAR(32) NULL,
 created_at BIGINT NOT NULL,
 INDEX ft_audit_time(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
