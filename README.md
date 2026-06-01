# QA Assessment

TypeScript-based QA assessment for transcript quality, metadata consistency, API testing, workflow testing, and automation strategy.

## What is included

- TypeScript quality checker: `src/qualityRules.ts`
- Workflow transition helper: `src/workflow.ts`
- Unit tests: `test/qualityRules.test.ts`

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

## Notes

The implementation is intentionally simple. It does not try to be a full transcript engine. It demonstrates how a QA engineer can turn transcript defects into repeatable checks using TypeScript.
