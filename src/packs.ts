import _anilistManifest from '../packs/anilist/manifest.json' assert {
  type: 'json',
};

import _vtubersManifest from '../packs/vtubers/manifest.json' assert {
  type: 'json',
};

import * as _anilist from '../packs/anilist/index.ts';

import * as discord from './discord.ts';

import { gql, request } from './graphql.ts';

import config, { faunaUrl } from './config.ts';

import validate, { purgeReservedProps } from './validate.ts';

import utils from './utils.ts';
import github from './github.ts';

import {
  Alias,
  Character,
  CharacterRole,
  DisaggregatedCharacter,
  DisaggregatedMedia,
  Manifest,
  Media,
  MediaFormat,
  MediaRelation,
  Pack,
  PackType,
  Pool,
  Schema,
} from './types.ts';

import { NonFetalError } from './errors.ts';

const anilistManifest = _anilistManifest as Manifest;
const vtubersManifest = _vtubersManifest as Manifest;

type All = Media | DisaggregatedMedia | Character | DisaggregatedCharacter;

const cachedGuilds: Record<string, Pack[]> = {};

const packs = {
  aggregate,
  aliasToArray,
  all,
  anilist,
  characters,
  formatToString,
  install,
  isDisabled,
  media,
  mediaCharacters,
  mediaToString,
  pages,
  pool,
  remove,
  searchMany,
  cachedGuilds,
};

async function anilist(
  name: string,
  interaction: discord.Interaction<unknown>,
): Promise<discord.Message> {
  // deno-lint-ignore no-non-null-assertion
  const command = anilistManifest.commands![name];

  return await _anilist.default
    [command.source as keyof typeof _anilist.default](
      // deno-lint-ignore no-explicit-any
      interaction.options as any,
    );
}

async function all(
  { guildId, type }: {
    guildId?: string;
    type?: PackType;
  },
): Promise<(Pack[])> {
  const query = gql`
    query ($guildId: String!) {
      getGuildInstance(guildId: $guildId) {
        packs {
        id
        installedBy {
          id
        }
        manifest {
          id
          title
          description
          author
          image
          url
          nsfw
          media {
            conflicts
            new {
              id
              type
              title {
                english
                romaji
                native
                alternative
              }
              format
              description
              popularity
              images {
                url
                artist {
                  username
                  url
                }
              }
              externalLinks {
                url
                site
              }
              trailer {
                id
                site
              }
              relations {
                relation
                mediaId
              }
              characters {
                role
                characterId
              }
            }
          }
          characters {
            conflicts
            new {
              id
              name {
                english
                romaji
                native
                alternative
              }
              description
              popularity
              gender
              age
              images {
                url
                artist {
                  username
                  url
                }
              }
              externalLinks {
                url
                site
              }
              media {
                role
                mediaId
              }
            }
          }
        }
      }
    }
  }
  `;

  switch (type) {
    case PackType.Builtin:
      return [
        { manifest: anilistManifest, type: PackType.Builtin },
        { manifest: vtubersManifest, type: PackType.Builtin },
      ];
    case PackType.Community: {
      if (!guildId || !config.communityPacks) {
        return [];
      }

      // TODO TEST
      if (packs.cachedGuilds[guildId]) {
        return packs.cachedGuilds[guildId];
      }

      const response = (await request<{
        getGuildInstance: { packs: Pack[] };
      }>({
        query,
        url: faunaUrl,
        headers: { 'authorization': `Bearer ${config.faunaSecret}` },
        variables: { guildId },
      })).getGuildInstance;

      response.packs
        .forEach((pack) => pack.type = PackType.Community);

      packs.cachedGuilds[guildId] = response.packs;

      return response.packs;
    }
    default: {
      const builtins = [
        { manifest: vtubersManifest, type: PackType.Builtin },
      ];

      if (!guildId || !config.communityPacks) {
        return builtins;
      }

      // TODO TEST
      if (packs.cachedGuilds[guildId]) {
        return [...builtins, ...packs.cachedGuilds[guildId]];
      }

      const response = (await request<{
        getGuildInstance: { packs: Pack[] };
      }>({
        query,
        url: faunaUrl,
        headers: { 'authorization': `Bearer ${config.faunaSecret}` },
        variables: { guildId },
      })).getGuildInstance;

      response.packs
        .forEach((pack) => pack.type = PackType.Community);

      packs.cachedGuilds[guildId] = response.packs;

      return [...builtins, ...response.packs];
    }
  }
}

