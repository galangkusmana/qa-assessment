# QA Engineer Assessment — Transcript & Workflow Quality Challenge

## Source Files Reviewed

- `fixtures/transcript_raw_corrupted.json`
- `fixtures/transcript_processed_ai_output_flawed.txt`
- `fixtures/metadata_corrupted.json`

## Executive Summary

The transcript package has high-risk quality issues across transcription accuracy, speaker attribution, timestamps, metadata consistency, and workflow readiness. The biggest risks are wrong speaker mapping, merged speaker turns, invalid metadata timestamps, inconsistent exhibit names, partial timestamping, and likely dropped audio at the end.

These are not cosmetic defects. For legal transcript workflows, wrong speaker attribution and corrupted legal terms can change the meaning of testimony. That is the kind of bug that does not just fail QA; it walks into review wearing a fake mustache.

---

## Task 1 — Identified Issues

| ID | Category | Problem | Why It Matters | Evidence |
|---|---|---|---|---|
| ISSUE-01 | Metadata | `created_at` is invalid: `2025-10-09T26:61:00Z`. | Invalid dates can break ingestion, sorting, filtering, audit logs, and API validation. | Hour `26` and minute `61` are impossible. |
| ISSUE-02 | Metadata | `error` is the string `"null"`, not a real `null`. | Clients may treat it as an actual error message or fail schema validation. | `"error": "null"` |
| ISSUE-03 | Timestamp | `audio_duration_ms` is 630000 but `transcript_duration_ms` is 605000. | A 25-second gap suggests the transcript may be incomplete or audio was dropped. | 630000 - 605000 = 25000 ms. |
| ISSUE-04 | Speaker Attribution | Metadata maps `Speaker A` as `WITNESS`, but its ASR label is `MS SELIGMAN`. | This can flip attorney and witness roles. Legal review depends on who said what. | `role: WITNESS`, `real_time_asr_label: MS SELIGMAN`. |
| ISSUE-05 | Speaker Attribution | Metadata maps `Speaker B` as `PLAINTIFF ATTORNEY`, but its ASR label is `THE WITNESS`. | Questions and answers may be inverted in downstream Q/A logic. | `role: PLAINTIFF ATTORNEY`, `real_time_asr_label: THE WITNESS`. |
| ISSUE-06 | Speaker Metadata | First/last name does not match full name for `Speaker A`. | Search, indexing, exports, and legal identity matching become unreliable. | `first_name: Terry`, `last_name: Sellingman`, `full_name: Jerry Sellingman`. |
| ISSUE-07 | Metadata/Transcript Consistency | Case/party names are inconsistent: `Cannon Farms`, `Cancun Farms`, and `Cancun Forms`. | Entity mismatch can break exhibit linking and case search. | Processed transcript uses multiple variants. |
| ISSUE-08 | Transcript Accuracy | Law firm name is inconsistent: `Richman & Lavine PC` vs metadata `Richmond & Lavine PC`. | Proper nouns are critical in legal records. Incorrect names reduce trust and searchability. | Processed transcript says `Richman & Lavine PC`. |
| ISSUE-09 | Transcript Accuracy | Phrase `We represent scientists, Moonlight Plaza Association` appears corrupted. | This changes the meaning of representation and likely introduces a hallucinated word. | `scientists` appears before client name. |
| ISSUE-10 | Formatting | Reporter introduction is duplicated near the top. | Duplicate content inflates transcript length and can confuse reviewers. | First timestamped reporter line is repeated as normal transcript text. |
| ISSUE-11 | Formatting/Timestamp | Only the first two lines have timestamps; the rest of the transcript has no timestamps. | Partial timestamping makes playback sync and review navigation inconsistent. | `[00:00:02]` and `[00:00:18]` only near the top. |
| ISSUE-12 | Raw Transcript Segmentation | Raw transcript has a giant utterance with more than 1,000 words. | Multiple speaker turns are merged, making speaker attribution and Q/A extraction unreliable. | `MS. SELIGMAN` utterance contains attorney questions, witness answers, reporter lines, and objections. |
| ISSUE-13 | Timestamp | A word timestamp starts before its parent utterance start time. | Non-monotonic timestamps break subtitle alignment and time-based playback. | Utterance starts at `17920`, but first word starts at `16000`. |
| ISSUE-14 | Speaker Attribution | `WITNESS: Objection. You may answer.` is incorrectly attributed. | Objections and answer instructions come from counsel, not the witness. | Processed transcript line after revise-documents question. |
| ISSUE-15 | Speaker Attribution | Witness answer is attributed to attorney: `MS SELIGMAN: I do not tell them how to prepare...`. | This reverses testimony attribution and changes the record. | Should be witness answer. |
| ISSUE-16 | Speaker Attribution | Attorney question is attributed to witness: `WITNESS: Do you tell them the exact scope...`. | Q/A role detection becomes invalid. | Question should belong to examining attorney. |
| ISSUE-17 | Transcript Accuracy | Objection phrase `Aston answered` is corrupted. | Legal objections need accurate wording. This likely should be `asked and answered`. | `MS. ATRIANO: Aston answered.` |
| ISSUE-18 | Transcript Accuracy | Environmental/legal phrase `No Further Action leather` is corrupted. | This changes legal/environmental meaning; likely should be `letter`. | `No Further Action leather`. |
| ISSUE-19 | Speaker Attribution | Exhibit marking request is attributed to witness: `WITNESS: This reporter. Could we have this marked...`. | Procedural exhibit requests should be attributed to counsel, not the witness. | Processed transcript around exhibit 2. |
| ISSUE-20 | Completeness | Processed transcript ends with `MS SELIGMAN: And going.` | Incomplete final phrase suggests truncation or failed processing. | Last line is incomplete. |

