# utils/ — Shared Utilities

## format.ts

### `shortId(id: string): string`

Truncates a UUID or long ID to its first 8 characters for log readability.

Used extensively in pipeline logging, fixture trace output, and startup
banner to keep log lines concise while still providing enough context to
identify the fixture or entity being referenced.

```ts
shortId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
// => "a1b2c3d4"
```
