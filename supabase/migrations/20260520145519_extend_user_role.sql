-- Extend user_role enum with cs_head (Head de CS/CX) and dev (Desenvolvedor)
-- Keeps admin/supervisor/attendant/producao untouched for backwards compatibility.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cs_head';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dev';