---

## Task 2 — Test Case Design

| Test Case ID | Description | Input | Expected Output | Failure Condition |
|---|---|---|---|---|
| TC-001 | Validate metadata timestamp format. | `metadata_corrupted.json.created_at` | API/validator rejects invalid ISO timestamp. | Timestamp with impossible hour/minute is accepted. |
| TC-002 | Validate nullable fields. | `error: "null"` | `error` must be `null` or a real error object/string, not string-null. | String `"null"` passes as clean metadata. |
| TC-003 | Compare audio and transcript duration. | `audio_duration_ms`, `transcript_duration_ms` | Difference must be within allowed tolerance, e.g. <= 10 seconds. | 25-second mismatch is not flagged. |
| TC-004 | Validate speaker metadata name consistency. | Speaker metadata records. | `full_name` must equal normalized `first_name + last_name`. | `Terry Sellingman` vs `Jerry Sellingman` is accepted. |
| TC-005 | Validate speaker role-to-label consistency. | `role` and `real_time_asr_label`. | Witness role should not map to attorney label and attorney role should not map to witness label. | `WITNESS -> MS SELIGMAN` or `ATTORNEY -> THE WITNESS` passes. |
| TC-006 | Detect long merged utterances. | Raw transcript utterances. | Any utterance above threshold, e.g. 250 words, is flagged for segmentation review. | 1,000+ word utterance is accepted. |
| TC-007 | Validate monotonic timestamps. | Utterance start and word-level starts. | Every word start must be >= parent utterance start and timestamps must not go backward. | Word starting at 16000 under utterance start 17920 passes. |
| TC-008 | Detect duplicate transcript blocks. | Processed transcript text. | Duplicate intro or repeated lines should be flagged. | Reporter introduction appears twice and is not flagged. |
| TC-009 | Validate timestamp coverage. | Processed transcript speaker lines. | Each speaker turn should include a timestamp or consistent timestamp policy. | Only first two lines have timestamps and output is accepted. |
| TC-010 | Detect known suspicious ASR substitutions. | Processed transcript text. | Terms like `Aston answered`, `No Further Action leather`, and entity variants are flagged. | Corrupted legal/environmental phrases pass. |
| TC-011 | Validate speaker-attribution heuristics. | Processed transcript lines. | Witness should not say objections/instructions; attorney should not give witness factual answers. | `WITNESS: Objection. You may answer.` passes. |
| TC-012 | Detect incomplete transcript ending. | Final transcript lines and duration. | Incomplete final phrase or duration gap should trigger completeness failure. | Transcript ends with `And going.` and still marks completed. |

---

## Task 3 — API Testing Plan

### `POST /transcripts/process`

#### Positive Tests