// TODO update tests
function isDisabled(id: string, guildId: string): boolean {
  const disabled: Record<string, boolean> = {};

  const list = packs.cachedGuilds[guildId];

  // TODO refactor to avoid recalculating
  list.forEach(({ manifest }) => {
    manifest.media?.conflicts?.forEach((id) => disabled[id] = true);
    manifest.characters?.conflicts?.forEach((id) => disabled[id] = true);
  });

  return disabled[id];
}

// TODO update tests
function dict(guildId: string): { [key: string]: Manifest } {
  const list = packs.cachedGuilds[guildId];

  // TODO refactor to avoid recalculating
  return list.reduce(
    (
      obj: { [key: string]: Manifest },
      pack,
    ) => (obj[pack.manifest.id] = pack.manifest, obj),
    {},
  );
}

function manifestEmbed(manifest: Manifest): discord.Embed {
  return new discord.Embed()
    .setUrl(manifest.url)
    .setDescription(manifest.description)
    .setAuthor({ name: manifest.author })
    .setThumbnail({ url: manifest.image, default: false, proxy: false })
    .setTitle(manifest.title ?? manifest.id);
}

// TODO UPDATE TEST
async function pages(
  { type, index, guildId }: {
    index: number;
    type: PackType;
    guildId: string;
  },
): Promise<discord.Message> {
  const list = await packs.all({ type, guildId });

  if (!list.length) {
    const embed = new discord.Embed().setDescription(
      'No packs have been installed yet',
    );

    return new discord.Message()
      .addEmbed(embed);
  }

  const pack = list[index];

  const disclaimer = new discord.Embed().setDescription(
    pack.type === PackType.Builtin
      ? 'Builtin packs are developed and maintained directly by Fable'
      : 'The following third-party packs were manually installed by your server members',
  );

  const embed = manifestEmbed(pack.manifest);

  const message = new discord.Message()
    .addEmbed(disclaimer)
    .addEmbed(embed);

  return discord.Message.page({
    index,
    total: list.length,
    next: list.length > index + 1,
    message,
    type,
  });
}

