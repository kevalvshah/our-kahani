import { describe, it } from 'vitest';

// Required by docs/SECURITY.md. Isolation, the reveal rule, joining and erase are tested inside
// the database by supabase/tests/rls.sql (run against the project in CI). Still to come:
describe('server-side security tests still to add', () => {
  it.todo('plaintext canary: known words written through the UI never appear in any table or bucket');
  it.todo('lifecycle: extension needs both; unkept rooms erase at the end; erased means gone');
});
