# Public Data evidence wire values

`@univers/data-evidence-contract` contains the existing
`BoundedDataMaterializationReceipt` shape and
`normalizeBoundedDataMaterializationReceipts` decoder, plus
`GeneratedSignalStandardEvidenceSummary` and
`summarizeGeneratedSignalStandardEvidence`. There are no runtime dependencies,
HTTP clients, React components, global registries or owner implementation imports.

The receipt decoder checks the existing `bounded_data_materialization.v1` wire
shape, rejects invalid/negative sample counts, preserves missing source fields
and deduplicates by receiptId (later input replaces earlier input). It does not
create observations, infer freshness, or turn unverified receipt flags into
measured evidence.

The generated-signal helper compares the protocol shape with source/provenance
values explicitly supplied by the caller. Its `standard` result means matching
wire metadata, not authorization, verified content, measured provenance or
selected-World semantic acceptance. Owners retain those decisions, time-window
and scope checks, HTTP transport and lifecycle policy.

These unchanged wire definitions and existing regression tests were extracted
from `hvac-workbench` commit `04b106a8467975276bfe70577b3d1e824521492e`,
`packages/modules/types/src/generated-signal-evidence.ts`. Forecast/Scenario consumers can use these values without a modules-types or SDK
link.

Install `@univers/data-evidence-contract@0.1.0` from the private Univers npm
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