function install({
  token,
  shallow,
  userId,
  guildId,
  url,
  ref,
}: {
  token: string;
  userId: string;
  guildId: string;
  url: string;
  ref?: string;
  shallow?: boolean;
}): discord.Message {
  github.manifest({ url, ref })
    .then(async ({ repo, manifest }) => {
      const message = new discord.Message();

      // validate against json schema
      const valid = validate(manifest);

      if (valid.error && shallow) {
        return await new discord.Message()
          .addEmbed(
            new discord.Embed()
              .setColor(discord.colors.red)
              .setDescription(`\`\`\`json\n${valid.error}\n\`\`\``),
          )
          .patch(token);
      } else if (valid.error) {
        throw new NonFetalError('Pack is invalid and cannot be installed.');
      }

      // shallow install is only meant as validation test
      if (shallow) {
        return await new discord.Message()
          .addEmbed(
            new discord.Embed()
              .setColor(discord.colors.green)
              .setDescription('Valid'),
          )
          .patch(token);
      }

      // check installed packs for dependencies and conflicts

      const list = await packs.all({ guildId });

      const ids = list.map(({ manifest }) => manifest.id);

      // if this pack conflicts existing
      const conflicts = (manifest.conflicts ?? []).filter((conflictId) =>
        ids.includes(conflictId)
      ).concat(
        // if existing conflicts this pack
        // TODO UPDATE TEST
        list
          .filter((pack) => pack.manifest.conflicts?.includes(manifest.id))
          .map(({ manifest }) => manifest.id),
      );

      const missing = manifest.depends?.filter((dependId) =>
        !ids.includes(dependId)
      );

      if (
        (conflicts && conflicts?.length > 0) ||
        (missing && missing?.length > 0)
      ) {
        const message = new discord.Message();

        if (conflicts && conflicts?.length) {
          message.addEmbed(
            new discord.Embed()
              .setDescription(
                '__Conflicts must be removed before you can install this pack__.',
              ),
          );

          conflicts.forEach((conflict) => {
            message.addEmbed(
              new discord.Embed().setDescription(
                `This pack conflicts with ${conflict}`,
              ),
            );
          });
        }

        if (missing && missing?.length) {
          message.addEmbed(
            new discord.Embed()
              .setDescription(
                '__Dependencies must be installed before you can install this pack__.',
              ),
          );

          missing.forEach((dependency) => {
            message.addEmbed(
              new discord.Embed().setDescription(
                `This pack requires ${dependency}`,
              ),
            );
          });
        }

        return await message.patch(token);
      }

      // add pack to the guild database

      const mutation = gql`
        mutation (
          $userId: String!
          $guildId: String!
          $githubId: Int!
          $manifest: ManifestInput!
        ) {
          addPackToInstance(
            userId: $userId
            guildId: $guildId
            githubId: $githubId
            manifest: $manifest
          ) {
            ok
            error
            manifest {
              id
              title
              description
              author
              image
              url
            }
          }
        }
      `;

      const response = (await request<{
        addPackToInstance: Schema.Mutation;
      }>({
        url: faunaUrl,
        query: mutation,
        headers: {
          'authorization': `Bearer ${config.faunaSecret}`,
        },
        variables: {
          userId,
          guildId,
          githubId: repo.id,
          manifest: purgeReservedProps(manifest),
        },
      })).addPackToInstance;

      if (response.ok) {
        message
          .addEmbed(new discord.Embed().setDescription('INSTALLED'))
          .addEmbed(manifestEmbed(response.manifest));

        return message.patch(token);
      } else {
        switch (response.error) {
          case 'PACK_ID_CHANGED':
            throw new NonFetalError(
              `Pack id changed. Found \`${manifest.id}\` but it should ne \`${response.manifest.id}\``,
            );
          default:
            throw new Error(response.error);
        }
      }
    })
    .catch(async (err) => {
      if (err instanceof NonFetalError) {
        return await new discord.Message()
          .addEmbed(
            new discord.Embed()
              .setDescription(err.message),
          )
          .patch(token);
      }

      if (!config.sentry) {
        throw err;
      }

      const refId = utils.captureException(err);

      await discord.Message.internal(refId).patch(token);
    });

  return new discord.Message()
    .setType(discord.MessageType.Loading);
}

async function remove({
  guildId,
  manifestId,
}: {
  guildId: string;
  manifestId: string;
}): Promise<discord.Message> {
  const message = new discord.Message();

  const mutation = gql`
    mutation ($guildId: String!, $manifestId: String!) {
      removePackFromInstance(
        guildId: $guildId
        manifestId: $manifestId
      ) {
        ok
        error
        manifest {
          id
          title
          description
          author
          image
          url
        }
      }
    }
  `;

  const response = (await request<{
    removePackFromInstance: Schema.Mutation;
  }>({
    url: faunaUrl,
    query: mutation,
    headers: {
      'authorization': `Bearer ${config.faunaSecret}`,
    },
    variables: {
      guildId,
      manifestId,
    },
  })).removePackFromInstance;

  if (response.ok) {
    return message
      .addEmbed(new discord.Embed().setDescription('REMOVED'))
      .addEmbed(manifestEmbed(response.manifest));
  } else {
    switch (response.error) {
      case 'PACK_NOT_FOUND':
      case 'PACK_NOT_INSTALLED':
        throw new Error('404');
      default:
        throw new Error(response.error);
    }
  }
}

