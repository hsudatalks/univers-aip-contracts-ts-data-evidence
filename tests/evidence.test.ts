import { describe, expect, it } from 'vitest';

import {
  normalizeBoundedDataMaterializationReceipts,
  summarizeGeneratedSignalDeclaredFormat,
  summarizeGeneratedSignalStandardEvidence,
} from '../src/index.js';

function standardEvidence(provenance = 'forecast'): Record<string, unknown> {
  return {
    kind: 'other:generated_signal_execution_report',
    source_system: 'univers-forecast',
    content_type: 'generated_signal_execution_report',
    content: { run_id: 'run-1' },
    metadata: { provenance },
  };
}

describe('summarizeGeneratedSignalDeclaredFormat', () => {
  it('reports declared format match without granting provenance authority', () => {
    expect(
      summarizeGeneratedSignalDeclaredFormat(
        standardEvidence(),
        'univers-forecast',
        'forecast',
      ),
    ).toMatchObject({
      sourceSystem: 'univers-forecast',
      contentType: 'generated_signal_execution_report',
      provenance: 'forecast',
      status: 'declared_format_match',
    });
    expect(
      summarizeGeneratedSignalStandardEvidence(
        { ...standardEvidence(), content: { unsupportedClaim: true } },
        'univers-forecast',
        'forecast',
      ).status,
    ).toBe('declared_format_match');
    expect(
      summarizeGeneratedSignalStandardEvidence(standardEvidence(), 'univers-forecast', 'forecast').status,
    ).not.toBe('standard');

    expect(
      summarizeGeneratedSignalStandardEvidence(null, 'univers-forecast', 'forecast').status,
    ).toBe('missing');
    expect(
      summarizeGeneratedSignalStandardEvidence(
        { ...standardEvidence(), content: undefined },
        'univers-forecast',
        'forecast',
      ).status,
    ).toBe('incomplete');
    expect(
      summarizeGeneratedSignalStandardEvidence(
        standardEvidence('derived'),
        'univers-forecast',
        'forecast',
      ).status,
    ).toBe('mismatched');
  });
});

describe('normalizeBoundedDataMaterializationReceipts', () => {
  const receipt = {
    schema: 'bounded_data_materialization.v1',
    receiptId: 'receipt-1',
    status: 'comparison_only',
    seriesId: 'signals:chw.supply_temp_c',
    seriesKind: 'signal',
    requestedWindow: {
      start: '2026-07-01T00:00:00Z',
      end: '2026-07-01T01:00:00Z',
    },
    observedWindow: null,
    sampleCount: 2,
    numericSampleCount: 2,
    source: {
      provenance: 'measured',
      sourceType: 'enos',
      sourceId: 'source-1',
      provider: 'enos',
      subjectId: 'hvac_chillers:chiller-1',
      catalogMaterialized: true,
      catalogCoverageStart: '2026-07-01T00:00:00Z',
      catalogCoverageEnd: '2026-07-01T02:00:00Z',
      freshnessVerified: false,
      freshnessBasis: 'integration_catalog_coverage_does_not_contain_requested_window',
      verificationError: null,
    },
    scope: {
      entityId: 'hvac_chillers:chiller-1',
      orgId: 'organizations:org-1',
      buildingId: 'buildings:building-1',
      spaceId: 'spaces:space-1',
      verifiedSubjectIds: ['hvac_chillers:chiller-1'],
    },
    canUseForComparison: true,
    canUseForCalibration: false,
    missingEvidence: ['freshness_verification'],
    warnings: ['Measured history freshness is not verified.'],
    nextAction: 'Verify freshness before calibration.',
  };

  it('keeps valid receipts, combines sources, and deduplicates stable ids', () => {
    expect(normalizeBoundedDataMaterializationReceipts([receipt], receipt)).toEqual([receipt]);
  });

  it('drops malformed or unsupported evidence instead of fabricating fields', () => {
    expect(normalizeBoundedDataMaterializationReceipts(
      { ...receipt, sampleCount: -1 },
      { ...receipt, schema: 'unknown.v1' },
      null,
    )).toEqual([]);
  });
});
