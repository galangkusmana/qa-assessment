import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeAll } from './qualityRules.js';
import type { RawTranscript, TranscriptMetadata } from './types.js';

const fixtureDir = join(process.cwd(), 'fixtures');
const raw = JSON.parse(readFileSync(join(fixtureDir, 'transcript_raw_corrupted.json'), 'utf8')) as RawTranscript;
const metadata = JSON.parse(readFileSync(join(fixtureDir, 'metadata_corrupted.json'), 'utf8')) as TranscriptMetadata;
const processed = readFileSync(join(fixtureDir, 'transcript_processed_ai_output_flawed.txt'), 'utf8');

const issues = analyzeAll(raw, metadata, processed);

console.log(JSON.stringify({
  totalIssues: issues.length,
  byCategory: issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.category] = (acc[issue.category] ?? 0) + 1;
    return acc;
  }, {}),
  issues,
}, null, 2));
