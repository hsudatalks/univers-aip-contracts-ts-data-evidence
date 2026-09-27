# Public Data evidence wire values

`@univers/data-evidence-contract` contains the existing
`BoundedDataMaterializationReceipt` shape and
`normalizeBoundedDataMaterializationReceipts` decoder, plus
`GeneratedSignalDeclaredFormatSummary` and
`summarizeGeneratedSignalDeclaredFormat`. There are no runtime dependencies,
HTTP clients, React components, global registries or owner implementation imports.

The receipt decoder checks the existing `bounded_data_materialization.v1` wire
shape, rejects invalid/negative sample counts, preserves missing source fields
and deduplicates by receiptId (later input replaces earlier input). It does not
create observations, infer freshness, or turn unverified receipt flags into
measured evidence.

The generated-signal helper compares declared protocol metadata with
source/provenance values explicitly supplied by the caller. Its
`declared_format_match` result is a diagnostic only: arbitrary content can have
the matching shape. It never means authorization, verified content, measured
provenance or selected-World semantic acceptance. Owners retain those decisions,
time-window and scope checks, HTTP transport and lifecycle policy.

Version 0.2.0 replaces the ambiguous positive `standard` status with
`declared_format_match` and adds `summarizeGeneratedSignalDeclaredFormat`.
The old function and type names remain as deprecated aliases, but return the
new diagnostic status. Consumers that compared against `standard` must update
their display logic; they must not count format match as verified World evidence.

These unchanged wire definitions and existing regression tests were extracted
from `hvac-workbench` commit `04b106a8467975276bfe70577b3d1e824521492e`,
`packages/modules/types/src/generated-signal-evidence.ts`. Forecast/Scenario consumers can use these values without a modules-types or SDK
link.

Install `@univers/data-evidence-contract@0.2.0` from the private Univers npm
Registry. Run `pnpm run check` / `pnpm run package`; publish an unchanged clean
committed candidate with `pnpm run publish:private` using external credentials.

Version 0.1.1 adds `@univers/data-evidence-contract/timeseries`: public read
receipt DTOs, `requireSignalReadBoundedWindow`,
`requireSignalTimeseriesReadReceipt`, `decodeSignalTimeSeriesResponse` and
`signalTimeseriesReadEvidence`. The decoder accepts direct or data-wrapped
responses, preserves backend fields/warnings and checks the exact supplied
World/resource/window binding, continuation/recovery, retention and SHA-256
digest shape. An expected World revision is checked when explicitly supplied.
It does not recompute the sample digest, choose a World, perform HTTP/auth,
generate CLI suggestions or grant positive decision authority. Consumers retain
point ordering/window/count limits, endpoint selection and presentation policy.
