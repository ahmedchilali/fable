// deno-lint-ignore-file no-explicit-any

import {
  assert,
  assertEquals,
  assertObjectMatch,
  assertRejects,
} from 'https://deno.land/std@0.178.0/testing/asserts.ts';

import {
  assertSpyCalls,
  stub,
} from 'https://deno.land/std@0.178.0/testing/mock.ts';

import { assertSnapshot } from 'https://deno.land/std@0.178.0/testing/snapshot.ts';

import validate, { assertValidManifest } from '../src/validate.ts';

import packs from '../src/packs.ts';

import * as anilist from '../packs/anilist/api.ts';

import {
  Character,
  CharacterRole,
  DisaggregatedCharacter,
  DisaggregatedMedia,
  Manifest,
  Media,
  MediaFormat,
  MediaRelation,
  MediaType,
  PackType,
} from '../src/types.ts';

import { AniListCharacter, AniListMedia } from '../packs/anilist/types.ts';

Deno.test('list', async (test) => {
  await test.step('anilist', async (test) => {
    const list = await packs.all({ type: PackType.Builtin });

    const pack = list[0];

    assertEquals(list.length, 2);

    assertValidManifest(pack.manifest);

    await assertSnapshot(test, pack);
  });

  await test.step('vtubers', async (test) => {
    const list = await packs.all({ type: PackType.Builtin });

    const pack = list[1];

    assertEquals(list.length, 2);

    assertValidManifest(pack.manifest);

    await assertSnapshot(test, pack);
  });

  await test.step('community', async () => {
    const list = await packs.all({ type: PackType.Community });

    assertEquals(list.length, 0);
  });

  await test.step('no type', async () => {
    const list = await packs.all({});

    assertEquals(list.length, 1);

    assertEquals(list[0].manifest.id, 'vtubers');
  });
});

Deno.test('reserved ids', async () => {
  const list = await packs.all({ type: PackType.Builtin });

  list.forEach(({ manifest }) => {
    assertEquals(validate(manifest), {
      error: `${manifest.id} is a reserved id`,
    });
  });
});

Deno.test('disabled', async (test) => {
  await test.step('disabled media', () => {
    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        conflicts: ['another-pack:1'],
      },
    };

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assert(packs.isDisabled('another-pack:1', 'guild_id'));
    } finally {
      packs.cachedGuilds = {};
      listStub.restore();
    }
  });

  await test.step('disabled character', () => {
    const manifest: Manifest = {
      id: 'pack-id',
      characters: {
        conflicts: ['another-pack:1'],
      },
    };

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assert(packs.isDisabled('another-pack:1', 'guild_id'));
    } finally {
      packs.cachedGuilds = {};
      listStub.restore();
    }
  });

  await test.step('none', () => {
    const manifest: Manifest = {
      id: 'pack-id',
      characters: {
        conflicts: [],
      },
    };

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assert(!packs.isDisabled('another-pack:1', 'guild_id'));
    } finally {
      packs.cachedGuilds = {};
      listStub.restore();
    }
  });
});

