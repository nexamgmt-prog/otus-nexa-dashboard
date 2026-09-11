-- Hide tokens, ingest secrets, and password hashes from the browser anon key.
-- Service role (server) keeps full access.

revoke select (api_credentials, crm_integration) on table public.clients from anon, authenticated;
revoke insert (api_credentials, crm_integration) on table public.clients from anon, authenticated;
revoke update (api_credentials, crm_integration) on table public.clients from anon, authenticated;

revoke select (password_hash) on table public.app_users from anon, authenticated;
revoke insert (password_hash) on table public.app_users from anon, authenticated;
revoke update (password_hash) on table public.app_users from anon, authenticated;
