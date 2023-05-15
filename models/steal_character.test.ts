// deno-lint-ignore-file no-explicit-any

import { assertSpyCalls } from 'https://deno.land/std@0.186.0/testing/mock.ts';

import { assertSnapshot } from 'https://deno.land/std@0.186.0/testing/snapshot.ts';

import { FakeClient } from './fql.ts';

import { default as Model } from './steal_character.ts';

Deno.test('model', async (test) => {
  const client = FakeClient();

  Model(client as any).resolvers?.forEach((q) => q());

  const length = 2;

  assertSpyCalls(client.query, length);

  for (let i = 0; i < length; i++) {
    await assertSnapshot(test, client.query.calls[i].args);
  }
});