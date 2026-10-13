-- CredKeep PostgreSQL Database Initialization
-- Provisions the restricted application role (credkeep_app) for Row Level Security (RLS) enforcement.
-- This script runs automatically only when the database volume is first initialized.

\getenv app_user APP_DB_USER
\getenv app_pass APP_DB_PASSWORD

-- Fallback to default user name if APP_DB_USER is unset
\if :{?app_user}
\else
  \set app_user 'credkeep_app'
\endif

-- Idempotently create or update the application role with restricted privileges
SELECT format(
  'DO $do$ BEGIN ' ||
  '  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = %L) THEN ' ||
  '    CREATE ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; ' ||
  '  ELSE ' ||
  '    ALTER ROLE %I WITH PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; ' ||
  '  END IF; ' ||
  'END $do$;',
  :'app_user', :'app_user', :'app_pass', :'app_user', :'app_pass'
) \gexec

-- Grant connect on the active database
SELECT format('GRANT CONNECT ON DATABASE %I TO %I;', current_database(), :'app_user') \gexec

-- Grant schema usage on public (schema ownership remains with postgres)
SELECT format('GRANT USAGE ON SCHEMA public TO %I;', :'app_user') \gexec

-- Grant DML privileges on existing tables in public schema
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I;', :'app_user') \gexec

-- Grant least-privilege sequence usage on existing sequences (USAGE, SELECT for nextval/currval)
SELECT format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I;', :'app_user') \gexec

-- Configure default privileges for future objects created by postgres during migrations
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I;', :'app_user') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I;', :'app_user') \gexec