function parseId(
  literal: string,
  defaultPackId?: string,
): [string | undefined, string | undefined] {
  const split = /^([-_a-z0-9]+):([-_a-z0-9]+)$/.exec(literal);

  if (split?.length === 3) {
    const [, packId, id] = split;
    return [packId, id];
  } else if (defaultPackId && /^([-_a-z0-9]+)$/.test(literal)) {
    return [defaultPackId, literal];
  }

  return [undefined, undefined];
}

async function findById<T>(
  { key, ids, guildId, defaultPackId }: {
    key: 'media' | 'characters';
    ids: string[];
    guildId: string;
    defaultPackId?: string;
  },
): Promise<{ [key: string]: T }> {
  const anilistIds: number[] = [];

  const results: { [key: string]: T } = {};

  // filter out disabled ids
  ids = ids.filter((id) => !packs.isDisabled(id, guildId));

  for (const literal of [...new Set(ids)]) {
    const [packId, id] = parseId(literal, defaultPackId);

    if (!packId || !id) {
      continue;
    }

    if (packId === 'anilist') {
      const n = utils.parseInt(id);

      if (typeof n === 'number') {
        anilistIds.push(n);
      }
    } else {
      // search for the id in packs
      // deno-lint-ignore no-explicit-any
      const match: All = (dict(guildId)[packId]?.[key]?.new as Array<any>)
        ?.find((m) => m.id === id);

      if (match) {
        results[literal] = (match.packId = packId, match) as T;
      }
    }
  }

  // request the ids from anilist
  const anilistResults = await _anilist[key](
    { ids: anilistIds },
  );

  anilistResults.forEach((item) =>
    results[`anilist:${item.id}`] = _anilist.transform<T>({ item })
  );

  return results;
}

async function searchMany<
  T extends (Media | DisaggregatedMedia | Character | DisaggregatedCharacter),
>(
  { key, search, guildId, threshold }: {
    key: 'media' | 'characters';
    search: string;
    guildId: string;
    threshold?: number;
  },
): Promise<T[]> {
  threshold = threshold ?? 65;

  const percentages: Set<number> = new Set();

  const possibilities: { [percentage: number]: T[] } = {};

  const anilistPack: Manifest = {
    id: 'anilist',
    [key]: {
      new: (await _anilist[key]({ search })).map((item) =>
        _anilist.transform({ item })
      ),
    },
  };

  const list = await packs.all({ guildId });

  for (const pack of [anilistPack, ...list.map(({ manifest }) => manifest)]) {
    for (const item of pack[key]?.new ?? []) {
      // filter out disabled ids
      if (packs.isDisabled(`${pack.id}:${item.id}`, guildId)) {
        continue;
      }

      const all = packs.aliasToArray(
        'name' in item ? item.name : item.title,
      ).map((alias) => utils.distance(search, alias));

      if (!all.length) {
        return [];
      }

      const percentage = Math.max(...all);

      if (percentage < threshold) {
        continue;
      }

      if (!possibilities[percentage]) {
        possibilities[percentage] = (percentages.add(percentage), []);
      }

      possibilities[percentage]
        .push((item.packId = pack.id, item) as T);
    }
  }

  const sorted = [...percentages]
    .sort((a, b) => b - a);

  let output: T[] = [];

  for (const i of sorted) {
    output = output.concat(
      possibilities[i].sort((a, b) =>
        (b.popularity || 0) - (a.popularity || 0)
      ),
    );
  }

  return output;
}

async function searchOne<
  T extends (Media | DisaggregatedMedia | Character | DisaggregatedCharacter),
>(
  { key, search, guildId }: {
    key: 'media' | 'characters';
    search: string;
    guildId: string;
  },
): Promise<T | undefined> {
  const possibilities = await searchMany<T>({ key, search, guildId });
  return possibilities?.[0];
}