1. Submit a valid audio file ID with valid metadata.
   - Expected: `202 Accepted` with `processedTranscriptId` or `jobId`.
2. Submit valid metadata with known speakers and timestamps.
   - Expected: job is created and later reaches `TRANSCRIBED`.
3. Submit a duplicate request with the same idempotency key.
   - Expected: same job/result is returned, not a duplicate job.

#### Validation Tests

| Validation Area | Test |
|---|---|
| Required fields | Missing `audioFileId`, missing metadata, missing speaker list. |
| Invalid IDs | Nonexistent audio ID, malformed UUID, audio ID owned by another tenant. |
| Metadata schema | Invalid `created_at`, string `"null"`, missing `role`, invalid duration values. |
| File constraints | Unsupported audio format, zero-byte audio, audio duration too long, corrupted audio. |
| Speaker constraints | Duplicate speaker labels, role-label conflict, missing names when required. |
| Timestamp constraints | Word timestamp before utterance start, negative timestamp, timestamps beyond audio duration. |
| Idempotency | Same payload + same key should not create duplicate processing jobs. |
| Error handling | API should return structured errors with code, message, and field path. |

#### Expected Status Codes

| Scenario | Expected Status |
|---|---|
| Valid async request | `202 Accepted` |
| Missing required field | `400 Bad Request` |
| Invalid metadata schema | `422 Unprocessable Entity` |
| Audio file not found | `404 Not Found` |
| Unauthorized access | `401 Unauthorized` |
| Cross-tenant file access | `403 Forbidden` |
| Duplicate idempotent request | `200 OK` or `202 Accepted` with same job ID |
| Rate limit exceeded | `429 Too Many Requests` |
| Internal processing failure | `500` or controlled `PROCESSING_FAILED` state |

### `GET /transcripts/:id`

#### Positive Tests

1. Get existing transcript by valid ID.
   - Expected: `200 OK` with transcript, metadata, status, timestamps, and quality flags.
2. Get transcript while processing is still running.
   - Expected: `200 OK` with `status: PROCESSING` and no final transcript body yet.
3. Get transcript after failed processing.
   - Expected: `200 OK` with `status: FAILED` and error details.

#### Negative and Edge Tests

| Scenario | Expected Result |
|---|---|
| Invalid transcript ID format | `400 Bad Request` |
| Transcript ID not found | `404 Not Found` |
| Unauthorized user | `401 Unauthorized` |
| Cross-tenant access | `403 Forbidden` |
| Deleted transcript | `404` or `410 Gone`, depending on product decision |
| Transcript exists but metadata malformed | Response includes quality error or blocks completion |
| Transcript has incomplete audio coverage | Response includes quality warning/failure |

---

## Task 4 — Workflow Testing

Workflow:

```text
NEW → ASSIGNED → TRANSCRIBED → REVIEWED → COMPLETED
```

### Valid Transition Tests

| Test ID | From | To | Expected Result |
|---|---|---|---|
| WF-001 | NEW | ASSIGNED | Allowed |
| WF-002 | ASSIGNED | TRANSCRIBED | Allowed |
| WF-003 | TRANSCRIBED | REVIEWED | Allowed |
| WF-004 | REVIEWED | COMPLETED | Allowed |

### Invalid Transition Tests

| Test ID | From | To | Expected Result |
|---|---|---|---|
| WF-005 | NEW | TRANSCRIBED | Rejected because assignment is skipped. |
| WF-006 | NEW | COMPLETED | Rejected because all intermediate states are skipped. |
| WF-007 | ASSIGNED | REVIEWED | Rejected because transcription is skipped. |
| WF-008 | TRANSCRIBED | COMPLETED | Rejected because review is skipped. |
| WF-009 | COMPLETED | REVIEWED | Rejected because completed jobs should be immutable unless reopened by a controlled admin flow. |
| WF-010 | REVIEWED | ASSIGNED | Rejected because backward transition should not happen without explicit reopen logic. |

### Edge Cases

