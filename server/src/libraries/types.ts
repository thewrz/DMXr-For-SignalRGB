import type { FixtureChannel } from "../types/protocol.js";

export interface LibraryStatus {
  readonly available: boolean;
  readonly state: string;
  readonly path?: string;
  readonly error?: string;
  readonly fixtureCount?: number;
}

export interface LibraryManufacturer {
  readonly id: number;
  readonly name: string;
  readonly fixtureCount: number;
}

export interface LibraryFixture {
  readonly id: number;
  readonly name: string;
  readonly modeCount: number;
}

export interface LibraryMode {
  readonly id: number;
  readonly name: string;
  readonly channelCount: number;
}

export interface LibrarySearchResult {
  readonly fixtureId: number;
  readonly fixtureName: string;
  readonly mfrId: number;
  readonly mfrName: string;
  readonly modeCount: number;
  readonly category: string;
}

export interface FixtureLibraryProvider {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly type: "local-db" | "api";
  readonly status: () => LibraryStatus;
  readonly getManufacturers: () => readonly LibraryManufacturer[];
  readonly getFixtures: (manufacturerId: number) => readonly LibraryFixture[];
  readonly getFixtureModes: (fixtureId: number) => readonly LibraryMode[];
  readonly getModeChannels: (modeId: number) => readonly FixtureChannel[];
  readonly searchFixtures: (query: string, limit?: number) => readonly LibrarySearchResult[];
  readonly close?: () => void;
}

export interface LibraryRegistry {
  readonly getAll: () => readonly FixtureLibraryProvider[];
  readonly getById: (id: string) => FixtureLibraryProvider | undefined;
  readonly getAvailable: () => readonly FixtureLibraryProvider[];
}
