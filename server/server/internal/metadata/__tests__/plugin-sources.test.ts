import test from "node:test";
import assert from "node:assert/strict";
import { MetadataSource } from "~/prisma/client/enums";
import {
  PLUGIN_METADATA_SOURCES,
  metadataSourceForPluginId,
} from "../plugin-sources";

test("known metadata plugins map to core MetadataSource values", () => {
  assert.equal(
    metadataSourceForPluginId("pcgamingwiki"),
    MetadataSource.PCGamingWiki,
  );
  assert.equal(
    metadataSourceForPluginId("steamgriddb"),
    MetadataSource.SteamGridDB,
  );
  assert.equal(
    metadataSourceForPluginId("mobygames"),
    MetadataSource.MobyGames,
  );
});

test("unknown metadata plugins are not persistable against the core enum", () => {
  assert.equal(metadataSourceForPluginId("not-a-provider"), undefined);
});

test("every mapped value is a real MetadataSource enum member", () => {
  const valid = new Set<string>(Object.values(MetadataSource));
  for (const source of Object.values(PLUGIN_METADATA_SOURCES)) {
    assert.ok(valid.has(source), `unexpected MetadataSource: ${source}`);
  }
});
