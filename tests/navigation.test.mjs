import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APP_NAVIGATION_GROUPS,
  APP_NAVIGATION_ITEMS,
  SETTINGS_NAVIGATION_ITEM,
} from '../src/components/navigation/app-navigation.ts';

test('global search catalog mirrors every sidebar destination', () => {
  const sidebarItems = APP_NAVIGATION_GROUPS.flatMap(group => group.items);

  assert.deepEqual(
    APP_NAVIGATION_ITEMS.map(item => item.path),
    [...sidebarItems, SETTINGS_NAVIGATION_ITEM].map(item => item.path),
  );
  assert.equal(new Set(APP_NAVIGATION_ITEMS.map(item => item.path)).size, APP_NAVIGATION_ITEMS.length);
});

test('logged area exposes all expected pages through the shared navigation catalog', () => {
  assert.deepEqual(
    APP_NAVIGATION_ITEMS.map(item => item.path),
    [
      '/sistema',
      '/sistema/statement',
      '/sistema/accounts',
      '/sistema/cards',
      '/sistema/budgets',
      '/sistema/goals',
      '/sistema/projects',
      '/sistema/ledgers',
      '/sistema/forecast',
      '/sistema/analytics',
      '/sistema/inflation',
      '/sistema/categories',
      '/sistema/people',
      '/sistema/notes',
      '/sistema/my-ai',
      '/sistema/settings',
    ],
  );
});
