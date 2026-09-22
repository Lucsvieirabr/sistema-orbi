import test from 'node:test';
import assert from 'node:assert/strict';

import { initialsOf, isAvatarPath, assertValidAvatarFile, AvatarFileError } from '../src/lib/avatar.ts';

const uid = '0f8fad5b-d9cb-469f-a165-70867728950e';

test('initialsOf: first + last word, accents kept, empty safe', () => {
  assert.equal(initialsOf('João Silva'), 'JS');
  assert.equal(initialsOf('  ana  '), 'A');
  assert.equal(initialsOf('élida maria de souza'), 'ÉS');
  assert.equal(initialsOf(''), '');
  assert.equal(initialsOf(null), '');
  assert.equal(initialsOf('<script>'), 'S');
});

test('isAvatarPath only accepts <uuid>/<hex32>.<ext>', () => {
  assert.ok(isAvatarPath(`${uid}/${'a'.repeat(32)}.webp`));
  assert.ok(!isAvatarPath(`${uid}/../x.webp`));
  assert.ok(!isAvatarPath(`https://evil.test/${uid}/${'a'.repeat(32)}.webp`));
  assert.ok(!isAvatarPath(`${uid}/${'a'.repeat(32)}.svg`));
});

const file = (bytes, name, type) => new File([new Uint8Array(bytes)], name, { type });
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];

test('assertValidAvatarFile checks size, extension, mime and magic bytes', async () => {
  await assertValidAvatarFile(file(PNG, 'a.png', 'image/png'));
  await assert.rejects(assertValidAvatarFile(file(PNG, 'a.png', 'image/jpeg')), AvatarFileError);
  await assert.rejects(assertValidAvatarFile(file([0x3c, 0x73, 0x76, 0x67], 'a.png', 'image/png')), AvatarFileError);
  await assert.rejects(assertValidAvatarFile(file(PNG, 'a.gif', 'image/png')), AvatarFileError);
  const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' });
  await assert.rejects(assertValidAvatarFile(big), /2 MB/);
});
