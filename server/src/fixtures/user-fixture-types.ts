import type { FixtureChannel } from "../types/protocol.js";

export interface UserFixtureMode {
  readonly id: string;
  readonly name: string;
  readonly channels: readonly FixtureChannel[];
}

export interface UserFixtureTemplate {
  readonly id: string;
  readonly name: string;
  readonly manufacturer: string;
  readonly category: string;
  readonly modes: readonly UserFixtureMode[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateUserFixtureRequest {
  readonly name: string;
  readonly manufacturer: string;
  readonly category: string;
  readonly modes: readonly {
    readonly name: string;
    readonly channels: readonly FixtureChannel[];
  }[];
}

export interface UpdateUserFixtureRequest {
  readonly name?: string;
  readonly manufacturer?: string;
  readonly category?: string;
  readonly modes?: readonly {
    readonly name: string;
    readonly channels: readonly FixtureChannel[];
  }[];
}