async function media({ ids, search, guildId }: {
  ids?: string[];
  search?: string;
  guildId: string;
}): Promise<(Media | DisaggregatedMedia)[]> {
  if (ids?.length) {
    const results = await findById<Media | DisaggregatedMedia>(
      {
        ids,
        guildId,
        key: 'media',
      },
    );

    return Object.values(results);
  } else if (search) {
    const match: Media | DisaggregatedMedia | undefined = await searchOne(
      { key: 'media', search, guildId },
    );

    return match ? [match] : [];
  } else {
    return [];
  }
}

async function characters({ ids, search, guildId }: {
  ids?: string[];
  search?: string;
  guildId: string;
}): Promise<(Character | DisaggregatedCharacter)[]> {
  if (ids?.length) {
    const results = await findById<Character | DisaggregatedCharacter>(
      {
        ids,
        guildId,
        key: 'characters',
      },
    );

    return Object.values(results);
  } else if (search) {
    const match: Character | DisaggregatedCharacter | undefined =
      await searchOne(
        { key: 'characters', search, guildId },
      );

    return match ? [match] : [];
  } else {
    return [];
  }
}

async function mediaCharacters({ mediaId, guildId, index }: {
  mediaId: string;
  guildId: string;
  index: number;
}): Promise<
  {
    media?: Media | DisaggregatedMedia;
    character?: Character | DisaggregatedCharacter;
    total?: number;
    next: boolean;
  }
> {
  const [packId, id] = parseId(mediaId);

  if (packs.isDisabled(mediaId, guildId) || !packId || !id) {
    throw new Error('404');
  }

  if (packId === 'anilist') {
    return _anilist.mediaCharacters({
      id,
      index,
    });
  } else {
    // search for the id in packs
    const match: Media | DisaggregatedMedia | undefined = dict(guildId)[packId]
      ?.media
      ?.new?.find((m) => m.id === id);

    if (!match) {
      return { next: false };
    }

    match.packId = packId;

    const total = match?.characters?.length ?? 0;

    const media = await aggregate<Media>({
      media: match,
      start: index,
      end: 1,
      guildId,
    });

    return {
      total,
      media,
      character: media?.characters?.edges?.[0]?.node,
      next: index + 1 < total,
    };
  }
}

