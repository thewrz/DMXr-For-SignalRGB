import type { ServerConfig } from "../config/server-config.js";
import type { OflClient } from "../ofl/ofl-client.js";
import type { UserFixtureStore } from "../fixtures/user-fixture-store.js";
import type { LibraryRegistry } from "../libraries/types.js";
import { createSsClientIfConfigured } from "../soundswitch/ss-client.js";
import { createLocalDbProvider } from "../libraries/local-db-provider.js";
import { createUserFixtureProvider } from "../libraries/user-fixture-provider.js";
import { createBuiltinTemplateProvider } from "../libraries/builtin-template-provider.js";
import { createOflProvider } from "../libraries/ofl-provider.js";
import { createLibraryRegistry } from "../libraries/registry.js";

export function createLibraryStack(
  config: ServerConfig,
  oflClient: OflClient,
  userFixtureStore: UserFixtureStore,
): LibraryRegistry {
  const { client: ssClient, status: ssStatus } = createSsClientIfConfigured(config.localDbPath);

  const oflProvider = createOflProvider(oflClient);
  const localDbProvider = createLocalDbProvider(ssClient, ssStatus);
  const userFixtureProvider = createUserFixtureProvider(userFixtureStore);
  const builtinProvider = createBuiltinTemplateProvider();

  return createLibraryRegistry([oflProvider, localDbProvider, userFixtureProvider, builtinProvider]);
}
