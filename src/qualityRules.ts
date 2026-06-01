import type { QualityIssue, RawTranscript, TranscriptMetadata, Utterance } from './types.js';

function utteranceText(utterance: Utterance): string {
  return utterance.words.map((word) => word.text).join(' ');
}

function hasInvalidIsoDate(value: string): boolean {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.toISOString() !== value;
}

function wordCount(utterance: Utterance): number {
  return utterance.words.length;
}

export function analyzeMetadata(metadata: TranscriptMetadata): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (hasInvalidIsoDate(metadata.created_at)) {
    issues.push({
      id: 'META-001',
      category: 'metadata',
      severity: 'high',
      problem: 'created_at is not a valid ISO timestamp.',
      whyItMatters: 'Invalid timestamps can break sorting, ingestion, audit logs, and API validation.',
      evidence: metadata.created_at,
    });
  }

  if (metadata.error === 'null') {
    issues.push({
      id: 'META-002',
      category: 'metadata',
      severity: 'medium',
      problem: 'error is stored as the string "null" instead of a real null value.',
      whyItMatters: 'String null can be treated as an actual error message by clients and reporting jobs.',
      evidence: String(metadata.error),
    });
  }

  const durationGap = metadata.audio_duration_ms - metadata.transcript_duration_ms;
  if (durationGap > 10_000) {
    issues.push({
      id: 'META-003',
      category: 'timestamp',
      severity: 'high',
      problem: 'Transcript duration is shorter than audio duration by more than 10 seconds.',
      whyItMatters: 'This suggests missing transcript content near the end of the audio.',
      evidence: `${durationGap} ms gap`,
    });
  }

  for (const speaker of metadata.speakers) {
    const composedName = `${speaker.first_name} ${speaker.last_name}`.trim();
    if (speaker.full_name !== composedName) {
      issues.push({
        id: `SPK-001-${speaker.post_asr_label.replace(/\s+/g, '-')}`,
        category: 'speaker',
        severity: 'high',
        problem: 'Speaker full_name does not match first_name + last_name.',
        whyItMatters: 'Name mismatch can cause wrong attribution in legal transcripts and search indexes.',
        evidence: `${speaker.full_name} !== ${composedName}`,
      });
    }

    if (speaker.role === 'WITNESS' && /SELIGMAN/i.test(speaker.real_time_asr_label)) {
      issues.push({
        id: `SPK-002-${speaker.post_asr_label.replace(/\s+/g, '-')}`,
        category: 'speaker',
        severity: 'high',
        problem: 'Witness role is mapped to an attorney-style real-time ASR label.',
        whyItMatters: 'Role-label conflicts can flip questions and answers between attorney and witness.',
        evidence: `${speaker.role} -> ${speaker.real_time_asr_label}`,
      });
    }

    if (speaker.role.includes('ATTORNEY') && /WITNESS/i.test(speaker.real_time_asr_label)) {
      issues.push({
        id: `SPK-003-${speaker.post_asr_label.replace(/\s+/g, '-')}`,
        category: 'speaker',
        severity: 'high',
        problem: 'Attorney role is mapped to THE WITNESS.',
        whyItMatters: 'This creates invalid speaker attribution and unreliable Q/A classification.',
        evidence: `${speaker.role} -> ${speaker.real_time_asr_label}`,
      });
    }
  }

  if (/Cancun Forms 3/i.test(metadata.summary)) {
    issues.push({
      id: 'META-004',
      category: 'metadata',
      severity: 'medium',
      problem: 'Summary references “Cancun Forms 3”, but the transcript evidence references Cannon Farms/Cancun Forms 2 inconsistently.',
      whyItMatters: 'Bad exhibit names make legal discovery review and exhibit lookup unreliable.',
      evidence: metadata.summary,
    });
  }

  return issues;
}

export function analyzeRawTranscript(raw: RawTranscript): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (!raw.hasSpeakerNames && raw.utterances.some((utterance) => /REPORTER|SELIGMAN|WITNESS/i.test(utterance.speaker))) {
    issues.push({
      id: 'RAW-001',
      category: 'metadata',
      severity: 'medium',
      problem: 'hasSpeakerNames is false, but utterances contain named speaker labels.',
      whyItMatters: 'Downstream systems may ignore usable labels because the metadata flag says labels are unavailable.',
      evidence: `hasSpeakerNames=${raw.hasSpeakerNames}`,
    });
  }

  raw.utterances.forEach((utterance, utteranceIndex) => {
    const firstBadWord = utterance.words.find((word) => word.start < utterance.start);
    if (firstBadWord) {
      issues.push({
        id: `RAW-002-${utteranceIndex}`,
        category: 'timestamp',
        severity: 'high',
        problem: 'A word timestamp starts before its parent utterance timestamp.',
        whyItMatters: 'Non-monotonic timestamps break transcript playback alignment and subtitle generation.',
        evidence: `${firstBadWord.text} starts ${firstBadWord.start} before utterance ${utterance.start}`,
      });
    }

    if (wordCount(utterance) > 250) {
      issues.push({
        id: `RAW-003-${utteranceIndex}`,
        category: 'formatting',
        severity: 'high',
        problem: 'One utterance contains hundreds of words and multiple speaker turns.',
        whyItMatters: 'The transcript cannot be reliably reviewed, searched by speaker, or converted into Q/A format.',
        evidence: `${wordCount(utterance)} words in utterance by ${utterance.speaker}`,
      });
    }

    const text = utteranceText(utterance);
    if (/\bYes\.\s+Okay|\bNo\.\s+Okay/i.test(text) && wordCount(utterance) > 80) {
      issues.push({
        id: `RAW-004-${utteranceIndex}`,
        category: 'speaker',
        severity: 'high',
        problem: 'Short witness answers are merged into attorney utterances.',
        whyItMatters: 'Merged turns change who said what and can alter legal meaning.',
        evidence: text.slice(0, 180),
      });
    }

    if (!utterance.isQ && /\?$/.test(text.trim())) {
      issues.push({
        id: `RAW-005-${utteranceIndex}`,
        category: 'formatting',
        severity: 'medium',
        problem: 'Utterance ends with a question mark but isQ is false.',
        whyItMatters: 'Question detection will miss valid attorney questions.',
        evidence: text.slice(-160),
      });
    }
  });

  return issues;
}

