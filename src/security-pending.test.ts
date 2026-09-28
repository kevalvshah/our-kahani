import { describe, it } from 'vitest';

// Required by docs/SECURITY.md. They need the Supabase schema, so they are listed here as
// todo until it lands, and show up in every test report so they cannot be forgotten.
describe('server-side security tests (need Supabase)', () => {
  it.todo('isolation: two rooms; every read of the other room returns nothing');
  it.todo('reveal rule: partner ciphertext is not delivered before both have answered');
  it.todo('plaintext canary: known words written through the UI never appear in any table or bucket');
  it.todo('lifecycle: extension needs both; unkept rooms erase at the end; erased means gone');
});
