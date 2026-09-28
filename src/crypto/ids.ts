// Room and record ids are opaque. Restricting their characters keeps the AAD string
// unambiguous (no "|" or ":" can sneak in) and keeps ids safe to put in a URL path.
const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}

export function newId(): string {
  return crypto.randomUUID();
}
