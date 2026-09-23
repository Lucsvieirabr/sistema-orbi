import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDecimalBR, toEditable } from '../src/lib/money-input.ts';

test('parseDecimalBR: formato brasileiro, ponto decimal curto e milhar', () => {
  assert.equal(parseDecimalBR('R$ 1.500,50'), 1500.5);
  assert.equal(parseDecimalBR('1500,50'), 1500.5);
  assert.equal(parseDecimalBR('12.34'), 12.34);
  assert.equal(parseDecimalBR('5.000'), 5000);
  assert.equal(parseDecimalBR('2000'), 2000);
  assert.equal(parseDecimalBR(''), null);
  assert.equal(parseDecimalBR('abc'), null);
  assert.equal(parseDecimalBR('-1.500,50'), -1500.5);
  assert.equal(parseDecimalBR('-12.5'), -12.5);
});

test('toEditable ida e volta sem inflar o valor', () => {
  for (const v of [5000, 1500.5, 12.34, 0.1]) {
    assert.equal(parseDecimalBR(toEditable(v, true, false)), v);
  }
  assert.equal(toEditable(1500.5, true, false), '1500,50');
  assert.equal(toEditable(7.9, false, true), '7');
});