Deno.test('disabled relations', async (test) => {
  await test.step('disabled anilist media relations', async () => {
    const media: AniListMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'title',
      },
      relations: {
        edges: [{
          relationType: MediaRelation.Contains,
          node: {
            id: '2',
            type: MediaType.Anime,
            format: MediaFormat.TV,
            title: {
              english: 'title 2',
            },
          },
        }],
      },
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        conflicts: ['anilist:2'],
      },
    };

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        (await packs.aggregate<Media>({
          guildId: 'guild_id',
          media: anilist.transform<Media>({ item: media }),
        }))
          .relations?.edges.length,
        0,
      );
    } finally {
      packs.cachedGuilds = {};
      listStub.restore();
    }
  });

  await test.step('disabled anilist media characters', async () => {
    const media: AniListMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'title',
      },
      characters: {
        edges: [{
          role: CharacterRole.Main,
          node: {
            id: '2',
            name: {
              full: 'name',
            },
          },
        }],
      },
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        conflicts: ['anilist:2'],
      },
    };

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        (await packs.aggregate<Media>({
          guildId: 'guild_id',
          media: anilist.transform<Media>({ item: media }),
        }))
          .characters?.edges.length,
        0,
      );
    } finally {
      packs.cachedGuilds = {};
      listStub.restore();
    }
  });

  await test.step('disabled anilist character media', async () => {
    const character: AniListCharacter = {
      id: '1',
      name: {
        full: 'name',
      },
      media: {
        edges: [{
          characterRole: CharacterRole.Main,
          node: {
            id: '2',
            type: MediaType.Anime,
            format: MediaFormat.TV,
            title: {
              english: 'title',
            },
          },
        }],
      },
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        conflicts: ['anilist:2'],
      },
    };

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        (await packs.aggregate<Character>({
          guildId: 'guild_id',
          character: anilist.transform<Character>({ item: character }),
        }))
          .media?.edges.length,
        0,
      );
    } finally {
      packs.cachedGuilds = {};
      listStub.restore();
    }
  });

  await test.step('disabled packs media relations', async () => {
    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [{
          id: '1',
          packId: 'pack-id',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'title 1',
          },
          relations: [{
            mediaId: '2',
            relation: MediaRelation.Contains,
          }],
        }, {
          id: '2',
          packId: 'pack-id',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'title 2',
          },
          relations: [{
            mediaId: '1',
            relation: MediaRelation.Parent,
          }],
        }],
      },
    };

    const manifest2: Manifest = {
      id: 'pack2',
      media: {
        conflicts: ['pack-id:2'],
      },
    };

    const listStub = stub(
      packs,
      'all',
      () =>
        Promise.resolve([
          { manifest, type: PackType.Community },
          { manifest: manifest2, type: PackType.Community },
        ]),
    );

    packs.cachedGuilds = {
      'guild_id': [
        { manifest, type: PackType.Community },
        { manifest: manifest2, type: PackType.Community },
      ],
    };

    try {
      assertEquals(
        (await packs.aggregate<Media>({
          guildId: 'guild_id',
          // deno-lint-ignore no-non-null-assertion
          media: manifest.media!.new![0],
        }))
          .relations?.edges.length,
        0,
      );
    } finally {
      packs.cachedGuilds = {};
      listStub.restore();
    }
  });

  await test.step('disabled packs media characters', async () => {
    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [{
          id: '1',
          packId: 'pack-id',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'title',
          },
          characters: [{
            characterId: '2',
            role: CharacterRole.Main,
          }],
        }],
      },
      characters: {
        new: [{
          id: '2',
          packId: 'pack-id',
          name: {
            english: 'name',
          },
        }],
      },
    };

    const manifest2: Manifest = {
      id: 'pack2',
      characters: {
        conflicts: ['pack-id:2'],
      },
    };

    const listStub = stub(
      packs,
      'all',
      () =>
        Promise.resolve([
          { manifest, type: PackType.Community },
          { manifest: manifest2, type: PackType.Community },
        ]),
    );

    packs.cachedGuilds = {
      'guild_id': [
        { manifest, type: PackType.Community },
        { manifest: manifest2, type: PackType.Community },
      ],
    };

    try {
      assertEquals(
        (await packs.aggregate<Media>({
          guildId: 'guild_id',
          // deno-lint-ignore no-non-null-assertion
          media: manifest.media!.new![0],
        }))
          .characters?.edges.length,
        0,
      );
    } finally {
      packs.cachedGuilds = {};
      listStub.restore();
    }
  });

  await test.step('disabled packs character media', async () => {
    const manifest: Manifest = {
      id: 'pack-id',
      characters: {
        new: [{
          id: '1',
          packId: 'pack-id',
          name: {
            english: 'name',
          },
          media: [{
            mediaId: '2',
            role: CharacterRole.Main,
          }],
        }],
      },
      media: {
        new: [{
          id: '2',
          packId: 'pack-id',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'title',
          },
        }],
      },
    };

    const manifest2: Manifest = {
      id: 'pack2',
      characters: {
        conflicts: ['pack-id:2'],
      },
    };

    const listStub = stub(
      packs,
      'all',
      () =>
        Promise.resolve([
          { manifest, type: PackType.Community },
          { manifest: manifest2, type: PackType.Community },
        ]),
    );

    packs.cachedGuilds = {
      'guild_id': [
        { manifest, type: PackType.Community },
        { manifest: manifest2, type: PackType.Community },
      ],
    };

    try {
      assertEquals(
        (await packs.aggregate<Character>({
          guildId: 'guild_id',
          // deno-lint-ignore no-non-null-assertion
          character: manifest.characters!.new![0],
        }))
          .media?.edges.length,
        0,
      );
    } finally {
      packs.cachedGuilds = {};
      listStub.restore();
    }
  });
});

