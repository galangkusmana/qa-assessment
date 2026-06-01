import { describe, expect, it } from 'vitest';
import { analyzeMetadata, analyzeProcessedTranscript, analyzeRawTranscript } from '../src/qualityRules.js';
import { assertTransition, canTransition } from '../src/workflow.js';
import type { RawTranscript, TranscriptMetadata } from '../src/types.js';

describe('metadata quality rules', () => {
  it('detects invalid ISO timestamp and string null error', () => {
    const metadata = {
      speakers: [],
      proceeding_type: 'Court Hearing',
      summary: '',
      parties: [],
      error: 'null',
      audio_duration_ms: 630000,
      transcript_duration_ms: 605000,
      created_at: '2025-10-09T26:61:00Z',
    } satisfies TranscriptMetadata;

    const issueIds = analyzeMetadata(metadata).map((issue) => issue.id);

    expect(issueIds).toContain('META-001');
    expect(issueIds).toContain('META-002');
    expect(issueIds).toContain('META-003');
  });
});

describe('raw transcript quality rules', () => {
  it('detects word timestamp before utterance start', () => {
    const raw = {
      isOffline: false,
      hasUserRenamedSpeakers: false,
      hasSpeakerNames: false,
      utterances: [
        {
          isA: false,
          isQ: false,
          speaker: 'MS. SELIGMAN',
          start: 17920,
          words: [
            { start: 16000, text: 'Good' },
            { start: 18000, text: 'morning' },
          ],
        },
      ],
    } satisfies RawTranscript;

    const issueIds = analyzeRawTranscript(raw).map((issue) => issue.id);

    expect(issueIds).toContain('RAW-001');
    expect(issueIds).toContain('RAW-002-0');
  });
});

describe('processed transcript quality rules', () => {
  it('detects suspicious transcription and speaker-attribution issues', () => {
    const processed = `
      THE REPORTER: Good morning.
      THE REPORTER: Good morning.
      MS SELIGMAN: We represent scientists, Moonlight Plaza Association.
      WITNESS: Objection. You may answer.
      MS SELIGMAN: I do not tell them how to prepare the reports.
      WITNESS: Do you tell them the exact scope of their work?
      MS. ATRIANO: Aston answered.
      MS SELIGMAN: No Further Action leather.
    `;

    const issueIds = analyzeProcessedTranscript(processed).map((issue) => issue.id);

    expect(issueIds).toEqual(expect.arrayContaining(['PROC-004', 'PROC-005', 'PROC-006', 'PROC-008', 'PROC-009', 'PROC-010']));
  });
});

describe('workflow transitions', () => {
  it('allows valid sequential transitions', () => {
    expect(canTransition('NEW', 'ASSIGNED')).toBe(true);
    expect(canTransition('ASSIGNED', 'TRANSCRIBED')).toBe(true);
    expect(canTransition('TRANSCRIBED', 'REVIEWED')).toBe(true);
    expect(canTransition('REVIEWED', 'COMPLETED')).toBe(true);
  });

  it('rejects skipped or backward transitions', () => {
    expect(canTransition('NEW', 'TRANSCRIBED')).toBe(false);
    expect(canTransition('COMPLETED', 'REVIEWED')).toBe(false);
    expect(() => assertTransition('NEW', 'COMPLETED')).toThrow('Invalid workflow transition');
  });
});
