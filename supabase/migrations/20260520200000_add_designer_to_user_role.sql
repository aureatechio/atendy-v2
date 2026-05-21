-- Adds 'designer' to the user_role enum.
-- Created to accommodate users who handle visual/UX work but are not part
-- of the broader `producao` role.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'designer';
