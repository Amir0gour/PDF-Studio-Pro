import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePageRangeString,
  formatBytes,
  calculateCompressionMetrics,
  normalizeRotation,
  analyzeTextContent,
  isPointInAnnotation,
  calculateNormalizedBounds,
  createReplacementTextParams,
} from './pdfLogic.ts';

test('parsePageRangeString correctly parses ranges and individual pages', () => {
  const totalPages = 10;
  const parsed = parsePageRangeString('1, 3-5, 8, 12', totalPages);
  // 1 => 0, 3-5 => 2, 3, 4, 8 => 7, 12 is out of range
  assert.deepEqual(parsed, [0, 2, 3, 4, 7]);
});

test('parsePageRangeString handles reverse ranges and whitespace', () => {
  const parsed = parsePageRangeString(' 6 - 4 ,  2 ', 8);
  // 6-4 should normalize from 4 to 6: pages 4,5,6 => 3,4,5. 2 => 1
  assert.deepEqual(parsed, [1, 3, 4, 5]);
});

test('formatBytes handles zero, bytes, KB, and MB', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1048576), '1 MB');
  assert.equal(formatBytes(5242880), '5 MB');
});

test('calculateCompressionMetrics calculates accurate savings and percentage', () => {
  const metric = calculateCompressionMetrics(1000, 700);
  assert.equal(metric.savingsBytes, 300);
  assert.equal(metric.percentageSaved, 30);
  assert.equal(metric.isSmaller, true);

  const largerMetric = calculateCompressionMetrics(1000, 1200);
  assert.equal(largerMetric.isSmaller, false);
});

test('normalizeRotation snaps angles to 0, 90, 180, 270', () => {
  assert.equal(normalizeRotation(0), 0);
  assert.equal(normalizeRotation(90), 90);
  assert.equal(normalizeRotation(89), 90);
  assert.equal(normalizeRotation(180), 180);
  assert.equal(normalizeRotation(270), 270);
  assert.equal(normalizeRotation(360), 0);
  assert.equal(normalizeRotation(-90), 270);
});

test('analyzeTextContent computes word count and stats accurately', () => {
  const sample = "PDF Studio Pro is a comprehensive document editor.\nIt supports real processing.";
  const stats = analyzeTextContent(sample);
  assert.equal(stats.wordCount, 12);
  assert.equal(stats.lineCount, 2);
  assert.equal(stats.readingTimeMinutes, 1);
});

test('isPointInAnnotation tests bounding box hits', () => {
  const box = { x: 50, y: 100, width: 200, height: 80 };
  assert.equal(isPointInAnnotation(100, 120, box), true);
  assert.equal(isPointInAnnotation(40, 120, box), false);
  assert.equal(isPointInAnnotation(300, 120, box), false);
  assert.equal(isPointInAnnotation(100, 200, box), false);
});

test('calculateNormalizedBounds computes percentage coordinates accurately', () => {
  const parent = { left: 100, top: 100, width: 500, height: 1000 };
  const child = { left: 200, top: 250, width: 100, height: 50 };

  const bounds = calculateNormalizedBounds(child, parent);
  // pctX = (200 - 100) / 500 * 100 = 20%
  assert.equal(bounds.pctX, 20);
  // pctY = (250 - 100) / 1000 * 100 = 15%
  assert.equal(bounds.pctY, 15);
  // pctW = 100 / 500 * 100 = 20%
  assert.equal(bounds.pctW, 20);
  // pctH = 50 / 1000 * 100 = 5%
  assert.equal(bounds.pctH, 5);
});

test('createReplacementTextParams builds whiteout-backed editable text annotation', () => {
  const bounds = { pctX: 10, pctY: 20, pctW: 15, pctH: 3 };
  const params = createReplacementTextParams('Total Due: $500', bounds, 16);

  assert.equal(params.type, 'text');
  assert.equal(params.text, 'Total Due: $500');
  assert.equal(params.backgroundColor, '#ffffff');
  assert.equal(params.borderStyle, 'dashed');
  assert.equal(params.fontSize, 16);
  assert.equal(params.x, 10);
  assert.equal(params.y, 20);
});
