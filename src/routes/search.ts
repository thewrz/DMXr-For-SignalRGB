import type { FastifyInstance } from "fastify";
import type { OflClient } from "../ofl/ofl-client.js";
import type { LibraryRegistry } from "../libraries/types.js";

interface SearchRouteDeps {
  readonly oflClient: OflClient;
  readonly registry: LibraryRegistry;
}

interface SearchResult {
  readonly type: "fixture" | "manufacturer";
  readonly name: string;
  readonly manufacturer?: string;
  readonly source: string;
  readonly score: number;
  readonly fixtureId?: number;
  readonly mfrId?: number;
  readonly mfrKey?: string;
  readonly fixtureKey?: string;
  readonly modeCount?: number;
  readonly fixtureCount?: number;
  readonly categories?: readonly string[];
}

export function scoreResult(
  tokens: readonly string[],
  fixtureName: string,
  mfrName: string,
  categories?: readonly string[],
): number {
  const fixLower = fixtureName.toLowerCase();
  const mfrLower = mfrName.toLowerCase();
  const catsLower = (categories ?? []).map((c) => c.toLowerCase());
  let score = 0;

  for (const token of tokens) {
    if (fixLower === token) {
      score += 100;
    } else if (fixLower.startsWith(token)) {
      score += 50;
    } else if (fixLower.includes(token)) {
      score += 25;
    } else if (mfrLower === token) {
      score += 80;
    } else if (mfrLower.startsWith(token)) {
      score += 40;
    } else if (mfrLower.includes(token)) {
      score += 20;
    } else if (catsLower.some((c) => c === token)) {
      score += 60;
    } else if (catsLower.some((c) => c.includes(token))) {
      score += 30;
    } else {
      score -= 10;
    }
  }

  // Shorter fixture names score higher (more specific match)
  score += Math.max(0, 20 - fixtureName.length);

  return score;
}

function scoreMfrResult(
  tokens: readonly string[],
  mfrName: string,
): number {
  const mfrLower = mfrName.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (mfrLower === token) {
      score += 80;
    } else if (mfrLower.startsWith(token)) {
      score += 40;
    } else if (mfrLower.includes(token)) {
      score += 20;
    } else {
      score -= 10;
    }
  }

  return score;
}

export function registerSearchRoutes(
  app: FastifyInstance,
  deps: SearchRouteDeps,
): void {
  app.get<{ Querystring: { q?: string } }>(
    "/search",
    async (request) => {
      const raw = request.query.q ?? "";
      const tokens = raw
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter((t) => t.length >= 2);

      if (tokens.length === 0) return [];

      const results: SearchResult[] = [];
      const seen = new Set<string>();

      // Library provider fixture search (local-db, etc.)
      for (const provider of deps.registry.getAvailable()) {
        if (provider.id === "ofl") continue; // OFL handled separately below
        try {
          const libFixtures = provider.searchFixtures(raw);
          for (const f of libFixtures) {
            const key = `${provider.id}-fix-${f.fixtureId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const categories = f.category ? [f.category] : [];
            results.push({
              type: "fixture",
              name: f.fixtureName,
              manufacturer: f.mfrName,
              source: provider.id,
              score: scoreResult(tokens, f.fixtureName, f.mfrName, categories),
              fixtureId: f.fixtureId,
              mfrId: f.mfrId,
              modeCount: f.modeCount,
              categories,
            });
          }

          // Library manufacturer search
          const libMfrs = provider.getManufacturers();
          for (const m of libMfrs) {
            const mfrLower = m.name.toLowerCase();
            const matches = tokens.every((t) => mfrLower.includes(t));
            if (!matches) continue;
            const key = `${provider.id}-mfr-${m.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            results.push({
              type: "manufacturer",
              name: m.name,
              source: provider.id,
              score: scoreMfrResult(tokens, m.name),
              mfrId: m.id,
              fixtureCount: m.fixtureCount,
            });
          }
        } catch {
          // Library unavailable, continue with other sources
        }
      }

      // OFL fixture search (from cache)
      try {
        const oflFixtures = deps.oflClient.searchFixtures(raw);
        for (const f of oflFixtures) {
          const key = `ofl-fix-${f.mfrKey}/${f.fixtureKey}`;
          if (seen.has(key)) continue;
          seen.add(key);
          results.push({
            type: "fixture",
            name: f.fixtureName,
            manufacturer: f.mfrName,
            source: "ofl",
            score: scoreResult(tokens, f.fixtureName, f.mfrName, f.categories),
            mfrKey: f.mfrKey,
            fixtureKey: f.fixtureKey,
            categories: f.categories,
          });
        }

        // OFL manufacturer search (always available after first load)
        const oflMfrs = await deps.oflClient.getManufacturers();
        for (const [mfrKey, mfr] of Object.entries(oflMfrs)) {
          const mfrLower = mfr.name.toLowerCase();
          const matches = tokens.every((t) => mfrLower.includes(t));
          if (!matches) continue;
          const key = `ofl-mfr-${mfrKey}`;
          if (seen.has(key)) continue;
          seen.add(key);
          results.push({
            type: "manufacturer",
            name: mfr.name,
            source: "ofl",
            score: scoreMfrResult(tokens, mfr.name),
            mfrKey,
            fixtureCount: mfr.fixtureCount,
          });
        }
      } catch {
        // OFL unavailable
      }

      // Sort by score descending, return top 20
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, 20);
    },
  );
}
