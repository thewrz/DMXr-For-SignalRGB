# logging/ — Pipeline Logger

## pipeline-logger.ts

Verbose DMX pipeline tracing for debugging channel mapping, color processing,
and DMX output. Separate from Fastify's logger since pipeline events fire at
high frequency on the UDP hot path.

## Log Levels

`error` < `warn` < `info` < `debug` < `verbose`

Set via `PIPELINE_LOG` env var (defaults to `"verbose"`).

## Key Exports

- `pipeLog(level, msg)` — writes `[PIPE:TAG] msg` to stdout if level is enabled
- `shouldSample(key, intervalMs=5000)` — rate-limited logging for hot paths;
  fires on first call, then at most every `intervalMs` thereafter
- `resetSample(key)` / `resetAllSamples()` — force next log to fire
- `setPipelineLogLevel(level)` / `getPipelineLogLevel()`
- `parsePipelineLogLevel(raw)` — safely parses env var string

## Usage Pattern

Hot-path functions (mapColor, processColorBatch, UDP handler) guard verbose
logs behind `shouldSample()` to avoid flooding:

```ts
if (shouldSample(`mapColor:${fixture.id}`)) {
  pipeLog("verbose", `DMX UPDATE ...`);
}
```