export function analyzeProcessedTranscript(processedText: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = processedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const timestampedLines = lines.filter((line) => /^\[\d{2}:\d{2}:\d{2}\]/.test(line));
  const speakerLines = lines.filter((line) => /^[A-Z .]+:\s+/.test(line));

  if (timestampedLines.length > 0 && speakerLines.length > timestampedLines.length * 3) {
    issues.push({
      id: 'PROC-001',
      category: 'formatting',
      severity: 'medium',
      problem: 'Only the first lines have timestamps; most speaker turns are untimestamped.',
      whyItMatters: 'Partial timestamps make playback sync and review navigation inconsistent.',
      evidence: `${timestampedLines.length} timestamped lines, ${speakerLines.length} speaker lines`,
    });
  }

  if (/THE REPORTER:.*Good morning[\s\S]*THE REPORTER:\s+Good morning/i.test(processedText)) {
    issues.push({
      id: 'PROC-002',
      category: 'formatting',
      severity: 'medium',
      problem: 'Reporter introduction appears duplicated.',
      whyItMatters: 'Duplicated content inflates transcript length and can confuse reviewers.',
      evidence: 'THE REPORTER introduction appears twice near the top.',
    });
  }

  const suspiciousTerms: Array<[RegExp, string, string]> = [
    [/Richman & Lavine PC/i, 'PROC-003', 'Law firm name is inconsistent with metadata party “Richmond & Lavine PC”.'],
    [/We represent scientists, Moonlight Plaza/i, 'PROC-004', 'Likely ASR hallucination or cleanup error: “scientists” inserted before the client name.'],
    [/Aston answered/i, 'PROC-005', 'Objection phrase appears corrupted; likely should be “asked and answered”.'],
    [/No Further Action leather/i, 'PROC-006', 'Legal/environmental term appears corrupted; likely “letter”, not “leather”.'],
    [/Cancun Forms 2/i, 'PROC-007', 'Exhibit/entity name is inconsistent with Cannon Farms references.'],
  ];

  for (const [pattern, id, problem] of suspiciousTerms) {
    const match = processedText.match(pattern);
    if (match) {
      issues.push({
        id,
        category: 'transcription',
        severity: 'high',
        problem,
        whyItMatters: 'Incorrect legal names, exhibit names, or terms can change the record and reduce trust in the transcript.',
        evidence: match[0],
      });
    }
  }

  if (/WITNESS:\s+Objection\. You may answer\./i.test(processedText)) {
    issues.push({
      id: 'PROC-008',
      category: 'speaker',
      severity: 'high',
      problem: 'Objection and instruction to answer are attributed to WITNESS instead of counsel.',
      whyItMatters: 'Speaker attribution is legally significant and affects review accuracy.',
      evidence: 'WITNESS: Objection. You may answer.',
    });
  }

  if (/MS SELIGMAN:\s+I do not tell them how to prepare/i.test(processedText)) {
    issues.push({
      id: 'PROC-009',
      category: 'speaker',
      severity: 'high',
      problem: 'Witness answer is attributed to MS SELIGMAN.',
      whyItMatters: 'This reverses testimony attribution between questioner and witness.',
      evidence: 'MS SELIGMAN: I do not tell them how to prepare...',
    });
  }

  if (/WITNESS:\s+Do you tell them the exact scope/i.test(processedText)) {
    issues.push({
      id: 'PROC-010',
      category: 'speaker',
      severity: 'high',
      problem: 'Attorney question is attributed to WITNESS.',
      whyItMatters: 'Question/answer role detection becomes unreliable.',
      evidence: 'WITNESS: Do you tell them the exact scope...',
    });
  }

  if (/WITNESS:\s+This reporter\.\s+Could we have this marked/i.test(processedText)) {
    issues.push({
      id: 'PROC-011',
      category: 'speaker',
      severity: 'high',
      problem: 'Exhibit marking request is attributed to WITNESS.',
      whyItMatters: 'Procedural requests should be attributed to counsel, not the witness.',
      evidence: 'WITNESS: This reporter. Could we have this marked...',
    });
  }

  if (/MS SELIGMAN:\s+And going\./i.test(processedText)) {
    issues.push({
      id: 'PROC-012',
      category: 'transcription',
      severity: 'medium',
      problem: 'Transcript appears truncated or ends with an incomplete phrase.',
      whyItMatters: 'Incomplete endings can indicate dropped audio or failed processing.',
      evidence: 'MS SELIGMAN: And going.',
    });
  }

  return issues;
}

export function analyzeAll(raw: RawTranscript, metadata: TranscriptMetadata, processedText: string): QualityIssue[] {
  return [...analyzeMetadata(metadata), ...analyzeRawTranscript(raw), ...analyzeProcessedTranscript(processedText)];
}