async function aggregate<T>({ media, character, start, end, guildId }: {
  media?: Media | DisaggregatedMedia;
  character?: Character | DisaggregatedCharacter;
  start?: number;
  end?: number;
  guildId: string;
}): Promise<T> {
  start = start || 0;

  if (end) {
    end = start + (end || 1);
  }

  if (media) {
    if (
      (media.relations && 'edges' in media.relations) ||
      (media.characters && 'edges' in media.characters)
    ) {
      if (media.relations && 'edges' in media.relations) {
        media.relations.edges = media.relations.edges.filter((edge) =>
          !packs.isDisabled(`anilist:${edge.node.id}`, guildId)
        );
      }

      if (media.characters && 'edges' in media.characters) {
        media.characters.edges = media.characters.edges.filter((edge) =>
          !packs.isDisabled(`anilist:${edge.node.id}`, guildId)
        );
      }

      return media as T;
    }

    media = media as DisaggregatedMedia;

    const mediaIds = (media.relations instanceof Array
      ? media.relations.slice(start, end)
      : [])
      .map((
        { mediaId },
      ) =>
        mediaId
      );

    const characterIds = (media.characters instanceof Array
      ? media.characters.slice(start, end)
      : [])
      .map((
        { characterId },
      ) => characterId);

    const [mediaRefs, characterRefs] = await Promise.all([
      findById<Media>({
        guildId,
        key: 'media',
        ids: mediaIds,
        defaultPackId: media.packId,
      }),
      findById<Character>({
        guildId,
        key: 'characters',
        ids: characterIds,
        defaultPackId: media.packId,
      }),
    ]);

    const t: Media = {
      ...media,
      relations: {
        edges: media.relations?.slice(start, end)
          ?.filter(({ mediaId }) => {
            // deno-lint-ignore no-non-null-assertion
            const [packId, id] = parseId(mediaId, media!.packId);
            return !packs.isDisabled(`${packId}:${id}`, guildId);
          })
          ?.map(({ relation, mediaId }) => ({
            relation,
            node: mediaRefs[mediaId],
          })).filter(({ node }) => Boolean(node)) ?? [],
      },
      characters: {
        edges: media.characters?.slice(start, end)
          ?.filter(({ characterId }) => {
            // deno-lint-ignore no-non-null-assertion
            const [packId, id] = parseId(characterId, media!.packId);
            return !packs.isDisabled(`${packId}:${id}`, guildId);
          })
          ?.map(({ role, characterId }) => ({
            role,
            node: characterRefs[characterId],
          })).filter(({ node }) => Boolean(node)) ?? [],
      },
    };

    return t as T;
  } else if (character) {
    if (character.media && 'edges' in character.media) {
      character.media.edges = character.media.edges.filter((edge) =>
        !packs.isDisabled(`anilist:${edge.node.id}`, guildId)
      );
      return character as T;
    }

    character = character as DisaggregatedCharacter;

    const mediaIds = (character.media instanceof Array
      ? character.media.slice(start, end)
      : [])
      .map((
        { mediaId },
      ) =>
        mediaId
      );

    const [mediaRefs] = [
      await findById<Media>({
        guildId,
        key: 'media',
        ids: mediaIds,
        defaultPackId: character.packId,
      }),
    ];

    const t: Character = {
      ...character,
      media: {
        edges: character.media?.slice(start, end)
          ?.filter(({ mediaId }) => {
            // deno-lint-ignore no-non-null-assertion
            const [packId, id] = parseId(mediaId, character!.packId);
            return !packs.isDisabled(`${packId}:${id}`, guildId);
          })
          ?.map(({ role, mediaId }) => ({
            role,
            node: mediaRefs[mediaId],
          })).filter(({ node }) => Boolean(node)) ?? [],
      },
    };

    return t as T;
  }

  throw new Error();
}

async function pool({ guildId, range, role }: {
  guildId: string;
  range: number[];
  role?: CharacterRole;
}): Promise<Pool['']['ALL']> {
  // TODO UPDATE TEST
  const [list, anilist] = await Promise.all([
    packs.all({ guildId }),
    utils.readJson<Pool>('packs/anilist/pool.json'),
  ]);

  const pool = anilist[JSON.stringify(range)][role || 'ALL'];

  list.forEach(({ manifest }) => {
    if (manifest.characters && Array.isArray(manifest.characters.new)) {
      const characters = manifest.characters.new.map(({ id }) => ({
        id: `${manifest.id}:${id}`,
      }));

      pool.push(...characters);
    }
  });

  return pool;
}

function aliasToArray(
  alias: Alias,
  max?: number,
): string[] {
  const set = new Set(
    [
      alias.english,
      alias.romaji,
      alias.native,
    ]
      .concat(alias.alternative ?? [])
      .filter(Boolean)
      .map((str) => max ? utils.truncate(str, max) : str),
  );

  return Array.from(set) as string[];
}

function formatToString(format?: MediaFormat): string {
  if (!format || format === MediaFormat.Music) {
    return '';
  }

  return utils.capitalize(
    format
      .replace(/TV_SHORT|OVA|ONA/, 'Short')
      .replace('TV', 'Anime'),
  ) as string;
}

function mediaToString(
  { media, relation }: {
    media: Media | DisaggregatedMedia;
    relation?: MediaRelation;
  },
): string {
  const title = packs.aliasToArray(media.title, 40)[0];

  switch (relation) {
    case MediaRelation.Prequel:
    case MediaRelation.Sequel:
    case MediaRelation.SpinOff:
    case MediaRelation.SideStory:
      return [title, `(${utils.capitalize(relation)})`].join(' ');
    default: {
      const format = formatToString(media.format);

      if (!format) {
        return title;
      }

      return [title, `(${format})`].join(' ');
    }
  }
}

export default packs;