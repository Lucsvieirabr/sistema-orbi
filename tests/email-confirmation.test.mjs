import test from 'node:test';
import assert from 'node:assert/strict';

import {
  callbackAlreadyConfirmedEmail,
  readConfirmationLink,
} from '../src/services/auth/email-confirmation-link.ts';

function location(search = '', hash = '') {
  return { search, hash };
}

test('recognizes a valid PKCE callback as an already confirmed email', () => {
  const link = readConfirmationLink(location('?code=accepted-by-gotrue'));

  assert.deepEqual(link, { kind: 'code', code: 'accepted-by-gotrue' });
  assert.equal(callbackAlreadyConfirmedEmail(link), true);
});

test('does not present an explicit expired callback as confirmed', () => {
  const link = readConfirmationLink(location('?error=access_denied&error_code=otp_expired'));

  assert.deepEqual(link, { kind: 'error', code: 'otp_expired' });
  assert.equal(callbackAlreadyConfirmedEmail(link), false);
});

test('gives callback errors precedence over a stale code', () => {
  const link = readConfirmationLink(location('?code=stale&error_code=otp_expired'));

  assert.deepEqual(link, { kind: 'error', code: 'otp_expired' });
});

test('reads token_hash callbacks without treating them as pre-verified', () => {
  const link = readConfirmationLink(location('', '#token_hash=signup-token&type=signup'));

  assert.deepEqual(link, { kind: 'token_hash', tokenHash: 'signup-token' });
  assert.equal(callbackAlreadyConfirmedEmail(link), false);
});
