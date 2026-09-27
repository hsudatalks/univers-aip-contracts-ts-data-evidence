export type GeneratedSignalStandardEvidenceStatus =
  | 'standard'
  | 'missing'
  | 'incomplete'
  | 'mismatched';

export interface GeneratedSignalStandardEvidenceSummary {
  sourceSystem: string;
  contentType: string;
  provenance: string;
  status: GeneratedSignalStandardEvidenceStatus;
}

export interface BoundedDataMaterializationReceipt {
  schema: string;
  receiptId: string;
  status: 'calibration_candidate' | 'comparison_only' | 'empty' | 'unverified';
  seriesId: string;
  seriesKind: 'signal' | 'state';
  requestedWindow: { start: string; end: string };
  observedWindow: { start: string; end: string } | null;
  sampleCount: number;
  numericSampleCount: number;
  source: {
    provenance: string;
    sourceType: string | null;
    sourceId: string | null;
    provider: string | null;
    subjectId: string | null;
    catalogMaterialized: boolean;
    catalogCoverageStart?: string | null;
    catalogCoverageEnd?: string | null;
    freshnessVerified: boolean;
    freshnessBasis?: string | null;
    verificationError: string | null;
  };
  scope: {
    entityId: string | null;
    orgId: string | null;
    buildingId: string | null;
    spaceId: string | null;
    verifiedSubjectIds: string[];
  };
  canUseForComparison: boolean;
  canUseForCalibration: boolean;
  missingEvidence: string[];
  warnings: string[];
  nextAction: string;
}

export function normalizeBoundedDataMaterializationReceipts(
  ...values: unknown[]
): BoundedDataMaterializationReceipt[] {
  const receipts = new Map<string, BoundedDataMaterializationReceipt>();
  for (const value of values) {
    const candidates = Array.isArray(value) ? value : value == null ? [] : [value];
    for (const candidate of candidates) {
      if (isBoundedDataMaterializationReceipt(candidate)) {
        receipts.set(candidate.receiptId, candidate);
      }
    }
  }
  return Array.from(receipts.values());
}

export function summarizeGeneratedSignalStandardEvidence(
  standardEvidence: unknown,
  expectedSourceSystem: string,
  expectedProvenance: string,
): GeneratedSignalStandardEvidenceSummary {
  if (standardEvidence == null) {
    return missingSummary();
  }
  if (!isRecord(standardEvidence)) {
    return {
      ...missingSummary(),
      status: 'incomplete',
    };
  }

  const metadata = isRecord(standardEvidence.metadata) ? standardEvidence.metadata : null;
  const sourceSystem = text(standardEvidence.source_system) || 'missing';
  const contentType = text(standardEvidence.content_type) || 'missing';
  const provenance = text(metadata?.provenance).toLowerCase() || 'missing';
  const kind = text(standardEvidence.kind);
  const hasContent = isRecord(standardEvidence.content);
  const complete =
    Boolean(kind) &&
    sourceSystem !== 'missing' &&
    contentType !== 'missing' &&
    provenance !== 'missing' &&
    hasContent;

  if (!complete) {
    return {
      sourceSystem,
      contentType,
      provenance,
      status: 'incomplete',
    };
  }

  const standard =
    kind === 'other:generated_signal_execution_report' &&
    sourceSystem === expectedSourceSystem.trim() &&
    contentType === 'generated_signal_execution_report' &&
    provenance === expectedProvenance.trim().toLowerCase();

  return {
    sourceSystem,
    contentType,
    provenance,
    status: standard ? 'standard' : 'mismatched',
  };
}

function missingSummary(): GeneratedSignalStandardEvidenceSummary {
  return {
    sourceSystem: 'missing',
    contentType: 'missing',
    provenance: 'missing',
    status: 'missing',
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isBoundedDataMaterializationReceipt(
  value: unknown,
): value is BoundedDataMaterializationReceipt {
  if (!isRecord(value)) {
    return false;
  }
  const requestedWindow = isRecord(value.requestedWindow) ? value.requestedWindow : null;
  const observedWindow = isRecord(value.observedWindow) ? value.observedWindow : null;
  const source = isRecord(value.source) ? value.source : null;
  const scope = isRecord(value.scope) ? value.scope : null;
  return (
    value.schema === 'bounded_data_materialization.v1' &&
    typeof value.receiptId === 'string' &&
    ['calibration_candidate', 'comparison_only', 'empty', 'unverified'].includes(String(value.status)) &&
    typeof value.seriesId === 'string' &&
    (value.seriesKind === 'signal' || value.seriesKind === 'state') &&
    requestedWindow !== null &&
    typeof requestedWindow.start === 'string' &&
    typeof requestedWindow.end === 'string' &&
    (value.observedWindow == null || (
      observedWindow !== null &&
      typeof observedWindow.start === 'string' &&
      typeof observedWindow.end === 'string'
    )) &&
    isNonNegativeInteger(value.sampleCount) &&
    isNonNegativeInteger(value.numericSampleCount) &&
    source !== null &&
    typeof source.provenance === 'string' &&
    isNullableString(source.sourceType) &&
    isNullableString(source.sourceId) &&
    isNullableString(source.provider) &&
    isNullableString(source.subjectId) &&
    typeof source.catalogMaterialized === 'boolean' &&
    isNullableString(source.catalogCoverageStart) &&
    isNullableString(source.catalogCoverageEnd) &&
    typeof source.freshnessVerified === 'boolean' &&
    isNullableString(source.freshnessBasis) &&
    isNullableString(source.verificationError) &&
    scope !== null &&
    isNullableString(scope.entityId) &&
    isNullableString(scope.orgId) &&
    isNullableString(scope.buildingId) &&
    isNullableString(scope.spaceId) &&
    isStringArray(scope.verifiedSubjectIds) &&
    typeof value.canUseForComparison === 'boolean' &&
    typeof value.canUseForCalibration === 'boolean' &&
    isStringArray(value.missingEvidence) &&
    isStringArray(value.warnings) &&
    typeof value.nextAction === 'string'
  );
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value == null || typeof value === 'string';
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
