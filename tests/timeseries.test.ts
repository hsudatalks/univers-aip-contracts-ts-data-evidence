import { describe, expect, it } from 'vitest';
import {
  decodeSignalTimeSeriesResponse, requireSignalReadBoundedWindow,
  requireSignalTimeseriesReadReceipt, signalTimeseriesReadEvidence,
  type TimeSeriesReadReceipt,
} from '../src/timeseries.js';

const scope = { organizationId: 'org-a', worldInstanceId: 'world-a', worldRevision: 7 };
const window = { start: 0, end: 10 };
function receipt(): TimeSeriesReadReceipt {
  return {
    receiptId: 'receipt:1', immutable: true,
    binding: { dataNamespace: 'data:org-a:world-a', worldInstanceId: 'world-a', worldRevision: '7',
      resourceId: 'signals:temperature', resourceRevision: '12', cas: 'series-generation:12', window: { ...window } },
    continuation: { complete: true, pageOrdinal: 0, queryFingerprint: 'query:1', nextCursor: null, previousReceiptId: null, truncationReason: null },
    freshness: { state: 'fresh', asOf: '2026-09-27T00:00:00Z' },
    integrity: { algorithm: 'sha256', digest: `sha256:${'a'.repeat(64)}`, status: 'computed' },
    recovery: { retrySafe: true, status: 'not_required' },
    retention: { status: 'retained', policyId: 'policy:1', retainUntil: '2030-01-01T00:00:00Z' },
    snapshot: { id: 'snapshot:1', capturedAt: '2026-09-27T00:00:00Z', immutable: true },
    unit: { status: 'reported', unit: 'C', fingerprint: 'unit:celsius' },
  };
}
function response() {
  return { point_id: 'signals:temperature', ...window, count: 1,
    data: [{ timestamp: 1, value: 21, quality: null }], read_receipt: receipt(),
    trust_evidence: { warnings: ['backend diagnostic'] }, extra_backend_evidence: { preserved: true } };
}

describe('Signal read public wire boundary', () => {
  it('preserves direct/enveloped responses, unknown quality and original backend warnings', () => {
    const body = response();
    expect(decodeSignalTimeSeriesResponse(body, 'signals:temperature', window, scope)).toBe(body);
    expect(decodeSignalTimeSeriesResponse({ data: body }, 'signals:temperature', window, scope)).toBe(body);
    expect(body.data[0].quality).toBeNull();
    expect(body.trust_evidence.warnings).toEqual(['backend diagnostic']);
    expect(body.extra_backend_evidence).toEqual({ preserved: true });
  });
  it.each([null, {}, { read_receipt: {} }, { read_receipt: { ...receipt(), binding: null } },
    { read_receipt: { ...receipt(), freshness: null } }, { read_receipt: { ...receipt(), unit: undefined } }])(
    'rejects malformed nested receipt structure without inventing values', value => {
      expect(() => requireSignalTimeseriesReadReceipt(value, 'signals:temperature', window, scope))
        .toThrow(expect.objectContaining({ code: 'SIGNAL_TIMESERIES_READ_RECEIPT_INVALID' }));
    });
  it('rejects wrong World, revision, resource, CAS, window, digest and immutable flags', () => {
    const mutations: Array<(r: TimeSeriesReadReceipt) => void> = [
      r => { r.binding.worldInstanceId = 'other'; }, r => { r.binding.worldRevision = '8'; },
      r => { r.binding.dataNamespace = 'data:other:world-a'; }, r => { r.binding.resourceId = 'signals:other'; },
      r => { r.binding.cas = 'series-generation:13'; }, r => { r.binding.window.end = 11; },
      r => { r.integrity.digest = 'sha256:not-a-digest'; }, r => { r.integrity.algorithm = 'unknown'; },
      r => { r.immutable = false; }, r => { r.snapshot.immutable = false; },
    ];
    for (const mutate of mutations) {
      const body = response(); mutate(body.read_receipt);
      expect(() => requireSignalTimeseriesReadReceipt(body, 'signals:temperature', window, scope)).toThrow();
    }
  });
  it('keeps partial reads diagnostic and enforces continuation/recovery correspondence', () => {
    const body = response();
    Object.assign(body.read_receipt.continuation, { complete: false, pageOrdinal: 1, nextCursor: 'cursor:2', truncationReason: 'limit' });
    body.read_receipt.recovery.status = 'continuation_required';
    expect(requireSignalTimeseriesReadReceipt(body, 'signals:temperature', window, scope)).toBe(body.read_receipt);
    expect(signalTimeseriesReadEvidence(body.read_receipt, scope).invalidEvidenceReasons).toContain('read_receipt.continuation.partial');
    body.read_receipt.recovery.status = 'not_required';
    expect(() => requireSignalTimeseriesReadReceipt(body, 'signals:temperature', window, scope)).toThrow();
    body.read_receipt.recovery.status = 'narrower_window_required';
    body.read_receipt.continuation.nextCursor = null;
    expect(requireSignalTimeseriesReadReceipt(body, 'signals:temperature', window, scope)).toBe(body.read_receipt);
    body.read_receipt.continuation.complete = true;
    expect(() => requireSignalTimeseriesReadReceipt(body, 'signals:temperature', window, scope)).toThrow();
  });
  it('preserves unknown retention as missing evidence rather than a successful retention claim', () => {
    const body = response();
    body.read_receipt.retention = { status: 'unknown', policyId: null, retainUntil: null };
    body.read_receipt.recovery.status = 'retention_evidence_required';
    body.read_receipt.freshness.state = 'unknown';
    requireSignalTimeseriesReadReceipt(body, 'signals:temperature', window, scope);
    const evidence = signalTimeseriesReadEvidence(body.read_receipt, scope);
    expect(evidence.missingEvidence).toContain('read_receipt.retention');
    expect(evidence.invalidEvidenceReasons).toContain('read_receipt.freshness.unknown');
    expect(evidence.warnings).toHaveLength(1);
    body.read_receipt.retention.policyId = 'invented';
    expect(() => requireSignalTimeseriesReadReceipt(body, 'signals:temperature', window, scope)).toThrow();
  });
  it('rejects invalid retained-policy dates and malformed warning/sample fields', () => {
    const body = response(); body.read_receipt.retention.retainUntil = 'not-a-date';
    expect(() => requireSignalTimeseriesReadReceipt(body, 'signals:temperature', window, scope)).toThrow();
    expect(() => decodeSignalTimeSeriesResponse({ ...response(), trust_evidence: { warnings: 'lost warning' } }, 'signals:temperature', window, scope)).toThrow();
    expect(() => decodeSignalTimeSeriesResponse({ ...response(), data: [{ timestamp: 1, value: NaN }] }, 'signals:temperature', window, scope)).toThrow();
  });
  it.each([undefined, { start: 0 }, { start: 1, end: 1 }, { start: 2, end: 1 },
    { start: 0.5, end: 1 }, { start: 0, end: Number.MAX_SAFE_INTEGER + 1 }])('requires bounded safe integer windows', query => {
      expect(() => requireSignalReadBoundedWindow(query)).toThrow(expect.objectContaining({ code: 'SIGNAL_TIMESERIES_BOUNDED_WINDOW_REQUIRED' }));
    });
});