| Edge Case | Expected Behavior |
|---|---|
| Reassignment while `NEW` | Reject because no assignee exists yet. |
| Reassignment while `ASSIGNED` | Allow if user has permission and audit log is created. |
| Reassignment after `TRANSCRIBED` | Allow only if review ownership changes; transcript content should remain unchanged. |
| Reassignment after `COMPLETED` | Reject unless job is reopened by admin. |
| Duplicate transition request | Should be idempotent or return current state without corrupting audit history. |
| Concurrent transition requests | Only one transition should win; stale update should return conflict, e.g. `409`. |
| Processing failure during `ASSIGNED -> TRANSCRIBED` | Move to controlled failed state or keep `ASSIGNED` with processing error. Do not mark `TRANSCRIBED`. |
| Quality failure during review | Stay in `TRANSCRIBED` or `REVIEWED_WITH_ISSUES`, depending on product design. Do not allow `COMPLETED`. |

---

## Task 5 — Automation Approach

### Tools

- **TypeScript** for validation scripts and test utilities.
- **Vitest** for fast unit tests.
- **Node.js fs APIs** for fixture loading.
- **REST client layer** such as Playwright API testing, Supertest, or Axios for endpoint tests.
- **GitHub Actions** for CI.

### Test Layers

1. **Unit tests**
   - Metadata schema rules.
   - Timestamp validation.
   - Speaker role-label consistency.
   - Workflow transition rules.

2. **Integration/API tests**
   - `POST /transcripts/process` validation.
   - `GET /transcripts/:id` status and access control.
   - Async state polling.
   - Idempotency behavior.

3. **Fixture-based quality tests**
   - Run known corrupted transcript fixtures against quality rules.
   - Assert that expected issue IDs are detected.

4. **CI/CD checks**
   - `npm run check`
   - `npm test`
   - `npm run qa:scan`
   - Fail pipeline if critical quality rules regress.

### Example Structure

```text
moonlight-qa-assessment/
  docs/
    assessment.md
  fixtures/
    metadata_corrupted.json
    transcript_raw_corrupted.json
    transcript_processed_ai_output_flawed.txt
  src/
    index.ts
    qualityRules.ts
    types.ts
    workflow.ts
  test/
    qualityRules.test.ts
  package.json
  tsconfig.json
  README.md
```

### Example Pseudo-code

```ts
const issues = analyzeAll(rawTranscript, metadata, processedTranscript);

expect(issues).toContainIssue('META-001');
expect(issues).toContainIssue('SPK-002-Speaker-A');
expect(issues).toContainIssue('PROC-008');
expect(issues.some(issue => issue.severity === 'high')).toBe(true);
```

### CI/CD Example

```yaml
name: qa-assessment

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run check
      - run: npm test
      - run: npm run qa:scan
```

---

## Bonus — Transcript Quality Scoring System

Start from **100 points** and subtract based on issue severity.

| Category | Deduction |
|---|---:|
| Critical speaker attribution error | -15 each |
| Missing or invalid timestamp coverage | -10 each |
| Dropped/incomplete audio segment | -15 |
| Invalid metadata schema | -10 each |
| Legal/entity name corruption | -8 each |
| Duplicated transcript content | -5 each |
| Minor punctuation/formatting issue | -1 to -3 each |

### Suggested Rating

| Score | Rating |
|---:|---|
| 90–100 | Excellent |
| 75–89 | Good with minor review needed |
| 60–74 | Needs review |
| 40–59 | Poor quality |
| 0–39 | Not acceptable for production/legal use |

Given the uploaded files, the score would likely fall below **60** because there are multiple high-severity speaker attribution issues, metadata defects, and completeness/timestamp problems.

---

## Bonus — Programmatic Detection Rules / Heuristics

| Rule | Detection Logic |
|---|---|
| Invalid ISO timestamp | Parse date and compare normalized output. |
| Duration mismatch | `audio_duration_ms - transcript_duration_ms > threshold`. |
| Speaker role conflict | `role=WITNESS` should not map to attorney label; attorney should not map to `THE WITNESS`. |
| Merged utterance | Flag utterances above word threshold or containing many Q/A markers. |
| Word timestamp before utterance | Every word start must be >= utterance start. |
| Partial timestamp coverage | Compare timestamped speaker turns vs total speaker turns. |
| Duplicate content | Use normalized line or paragraph similarity. |
| Suspicious legal terms | Dictionary/allowlist for legal and environmental phrases. |
| Entity consistency | Compare case names, party names, exhibit names across metadata and transcript. |
| Incomplete ending | Last line ends with fragment or transcript duration is shorter than audio duration. |

