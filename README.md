# QA Assessment

TypeScript-based QA assessment for transcript quality, metadata consistency, API testing, workflow testing, and automation strategy.

## What is included

- Full written assessment: `docs/assessment.md`
- TypeScript quality checker: `src/qualityRules.ts`
- Workflow transition helper: `src/workflow.ts`
- Unit tests: `test/qualityRules.test.ts`
- Uploaded assessment fixtures: `fixtures/`

## Requirements

- Node.js 20 or newer
- npm

## How to run

```bash
npm install
npm run check
npm test
npm run qa:scan
```

## Useful commands

```bash
# TypeScript type check
npm run check

# Run tests
npm test

# Scan the provided corrupted fixtures and print detected issues
npm run qa:scan
```

## Suggested GitHub upload flow

```bash
git init
git add .
git commit -m "Add transcript QA assessment"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```


## Data usage / copyright note

The `fixtures/` files are assessment-provided materials. If this repo will be public and the assessment provider did not explicitly allow redistribution, make the repo private or remove `fixtures/` before publishing. See `DATA_USAGE.md`.

## Notes

The implementation is intentionally simple. It does not try to be a full transcript engine. It demonstrates how a QA engineer can turn transcript defects into repeatable checks using TypeScript.

The TypeScript files are supporting examples for automated quality checks and workflow validation.
