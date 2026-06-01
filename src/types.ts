export type Severity = 'low' | 'medium' | 'high';

export interface WordTimestamp {
  start: number;
  text: string;
}

export interface Utterance {
  isA: boolean;
  isQ: boolean;
  speaker: string;
  start: number;
  words: WordTimestamp[];
}

export interface RawTranscript {
  isOffline: boolean;
  hasUserRenamedSpeakers: boolean;
  hasSpeakerNames: boolean;
  utterances: Utterance[];
}

export interface SpeakerMetadata {
  post_asr_label: string;
  role: string;
  honorific_prefix: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  real_time_asr_label: string;
}

export interface TranscriptMetadata {
  speakers: SpeakerMetadata[];
  proceeding_type: string;
  summary: string;
  parties: string[];
  error: string | null;
  audio_duration_ms: number;
  transcript_duration_ms: number;
  created_at: string;
}

export interface QualityIssue {
  id: string;
  category: 'transcription' | 'formatting' | 'speaker' | 'timestamp' | 'metadata' | 'workflow';
  severity: Severity;
  problem: string;
  whyItMatters: string;
  evidence?: string;
}
