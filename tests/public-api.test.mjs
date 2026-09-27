import test from 'node:test';
import assert from 'node:assert/strict';
import * as contract from '../dist/index.js';
test('published evidence functions preserve absent and mismatched data', () => {
  assert.deepEqual(contract.normalizeBoundedDataMaterializationReceipts(undefined, null, {}), []);
  assert.equal(contract.summarizeGeneratedSignalStandardEvidence(undefined, 'expected', 'derived').status, 'missing');
  assert.equal(contract.summarizeGeneratedSignalStandardEvidence({kind:'other:generated_signal_execution_report',source_system:'different',content_type:'generated_signal_execution_report',metadata:{provenance:'derived'},content:{}}, 'expected', 'derived').status, 'mismatched');
  assert.deepEqual(Object.keys(contract).sort(), ['normalizeBoundedDataMaterializationReceipts', 'summarizeGeneratedSignalStandardEvidence']);
});
