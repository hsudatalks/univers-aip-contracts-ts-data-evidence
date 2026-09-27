// Public Signal read receipt wire values; no Data SDK or transport dependency.

export type TimeSeriesDataPoint = {
    /**
     * Data quality score (0-100), or unknown when the source did not report it.
     */
    quality?: number | null;
    /**
     * Timestamp (Unix milliseconds)
     */
    timestamp: number;
    /**
     * Calculated value
     */
    value: number;
};

export type TimeSeriesReadBinding = {
    cas?: string | null;
    dataNamespace: string;
    resourceId: string;
    resourceRevision?: string | null;
    window: TimeSeriesReadWindow;
    worldInstanceId: string;
    worldRevision: string;
};

export type TimeSeriesReadContinuation = {
    complete: boolean;
    nextCursor?: string | null;
    /**
     * Zero-based page position in the server-issued cursor chain.
     */
    pageOrdinal: number;
    /**
     * Immutable receipt for the immediately preceding page.
     */
    previousReceiptId?: string | null;
    /**
     * Stable identity of the exact World/resource/window/generation query.
     */
    queryFingerprint: string;
    truncationReason?: string | null;
};

export type TimeSeriesReadFreshness = {
    asOf: string;
    state: string;
};

export type TimeSeriesReadIntegrity = {
    algorithm: string;
    digest: string;
    status: string;
};

export type TimeSeriesReadReceipt = {
    binding: TimeSeriesReadBinding;
    continuation: TimeSeriesReadContinuation;
    freshness: TimeSeriesReadFreshness;
    immutable: boolean;
    integrity: TimeSeriesReadIntegrity;
    receiptId: string;
    recovery: TimeSeriesReadRecovery;
    retention: TimeSeriesReadRetention;
    snapshot: TimeSeriesReadSnapshot;
    unit: TimeSeriesReadUnit;
};

export type TimeSeriesReadRecovery = {
    retrySafe: boolean;
    status: string;
};

export type TimeSeriesReadRetention = {
    policyId?: string | null;
    retainUntil?: string | null;
    status: string;
};

export type TimeSeriesReadSnapshot = {
    capturedAt: string;
    id: string;
    immutable: boolean;
};

export type TimeSeriesReadUnit = {
    /**
     * Stable normalized unit identity used to reject mixed-unit page chains.
     */
    fingerprint?: string | null;
    /**
     * `reported` only when the owning Signal/State definition supplies a unit.
     */
    status: string;
    unit?: string | null;
};

export type TimeSeriesReadWindow = {
    end: number;
    start: number;
};
