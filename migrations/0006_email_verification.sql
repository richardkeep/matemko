-- NULL until the learner (or their grown-up) clicks the link we send
ALTER TABLE auth_users ADD COLUMN email_verified_at INTEGER;
