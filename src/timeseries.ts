import type { TimeSeriesDataPoint, TimeSeriesReadReceipt, TimeSeriesReadWindow } from './timeseries-types.js';
export type * from './timeseries-types.js';

export interface SignalReadScope {
  organizationId?: string | null;
  worldInstanceId?: string | null;
  worldRevision?: string | number | null;
}

/** Raw public response. Extra backend evidence remains available without SDK normalization. */
export interface SignalTimeSeriesReadResponse {
  point_id: string;
  start: number;
  end: number;
  count: number;
  data: TimeSeriesDataPoint[];
  read_receipt: TimeSeriesReadReceipt;
  freshness_window?: Record<string, unknown> | null;
  trust_evidence?: Record<string, unknown> | null;
  stale?: boolean | null;
  [field: string]: unknown;
}

export class TimeSeriesReadContractError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'TimeSeriesReadContractError';
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const text = (value: unknown): value is string => typeof value === 'string';
const nullableText = (value: unknown): boolean => value == null || text(value);
const safeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);

export function requireSignalReadBoundedWindow(
  query: unknown,
): asserts query is TimeSeriesReadWindow {
  if (!record(query) || !safeInteger(query.start) || !safeInteger(query.end) || query.start >= query.end) {
    throw new TimeSeriesReadContractError('SIGNAL_TIMESERIES_BOUNDED_WINDOW_REQUIRED',
      'Signal reads require explicit safe integer millisecond start/end with start < end.');
  }
}

function isReceipt(value: unknown): value is TimeSeriesReadReceipt {
  if (!record(value)) return false;
  const { binding: b, continuation: c, freshness: f, integrity: i, recovery: r, retention: t, snapshot: s, unit: u } = value;
  return record(b) && record(b.window) && text(b.dataNamespace) && text(b.resourceId)
    && nullableText(b.resourceRevision) && nullableText(b.cas) && text(b.worldInstanceId) && text(b.worldRevision)
    && safeInteger(b.window.start) && safeInteger(b.window.end)
    && record(c) && typeof c.complete === 'boolean' && safeInteger(c.pageOrdinal) && c.pageOrdinal >= 0
    && nullableText(c.nextCursor) && nullableText(c.previousReceiptId) && text(c.queryFingerprint) && nullableText(c.truncationReason)
    && record(f) && text(f.asOf) && text(f.state)
    && record(i) && text(i.algorithm) && text(i.digest) && text(i.status)
    && typeof value.immutable === 'boolean' && text(value.receiptId)
    && record(r) && typeof r.retrySafe === 'boolean' && text(r.status)
    && record(t) && text(t.status) && nullableText(t.policyId) && nullableText(t.retainUntil)
    && record(s) && text(s.capturedAt) && text(s.id) && typeof s.immutable === 'boolean'
    && record(u) && text(u.status) && nullableText(u.unit) && nullableText(u.fingerprint);
}

function unknownRetention(status: string): boolean {
  return !status || ['unknown', 'unavailable', 'none', 'not_reported'].includes(status);
}
function limitedRetention(status: string): boolean {
  return ['expired', 'archived', 'truncated', 'retention_truncated'].includes(status);
}

/** Validate wire/binding claims; this does not recompute the sample digest or authorize a caller. */
export function requireSignalTimeseriesReadReceipt(
  response: unknown, canonicalId: string, query: TimeSeriesReadWindow, scope: SignalReadScope,
): TimeSeriesReadReceipt {
  requireSignalReadBoundedWindow(query);
  const candidate = record(response) ? response.read_receipt : undefined;
  const invalid = () => new TimeSeriesReadContractError('SIGNAL_TIMESERIES_READ_RECEIPT_INVALID',
    'Signal read requires an immutable receipt bound to the selected World, canonical series generation/CAS and exact window.');
  if (!isReceipt(candidate)) throw invalid();
  const receipt = candidate;
  const organizationId = scope.organizationId?.trim();
  const worldInstanceId = scope.worldInstanceId?.trim();
  const revision = receipt.binding.resourceRevision;
  const expectedWorldRevision = scope.worldRevision == null ? null : String(scope.worldRevision).trim();
  const reason = receipt.continuation.truncationReason?.trim() || null;
  const status = receipt.retention.status.trim().toLowerCase();
  const unknown = unknownRetention(status);
  const policy = receipt.retention.policyId?.trim();
  const until = receipt.retention.retainUntil?.trim();
  const recovery = !receipt.continuation.complete
    ? receipt.continuation.nextCursor ? 'continuation_required' : 'narrower_window_required'
    : unknown ? 'retention_evidence_required' : limitedRetention(status) ? 'narrower_window_required' : 'not_required';
  if (!(receipt.immutable && receipt.snapshot.immutable && organizationId && worldInstanceId
    && receipt.binding.dataNamespace === `data:${organizationId}:${worldInstanceId}`
    && receipt.binding.worldInstanceId === worldInstanceId && receipt.binding.worldRevision
    && (expectedWorldRevision === null || receipt.binding.worldRevision === expectedWorldRevision)
    && receipt.binding.resourceId === canonicalId && revision != null && revision.trim()
    && receipt.binding.cas === `series-generation:${revision}`
    && receipt.binding.window.start === query.start && receipt.binding.window.end === query.end
    && (!receipt.continuation.complete || receipt.continuation.pageOrdinal === 0)
    && (receipt.continuation.complete ? !receipt.continuation.nextCursor && reason === null : reason !== null)
    && receipt.recovery.status === recovery && receipt.integrity.algorithm === 'sha256'
    && /^sha256:[0-9a-f]{64}$/.test(receipt.integrity.digest) && status
    && (unknown ? !receipt.retention.policyId && !receipt.retention.retainUntil : policy && until && Number.isFinite(Date.parse(until))))) {
    throw invalid();
  }
  return receipt;
}