Deno.test('search many', async (test) => {
  await test.step('sort by match percentage', async () => {
    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [{
                  title: {
                    english: 'ab',
                  },
                }, {
                  title: {
                    english: 'acc',
                  },
                }, {
                  title: {
                    english: 'aa',
                  },
                }],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const matches = await packs.searchMany<Media>({
        key: 'media',
        search: 'aa',
        threshold: 0,
        guildId: 'guild_id',
      });

      assertEquals(matches?.length, 3);

      assertObjectMatch(matches?.[0], {
        packId: 'anilist',
        title: { english: 'aa' },
      });

      assertObjectMatch(matches?.[1], {
        packId: 'anilist',
        title: { english: 'ab' },
      });

      assertObjectMatch(matches?.[2], {
        packId: 'anilist',
        title: { english: 'acc' },
      });
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('sort by match percentage then popularity', async () => {
    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [{
                  id: '1',
                  title: {
                    english: 'aa',
                  },
                  popularity: 3,
                }, {
                  id: '3',
                  title: {
                    english: 'aa',
                  },
                  popularity: 1,
                }, {
                  id: '2',
                  title: {
                    english: 'aa',
                  },
                  popularity: 2,
                }],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const matches = await packs.searchMany<Media>({
        key: 'media',
        search: 'aa',
        threshold: 0,
        guildId: 'guild_id',
      });

      assertEquals(matches?.length, 3);

      assertObjectMatch(matches?.[0], {
        id: '1',
        popularity: 3,
        title: { english: 'aa' },
      });

      assertObjectMatch(matches?.[1], {
        id: '2',
        popularity: 2,
        title: { english: 'aa' },
      });

      assertObjectMatch(matches?.[2], {
        id: '3',
        popularity: 1,
        title: { english: 'aa' },
      });
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('threshold', async () => {
    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [{
                  title: {
                    english: 'a',
                  },
                }, {
                  title: {
                    english: 'aa',
                  },
                }, {
                  title: {
                    english: 'b',
                  },
                }, {
                  title: {
                    english: 'c',
                  },
                }],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const matches = await packs.searchMany<Media>({
        key: 'media',
        search: 'aa',
        threshold: 100,
        guildId: 'guild_id',
      });

      console.log(matches);

      assertEquals(matches?.length, 1);

      assertObjectMatch(matches?.[0], {
        packId: 'anilist',
        title: { english: 'aa' },
      });
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });
});

Deno.test('search for media', async (test) => {
  await test.step('anilist id', async () => {
    const media: AniListMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'anilist media',
      },
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [{
          id: '1',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'pack-id media',
          },
        }],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [media],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const results = await packs.media({
        guildId: 'guild_id',
        ids: ['anilist:1'],
      });

      assertEquals(results.length, 1);

      assertEquals(results[0].id, '1');
      assertEquals(results[0].packId, 'anilist');
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('pack id', async () => {
    const media: AniListMedia = {
      id: 1 as unknown as string,
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'anilist media',
      },
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [{
          id: '1',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'pack-id media',
          },
        }],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [media],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      const results = await packs.media({
        guildId: 'guild_id',
        ids: ['pack-id:1'],
      });

      assertEquals(results.length, 1);

      assertEquals(results[0].id, '1');
      assertEquals(results[0].packId, 'pack-id');
      assertEquals(results[0].title.english, 'pack-id media');
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('no pack id specified', async () => {
    const media: AniListMedia = {
      id: 1 as unknown as string,
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'anilist media',
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [media],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const results = await packs.media({
        guildId: 'guild_id',
        ids: ['1'],
      });

      assertEquals(results.length, 0);
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('disabled anilist id', async () => {
    const media: AniListMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'anilist media',
      },
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        conflicts: ['anilist:1'],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [media],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      const results = await packs.media({
        guildId: 'guild_id',
        ids: ['anilist:1'],
      });

      assertEquals(results.length, 0);
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('disabled pack id', async () => {
    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        conflicts: ['pack2:1'],
      },
    };

    const manifest2: Manifest = {
      id: 'pack2',
      media: {
        new: [{
          id: '1',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'media',
          },
        }],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () =>
        Promise.resolve([
          { manifest, type: PackType.Community },
          { manifest: manifest2, type: PackType.Community },
        ]),
    );

    packs.cachedGuilds = {
      'guild_id': [
        { manifest, type: PackType.Community },
        { manifest: manifest2, type: PackType.Community },
      ],
    };

    try {
      const results = await packs.media({
        guildId: 'guild_id',
        ids: ['pack2:1'],
      });

      assertEquals(results.length, 0);
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('match english', async () => {
    const media: AniListMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'fable',
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [media],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const results = await packs.media({
        guildId: 'guild_id',
        search: 'feble',
      });

      assertEquals(results.length, 1);
      assertEquals(results[0].id, '1');
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('match romaji', async () => {
    const media: AniListMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        romaji: 'fable',
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [media],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const results = await packs.media({
        guildId: 'guild_id',
        search: 'feble',
      });

      assertEquals(results.length, 1);
      assertEquals(results[0].id, '1');
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('match native', async () => {
    const media: AniListMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        native: 'fable',
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [media],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const results = await packs.media({
        guildId: 'guild_id',
        search: 'feble',
      });

      assertEquals(results.length, 1);

      assertEquals(results[0].id, '1');
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('match alias', async () => {
    const media: AniListMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'x'.repeat(100),
      },
      synonyms: ['fable'],
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [media],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const results = await packs.media({
        guildId: 'guild_id',
        search: 'feble',
      });

      assertEquals(results.length, 1);

      assertEquals(results[0].id, '1');
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('disabled anilist match', async () => {
    const media: AniListMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'anilist media',
      },
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        conflicts: ['anilist:1'],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [media],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      const results = await packs.media({
        guildId: 'guild_id',
        search: 'anilist media',
      });

      assertEquals(results.length, 0);
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('disabled pack match', async () => {
    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        conflicts: ['pack2:1'],
      },
    };

    const manifest2: Manifest = {
      id: 'pack2',
      media: {
        new: [{
          id: '1',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'pack media',
          },
        }],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () =>
        Promise.resolve([
          { manifest, type: PackType.Community },
          { manifest: manifest2, type: PackType.Community },
        ]),
    );

    packs.cachedGuilds = {
      'guild_id': [
        { manifest, type: PackType.Community },
        { manifest: manifest2, type: PackType.Community },
      ],
    };

    try {
      const results = await packs.media({
        guildId: 'guild_id',
        search: 'pack media',
      });

      assertEquals(results.length, 0);
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('no matches', async () => {
    const media: AniListMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'abc',
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [media],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const results = await packs.media({
        guildId: 'guild_id',
        search: 'd',
      });

      assertEquals(results.length, 0);
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });
});

Deno.test('search for characters', async (test) => {
  await test.step('anilist id', async () => {
    const character: AniListCharacter = {
      id: '1',
      name: {
        full: 'anilist character',
      },
    };

    const manifest: Manifest = {
      id: 'pack-id',
      characters: {
        new: [{
          id: '1',
          name: {
            english: 'pack-id character',
          },
        }],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                characters: [character],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const results = await packs.characters({
        guildId: 'guild_id',
        ids: ['anilist:1'],
      });

      assertEquals(results.length, 1);

      assertEquals(results[0], {
        id: '1',
        packId: 'anilist',
        name: {
          english: 'anilist character',
        },
      });
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('pack id', async () => {
    const character: AniListCharacter = {
      id: 1 as unknown as string,
      name: {
        full: 'anilist character',
      },
    };

    const manifest: Manifest = {
      id: 'pack-id',
      characters: {
        new: [{
          id: '1',
          name: {
            english: 'pack-id character',
          },
        }],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                characters: [character],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      const results = await packs.characters({
        guildId: 'guild_id',
        ids: ['pack-id:1'],
      });

      assertEquals(results.length, 1);

      assertEquals(results[0], manifest.characters?.new?.[0]);

      assertEquals(results[0].id, '1');
      assertEquals(results[0].packId, 'pack-id');
      assertEquals(results[0].name.english, 'pack-id character');
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('no pack id specified', async () => {
    const character: AniListCharacter = {
      id: 1 as unknown as string,
      name: {
        full: 'anilist character',
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                characters: [character],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const results = await packs.characters({
        guildId: 'guild_id',
        ids: ['1'],
      });

      assertEquals(results.length, 0);
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('match full', async () => {
    const character: AniListCharacter = {
      id: '1',
      name: {
        full: 'fable',
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                characters: [character],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const results = await packs.characters({
        guildId: 'guild_id',
        search: 'feble',
      });

      assertEquals(results.length, 1);

      assertEquals(results[0].id, '1');
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('match native', async () => {
    const character: AniListCharacter = {
      id: '1',
      name: {
        full: 'x'.repeat(100),
        native: 'fable',
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                characters: [character],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const results = await packs.characters({
        guildId: 'guild_id',
        search: 'feble',
      });

      assertEquals(results.length, 1);

      assertEquals(results[0].id, '1');
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('match alias', async () => {
    const character: AniListCharacter = {
      id: '1',
      name: {
        full: 'x'.repeat(100),
        alternative: ['fable'],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                characters: [character],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const results = await packs.characters({
        guildId: 'guild_id',
        search: 'feble',
      });

      assertEquals(results.length, 1);

      assertEquals(results[0].id, '1');
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('no matches', async () => {
    const character: AniListCharacter = {
      id: '1',
      name: {
        full: 'abc',
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                characters: [character],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const results = await packs.characters({
        guildId: 'guild_id',
        search: 'd',
      });

      assertEquals(results.length, 0);
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });
});

Deno.test('media character', async (test) => {
  await test.step('anilist', async () => {
    const media: AniListMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'title',
      },
      characters: {
        pageInfo: {
          hasNextPage: true,
        },
        edges: [{
          role: CharacterRole.Main,
          node: {
            id: '2',
            name: {
              full: 'name',
            },
          },
        }],
      } as any,
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Media: media,
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      const result = await packs.mediaCharacters({
        guildId: 'guild_id',
        mediaId: 'anilist:1',
        index: 0,
      });

      assertEquals(result, {
        next: true,
        media: {
          id: '1',
          packId: 'anilist',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'title',
          },
          characters: {
            edges: [
              {
                role: 'MAIN',
                node: {
                  id: '2',
                  packId: 'anilist',
                  name: {
                    english: 'name',
                  },
                },
              },
            ],
          } as any,
        },
        character: {
          id: '2',
          packId: 'anilist',
          name: {
            english: 'name',
          },
        },
      });
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('pack', async () => {
    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [{
          id: '1',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'title',
          },
          characters: [{
            role: CharacterRole.Main,
            characterId: '2',
          }],
        }],
      },
      characters: {
        new: [{
          id: '2',
          name: {
            english: 'name',
          },
        }],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      const result = await packs.mediaCharacters({
        guildId: 'guild_id',
        mediaId: 'pack-id:1',
        index: 0,
      });

      assertEquals(result, {
        total: 1,
        next: false,
        media: {
          id: '1',
          packId: 'pack-id',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'title',
          },
          relations: {
            edges: [],
          },
          characters: {
            edges: [
              {
                role: 'MAIN',
                node: {
                  id: '2',
                  packId: 'pack-id',
                  name: {
                    english: 'name',
                  },
                },
              },
            ],
          } as any,
        },
        character: {
          id: '2',
          packId: 'pack-id',
          name: {
            english: 'name',
          },
        },
      });
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('pack with no characters', async () => {
    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [{
          id: '1',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'title',
          },
          characters: [],
        }],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      const result = await packs.mediaCharacters({
        guildId: 'guild_id',
        mediaId: 'pack-id:1',
        index: 0,
      });

      assertEquals(result, {
        total: 0,
        next: false,
        character: undefined,
        media: {
          id: '1',
          packId: 'pack-id',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'title',
          },
          relations: {
            edges: [],
          },
          characters: {
            edges: [],
          },
        },
      });
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('disabled media', async () => {
    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        conflicts: ['anilist:1'],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      await assertRejects(
        async () =>
          await packs.mediaCharacters({
            guildId: 'guild_id',
            mediaId: 'anilist:1',
            index: 0,
          }),
        Error,
        '404',
      );
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });
});

Deno.test('aggregate media', async (test) => {
  await test.step('aggregate from anilist', async () => {
    const parent: AniListMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media parent',
      },
    };

    const character: AniListCharacter = {
      id: '2',
      name: {
        full: 'character name',
      },
    };

    const child: DisaggregatedMedia = {
      id: '1',
      packId: 'test',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media child',
      },
      relations: [{
        relation: MediaRelation.Parent,
        mediaId: 'anilist:1',
      }],
      characters: [{
        role: CharacterRole.Main,
        characterId: 'anilist:2',
      }],
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [parent],
                characters: [character],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      assertEquals(
        await packs.aggregate<Media>({
          guildId: 'guild_id',
          media: child,
        }),
        {
          id: '1',
          packId: 'test',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'media child',
          },
          relations: {
            edges: [{
              relation: MediaRelation.Parent,
              node: {
                id: '1',
                packId: 'anilist',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media parent',
                },
              },
            }],
          },
          characters: {
            edges: [{
              role: CharacterRole.Main,
              node: {
                id: '2',
                packId: 'anilist',
                name: {
                  english: 'character name',
                },
              },
            }],
          },
        },
      );

      assertSpyCalls(fetchStub, 2);
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('aggregate from pack', async () => {
    const parent: DisaggregatedMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media parent',
      },
    };

    const character: DisaggregatedCharacter = {
      id: '2',
      name: {
        english: 'character name',
      },
    };

    const child: DisaggregatedMedia = {
      id: '1',
      packId: 'test',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media child',
      },
      relations: [{
        relation: MediaRelation.Parent,
        mediaId: 'pack-id:1',
      }],
      characters: [{
        role: CharacterRole.Main,
        characterId: 'pack-id:2',
      }],
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [parent],
      },
      characters: {
        new: [character],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        await packs.aggregate<Media>({
          guildId: 'guild_id',
          media: child,
        }),
        {
          id: '1',
          packId: 'test',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'media child',
          },
          relations: {
            edges: [{
              relation: MediaRelation.Parent,
              node: {
                id: '1',
                packId: 'pack-id',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media parent',
                },
              },
            }],
          },
          characters: {
            edges: [{
              role: CharacterRole.Main,
              node: {
                id: '2',
                packId: 'pack-id',
                name: {
                  english: 'character name',
                },
              },
            }],
          },
        },
      );

      assertSpyCalls(fetchStub, 0);
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('referring to the same media more than once (anilist)', async () => {
    const media: Media = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media parent',
      },
    };

    const child: DisaggregatedMedia = {
      id: '1',
      packId: 'test',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media child',
      },
      relations: [{
        relation: MediaRelation.Parent,
        mediaId: 'anilist:1',
      }, {
        relation: MediaRelation.SpinOff,
        mediaId: 'anilist:1',
      }],
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [media],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      assertEquals(
        await packs.aggregate<Media>({
          guildId: 'guild_id',
          media: child,
        }),
        {
          id: '1',
          packId: 'test',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'media child',
          },
          relations: {
            edges: [{
              relation: MediaRelation.Parent,
              node: {
                id: '1',
                packId: 'anilist',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media parent',
                },
              },
            }, {
              relation: MediaRelation.SpinOff,
              node: {
                id: '1',
                packId: 'anilist',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media parent',
                },
              },
            }],
          },
          characters: {
            edges: [],
          },
        },
      );

      assertSpyCalls(fetchStub, 1);
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('referring to the same media more than once (packs)', async () => {
    const media: DisaggregatedMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media parent',
      },
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [media],
      },
    };

    const child: DisaggregatedMedia = {
      id: '1',
      packId: 'test',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media child',
      },
      relations: [{
        relation: MediaRelation.Parent,
        mediaId: 'pack-id:1',
      }, {
        relation: MediaRelation.SpinOff,
        mediaId: 'pack-id:1',
      }],
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );
    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        await packs.aggregate<Media>({
          guildId: 'guild_id',
          media: child,
        }),
        {
          id: '1',
          packId: 'test',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'media child',
          },
          relations: {
            edges: [{
              relation: MediaRelation.Parent,
              node: {
                id: '1',
                packId: 'pack-id',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media parent',
                },
              },
            }, {
              relation: MediaRelation.SpinOff,
              node: {
                id: '1',
                packId: 'pack-id',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media parent',
                },
              },
            }],
          },
          characters: {
            edges: [],
          },
        },
      );

      assertSpyCalls(fetchStub, 0);
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('referring to a character as a media', async () => {
    const media: DisaggregatedMedia = {
      id: '1',
      packId: 'test',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'title',
      },
      relations: [{
        relation: MediaRelation.Adaptation,
        mediaId: 'pack-id:1',
      }],
    };

    const manifest: Manifest = {
      id: 'pack-id',
      characters: {
        new: [{
          id: '1',
          name: {
            english: 'character name',
          },
        }],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        await packs.aggregate<Media>({
          guildId: 'guild_id',
          media,
        }),
        {
          id: '1',
          packId: 'test',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'title',
          },
          relations: {
            edges: [],
          },
          characters: {
            edges: [],
          },
        },
      );

      assertSpyCalls(fetchStub, 0);
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('referring to a non-existing ids', async () => {
    const media: DisaggregatedMedia = {
      id: '1',
      packId: 'test',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'title',
      },
      relations: [{
        relation: MediaRelation.Prequel,
        mediaId: 'anilist:1',
      }],
      characters: [{
        role: CharacterRole.Main,
        characterId: 'pack-id:1',
      }],
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [],
      },
      characters: {
        new: [],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [],
                characters: [],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        await packs.aggregate<Media>({
          guildId: 'guild_id',
          media,
        }),
        {
          id: '1',
          packId: 'test',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'title',
          },
          relations: {
            edges: [],
          },
          characters: {
            edges: [],
          },
        },
      );

      assertSpyCalls(fetchStub, 1);
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('referring to the same pack', async () => {
    const parent: DisaggregatedMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media parent',
      },
    };

    const spinoff: DisaggregatedMedia = {
      id: '2',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media spinoff',
      },
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [parent, spinoff],
      },
    };

    const child: DisaggregatedMedia = {
      id: '3',
      packId: 'pack-id',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media child',
      },
      relations: [{
        relation: MediaRelation.Parent,
        mediaId: 'pack-id:1',
      }, {
        relation: MediaRelation.SpinOff,
        mediaId: '2',
      }],
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        await packs.aggregate<Media>({
          guildId: 'guild_id',
          media: child,
        }),
        {
          id: '3',
          packId: 'pack-id',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'media child',
          },
          relations: {
            edges: [{
              relation: MediaRelation.Parent,
              node: {
                id: '1',
                packId: 'pack-id',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media parent',
                },
              },
            }, {
              relation: MediaRelation.SpinOff,
              node: {
                id: '2',
                packId: 'pack-id',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media spinoff',
                },
              },
            }],
          },
          characters: {
            edges: [],
          },
        },
      );

      assertSpyCalls(fetchStub, 0);
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('no recursive aggregation', async () => {
    const spinoff: DisaggregatedMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media spinoff',
      },
      relations: [{
        mediaId: 'test:1',
        relation: MediaRelation.SpinOff,
      }],
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [spinoff],
      },
    };

    const adaptation: DisaggregatedMedia = {
      id: '1',
      packId: 'test',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media adaptation',
      },
      relations: [{
        relation: MediaRelation.Adaptation,
        mediaId: 'pack-id:1',
      }],
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        await packs.aggregate<Media>({
          guildId: 'guild_id',
          media: adaptation,
        }),
        {
          id: '1',
          packId: 'test',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'media adaptation',
          },
          relations: {
            edges: [{
              relation: MediaRelation.Adaptation,
              node: {
                id: '1',
                packId: 'pack-id',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media spinoff',
                },
                relations: [{
                  mediaId: 'test:1',
                  relation: MediaRelation.SpinOff,
                }] as any,
              },
            }],
          },
          characters: {
            edges: [],
          },
        },
      );

      assertSpyCalls(fetchStub, 0);
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('already aggregated', async () => {
    const media: Media = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'title',
      },
      relations: {
        edges: [{
          relation: MediaRelation.Sequel,
          node: {
            id: '2',
            type: MediaType.Anime,
            format: MediaFormat.TV,
            title: {
              english: 'sequel',
            },
          },
        }],
      },
      characters: {
        edges: [{
          role: CharacterRole.Supporting,
          node: {
            id: '3',
            name: {
              english: 'character name',
            },
          },
        }],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      assertEquals(
        await packs.aggregate<Media>({
          guildId: 'guild_id',
          media,
        }),
        media,
      );

      assertSpyCalls(fetchStub, 0);
      assertSpyCalls(listStub, 0);
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('empty', async () => {
    const media: Media = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'title',
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      assertEquals(
        await packs.aggregate<Media>({
          guildId: 'guild_id',
          media,
        }),
        {
          ...media,
          relations: {
            edges: [],
          },
          characters: {
            edges: [],
          },
        },
      );

      assertSpyCalls(fetchStub, 0);
      assertSpyCalls(listStub, 0);
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });
});

Deno.test('aggregate characters', async (test) => {
  await test.step('aggregate from anilist', async () => {
    const media: Media = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media',
      },
    };

    const character: DisaggregatedCharacter = {
      id: '1',
      packId: 'test',
      name: {
        english: 'full name',
      },
      media: [{
        role: CharacterRole.Main,
        mediaId: 'anilist:1',
      }],
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [media],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      assertEquals(
        await packs.aggregate<Character>({
          guildId: 'guild_id',
          character,
        }),
        {
          id: '1',
          packId: 'test',
          name: {
            english: 'full name',
          },
          media: {
            edges: [{
              role: CharacterRole.Main,
              node: {
                id: '1',
                packId: 'anilist',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media',
                },
              },
            }],
          },
        },
      );

      assertSpyCalls(fetchStub, 1);
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('aggregate from pack', async () => {
    const media: DisaggregatedMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media',
      },
    };

    const character: DisaggregatedCharacter = {
      id: '1',
      packId: 'test',
      name: {
        english: 'full name',
      },
      media: [{
        role: CharacterRole.Main,
        mediaId: 'pack-id:1',
      }],
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [media],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () =>
        Promise.resolve([
          { manifest, type: PackType.Community },
        ]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        await packs.aggregate<Character>({
          guildId: 'guild_id',
          character,
        }),
        {
          id: '1',
          packId: 'test',
          name: {
            english: 'full name',
          },
          media: {
            edges: [{
              role: CharacterRole.Main,
              node: {
                id: '1',
                packId: 'pack-id',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media',
                },
              },
            }],
          },
        },
      );

      assertSpyCalls(fetchStub, 0);
    } finally {
      fetchStub.restore();
      listStub.restore();
      packs.cachedGuilds = {};
    }
  });

  await test.step('referring to the same media more than once (anilist)', async () => {
    const media: Media = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media',
      },
    };

    const character: DisaggregatedCharacter = {
      id: '1',
      packId: 'test',
      name: {
        english: 'full name',
      },
      media: [{
        role: CharacterRole.Main,
        mediaId: 'anilist:1',
      }, {
        role: CharacterRole.Supporting,
        mediaId: 'anilist:1',
      }],
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [media],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      assertEquals(
        await packs.aggregate<Character>({
          guildId: 'guild_id',
          character,
        }),
        {
          id: '1',
          packId: 'test',
          name: {
            english: 'full name',
          },
          media: {
            edges: [{
              role: CharacterRole.Main,
              node: {
                id: '1',
                packId: 'anilist',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media',
                },
              },
            }, {
              role: CharacterRole.Supporting,
              node: {
                id: '1',
                packId: 'anilist',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media',
                },
              },
            }],
          },
        },
      );

      assertSpyCalls(fetchStub, 1);
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('referring to the same media more than once (packs)', async () => {
    const media: DisaggregatedMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media',
      },
    };

    const character: DisaggregatedCharacter = {
      id: '1',
      packId: 'test',
      name: {
        english: 'full name',
      },
      media: [{
        role: CharacterRole.Main,
        mediaId: 'pack-id:1',
      }, {
        role: CharacterRole.Supporting,
        mediaId: 'pack-id:1',
      }],
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [media],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () =>
        Promise.resolve([
          { manifest, type: PackType.Community },
        ]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        await packs.aggregate<Character>({
          guildId: 'guild_id',
          character,
        }),
        {
          id: '1',
          packId: 'test',
          name: {
            english: 'full name',
          },
          media: {
            edges: [{
              role: CharacterRole.Main,
              node: {
                id: '1',
                packId: 'pack-id',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media',
                },
              },
            }, {
              role: CharacterRole.Supporting,
              node: {
                id: '1',
                packId: 'pack-id',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media',
                },
              },
            }],
          },
        },
      );

      assertSpyCalls(fetchStub, 0);
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('referring to a non-existing ids', async () => {
    const character: DisaggregatedCharacter = {
      id: '1',
      packId: 'test',
      name: {
        english: 'full name',
      },
      media: [{
        role: CharacterRole.Main,
        mediaId: 'anilist:1',
      }, {
        role: CharacterRole.Main,
        mediaId: 'pack-id:1',
      }],
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [],
      },
      characters: {
        new: [],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => ({
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                media: [],
                characters: [],
              },
            },
          }))),
      } as any),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        await packs.aggregate<Character>({
          guildId: 'guild_id',
          character,
        }),
        {
          id: '1',
          packId: 'test',
          name: {
            english: 'full name',
          },
          media: {
            edges: [],
          },
        },
      );

      assertSpyCalls(fetchStub, 1);
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('referring to the same pack', async () => {
    const character: DisaggregatedCharacter = {
      id: '3',
      packId: 'pack-id',
      name: {
        english: 'full name',
      },
      media: [{
        role: CharacterRole.Main,
        mediaId: 'pack-id:1',
      }, {
        role: CharacterRole.Main,
        mediaId: '2',
      }],
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [{
          id: '1',
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'media 1',
          },
        }, {
          id: '2',
          type: MediaType.Manga,
          format: MediaFormat.Manga,
          title: {
            english: 'media 2',
          },
        }],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () =>
        Promise.resolve([
          { manifest, type: PackType.Community },
        ]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        await packs.aggregate<Character>({
          guildId: 'guild_id',
          character,
        }),
        {
          id: '3',
          packId: 'pack-id',
          name: {
            english: 'full name',
          },
          media: {
            edges: [{
              role: CharacterRole.Main,
              node: {
                id: '1',
                packId: 'pack-id',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media 1',
                },
              },
            }, {
              role: CharacterRole.Main,
              node: {
                id: '2',
                packId: 'pack-id',
                type: MediaType.Manga,
                format: MediaFormat.Manga,
                title: {
                  english: 'media 2',
                },
              },
            }],
          },
        },
      );

      assertSpyCalls(fetchStub, 0);
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('no recursive aggregation', async () => {
    const media: DisaggregatedMedia = {
      id: '1',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      title: {
        english: 'media',
      },
      relations: [{
        mediaId: 'test:1',
        relation: MediaRelation.SpinOff,
      }],
    };

    const character: DisaggregatedCharacter = {
      id: '1',
      packId: 'test',
      name: {
        english: 'full name',
      },
      media: [{
        role: CharacterRole.Main,
        mediaId: 'pack-id:1',
      }],
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        new: [media],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        await packs.aggregate<Character>({
          guildId: 'guild_id',
          character,
        }),
        {
          id: '1',
          packId: 'test',
          name: {
            english: 'full name',
          },
          media: {
            edges: [{
              role: CharacterRole.Main,
              node: {
                id: '1',
                packId: 'pack-id',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'media',
                },
                relations: [{
                  mediaId: 'test:1',
                  relation: MediaRelation.SpinOff,
                }] as any,
              },
            }],
          },
        },
      );

      assertSpyCalls(fetchStub, 0);
    } finally {
      packs.cachedGuilds = {};
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('already aggregated', async () => {
    const character: Character = {
      id: '1',
      name: {
        english: 'full name',
      },
      media: {
        edges: [{
          role: CharacterRole.Main,
          node: {
            id: '2',
            type: MediaType.Anime,
            format: MediaFormat.TV,
            title: {
              english: 'media',
            },
          },
        }],
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      assertEquals(
        await packs.aggregate<Character>({
          guildId: 'guild_id',
          character,
        }),
        character,
      );

      assertSpyCalls(fetchStub, 0);
      assertSpyCalls(listStub, 0);
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });

  await test.step('empty', async () => {
    const character: Character = {
      id: '1',
      name: {
        english: 'full name',
      },
    };

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    try {
      assertEquals(
        await packs.aggregate<Character>({
          guildId: 'guild_id',
          character,
        }),
        {
          ...character,
          media: {
            edges: [],
          },
        },
      );

      assertSpyCalls(fetchStub, 0);
      assertSpyCalls(listStub, 0);
    } finally {
      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
    }
  });
});

Deno.test('titles to array', async (test) => {
  await test.step('all titles', () => {
    const alias = packs.aliasToArray({
      romaji: 'romaji',
      native: 'native',
      english: 'english',
    });

    assertEquals(alias, [
      'english',
      'romaji',
      'native',
    ]);
  });

  await test.step('missing 1 title', () => {
    const alias = packs.aliasToArray({
      romaji: '',
      native: 'native',
      english: 'english',
    });

    assertEquals(alias, [
      'english',
      'native',
    ]);
  });
});