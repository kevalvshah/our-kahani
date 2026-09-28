# Security and encryption

## Goal
The developer and the host must not be able to read user content from the database, storage,
backups or logs. Only the two people in a room can.

## Design
- **Room key**: 256-bit AES-GCM key generated on the creator's device with WebCrypto.
- **Envelope**: `{v, iv(12 bytes), ct+tag}` with AAD = `room:<id>|record:<id>|type:<kind>|v1`.
  Random IV every time. Decryption fails if a ciphertext is moved or altered.
- **Invite**: `https://<host>/join/<roomId>#<key material>`. The fragment is not sent to
  servers. On join, import the key, then clear the fragment from the URL. Single-use, expires
  in about 48 hours; the room closes to a third person once two have joined.
- **Safety code**: six emoji derived from a hash of the key, shown on both phones. Compare on
  a call to detect a swapped link.
- **Recovery**: 12-word phrase, mandatory at setup, with a check that the person saved it.
  A wrapped copy of the key may be stored server-side, encrypted under a key derived from the
  phrase, so the server still cannot read it.
- **Personal notes**: each person has their own key for Saved notes; the partner never has it.
- **Key storage**: non-extractable CryptoKey in IndexedDB where possible. Safari can delete
  script-writable storage after 7 days of Safari use without interaction (Home Screen web apps
  are exempt). Ask for persistent storage and expect loss; recovery must work.
- **Media**: compress, then encrypt on the device, then upload. The server sees size and time only.
- **Downloads**: built in the browser after decrypting locally.

## What the server can see
Room exists, member count, timestamps, sizes, counts, "answered" flags, IP addresses in host
logs. Keep logs minimal and short-lived.

## Honest limits (say these to users)
- We serve the app's code. A changed version could steal keys. Mitigate: open source, strict
  CSP, no third-party scripts, pinned dependencies, reproducible builds later.
- The invite link carries the key. Whoever can read the message it is sent in could copy it.
  Prefer an end-to-end encrypted chat or reading it aloud. Instagram DMs were not end-to-end
  encrypted by default as far as we know; verify. Instagram's in-app browser has been reported
  to inject scripts; require Safari or Chrome.
- Screenshots, unlocked phones, shoulder-surfing are out of scope.
- If keys and recovery phrase are both lost, data is gone.

## Tests that must exist
1. Crypto: right key opens, wrong key fails, tampering fails, AAD swap fails, same text gives
   different ciphertext.
2. Isolation: two rooms; every read of the other room returns nothing.
3. Reveal rule: partner ciphertext is not delivered before both have answered.
4. Plaintext canary: write known words through the UI, dump every table and storage bucket,
   fail the build if any canary appears.
5. Lifecycle: extension needs both; unkept rooms erase at the end; erased means gone.