/** Accept direct or {data: response} wire envelopes without inventing fields or freshness. */
export function decodeSignalTimeSeriesResponse(
  input: unknown, canonicalId: string, query: TimeSeriesReadWindow, scope: SignalReadScope,
): SignalTimeSeriesReadResponse {
  const response = record(input) && record(input.data) ? input.data : input;
  if (!record(response) || !text(response.point_id) || !safeInteger(response.start) || !safeInteger(response.end)
    || !safeInteger(response.count) || response.count < 0 || !Array.isArray(response.data)
    || !response.data.every(point => record(point) && safeInteger(point.timestamp)
      && typeof point.value === 'number' && Number.isFinite(point.value)
      && (point.quality == null || (typeof point.quality === 'number' && Number.isFinite(point.quality))))
    || !['freshness_window', 'trust_evidence'].every(key => response[key] == null ||
      (record(response[key]) && (response[key].warnings == null || strings(response[key].warnings))))
    || (response.stale != null && typeof response.stale !== 'boolean')) {
    throw new TimeSeriesReadContractError('SIGNAL_TIMESERIES_RESPONSE_INVALID', 'Signal response has invalid required wire fields.');
  }
  requireSignalTimeseriesReadReceipt(response, canonicalId, query, scope);
  return response as unknown as SignalTimeSeriesReadResponse;
}

export interface SignalTimeseriesReadEvidence {
  invalidEvidenceReasons: string[];
  missingEvidence: string[];
  warnings: string[];
}

/** Diagnostic value classification only; no positive decision/authorization grant is produced. */
export function signalTimeseriesReadEvidence(
  receipt: TimeSeriesReadReceipt | null | undefined, scope?: SignalReadScope,
): SignalTimeseriesReadEvidence {
  const result: SignalTimeseriesReadEvidence = { invalidEvidenceReasons: [], missingEvidence: [], warnings: [] };
  if (!scope?.organizationId?.trim() || !scope.worldInstanceId?.trim()) result.missingEvidence.push('read_receipt.selected_world_scope');
  if (!receipt) { result.missingEvidence.push('read_receipt'); return result; }
  if (!receipt.continuation.complete) {
    result.invalidEvidenceReasons.push('read_receipt.continuation.partial');
    result.warnings.push('Signal read is partial; diagnostic samples must not be used for decisions.');
  }
  const freshness = receipt.freshness.state.trim().toLowerCase();
  if (freshness !== 'fresh') result.invalidEvidenceReasons.push(`read_receipt.freshness.${freshness || 'unknown'}`);
  const retention = receipt.retention.status.trim().toLowerCase();
  if (unknownRetention(retention)) {
    result.missingEvidence.push('read_receipt.retention');
    result.warnings.push('Backend retention is unknown; canonical window completeness is not evaluable.');
  } else if (retention !== 'retained') {
    result.invalidEvidenceReasons.push(`read_receipt.retention.${retention || 'unknown'}`);
    result.warnings.push(`Backend retention status is ${retention || 'unknown'}; returned samples are diagnostic only.`);
  } else if (!receipt.retention.policyId?.trim() || !receipt.retention.retainUntil?.trim() || !Number.isFinite(Date.parse(receipt.retention.retainUntil))) {
    result.missingEvidence.push('read_receipt.retention_policy');
  }
  if (receipt.recovery.status !== 'not_required') result.invalidEvidenceReasons.push(`read_receipt.recovery.${receipt.recovery.status}`);
  return result;
}
