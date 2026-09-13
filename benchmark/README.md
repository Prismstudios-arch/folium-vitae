# Provider benchmark

Phase 0 of SPEC.md: evaluate identification providers on **your** photos before
committing to one.

> "If the provider accuracy on grasses and seedlings is no better than
> PictureThis, the whole positioning changes and I need to know in week one,
> not month three." — SPEC §11

## Why this exists

Sorrel's entire pitch is being better than PictureThis at the categories it
fails: grasses, seedlings, weeds and lookalikes. If the provider you pay per
call for is no better at those, you are paying to be equally wrong.

Vendor accuracy claims are measured on their own benchmark sets. This measures
on yours.

## 1. Add photos

Drop labelled photos into folders by category. **The folder name is the
category; the filename is the correct answer.**

```
benchmark/photos/
  houseplant/
    monstera-deliciosa__1.jpg
    ficus-lyrata__1.jpg
  grass/
    poa-annua__1.jpg
    digitaria-sanguinalis__1.jpg
  seedling/
    helianthus-annuus__1.jpg
  weed/
    taraxacum-officinale__1.jpg
  lookalike/
    epipremnum-aureum__1.jpg
```

Rules:

- Filename before `__` is the expected **scientific name**, hyphen-separated.
  `monstera-deliciosa__1.jpg` means the right answer is *Monstera deliciosa*.
- Anything after `__` is ignored, so you can have several photos per species.
- Weight the hard categories. The spec says to: grasses, seedlings and
  lookalikes are where the product has to win, so ~60% of the set should be
  those, not easy houseplants.
- 100 photos is the target. Fewer still tells you something; under ~30 the
  per-category numbers are too noisy to act on.

## 2. Add keys

In `backend/.env` (already gitignored):

```
KINDWISE_API_KEY=...
PLANTNET_API_KEY=...
```

Only the providers with a key present are run, so you can start with one.

Optional, for cost projection — set these to whatever the provider actually
quotes you, since published pricing changes:

```
KINDWISE_COST_PER_CALL=0.00
PLANTNET_COST_PER_CALL=0.00
```

## 3. Run

```bash
node benchmark/run.js
```

Writes `benchmark/results/<timestamp>.csv` and prints a summary.

## Reading the result

- **Top-1** — the right answer was the headline answer. This is the number
  users experience as "it got it right".
- **Top-3** — the right answer was somewhere in the candidates. Matters
  because the Not-sure screen shows three.
- **Genus-only** — right genus, wrong species. Not a failure: the care
  database falls back to genus level (§4), so these are still useful answers.
- **Mean top-1 score** — feed this into the confidence thresholds in
  `src/services/identification.ts`, which are currently guesses.

The decision you are making: is the top-1 rate on **grass and seedling** high
enough to claim you are better than PictureThis? If not, the positioning has
to change before any more is built on it.
