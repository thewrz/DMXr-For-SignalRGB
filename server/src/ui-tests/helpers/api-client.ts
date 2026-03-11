import type { AddFixtureRequest, FixtureConfig } from "../../types/protocol.js";

/**
 * HTTP client for seeding test data via the DMXr API.
 */
export class TestApiClient {
  constructor(private readonly baseUrl: string) {}

  async addFixture(fixture: AddFixtureRequest): Promise<FixtureConfig> {
    const res = await fetch(`${this.baseUrl}/fixtures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fixture),
    });
    if (!res.ok) throw new Error(`addFixture failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async getFixtures(): Promise<FixtureConfig[]> {
    const res = await fetch(`${this.baseUrl}/fixtures`);
    if (!res.ok) throw new Error(`getFixtures failed: ${res.status}`);
    return res.json();
  }

  async deleteFixture(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/fixtures/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`deleteFixture failed: ${res.status}`);
  }

  async deleteAllFixtures(): Promise<void> {
    const fixtures = await this.getFixtures();
    for (const f of fixtures) {
      await this.deleteFixture(f.id);
    }
  }

  async updateFixture(id: string, changes: Record<string, unknown>): Promise<FixtureConfig> {
    const res = await fetch(`${this.baseUrl}/fixtures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    if (!res.ok) throw new Error(`updateFixture failed: ${res.status}`);
    return res.json();
  }

  async getHealth(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.json();
  }
}
