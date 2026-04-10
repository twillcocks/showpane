# First Portal Strategy

Status: current-state strategy
Date: 2026-04-10
Scope: `showpane` + `showpane-cloud`
Owner: product / onboarding

## Purpose

This document is no longer a speculative proposal. It records:

- what the product has already decided
- what the codebase currently does
- what still needs work to make first-run onboarding feel clean

## Settled Product Decisions

These decisions are effectively made and should not be reopened casually:

- `npx showpane` is a zero-setup local path
- local default runtime is SQLite
- hosted Showpane Cloud is the normal publish/share/analytics path
- self-hosting is an advanced path, not an equal first-run branch
- `/portal onboard` is the intended guided first-run command
- `/portal create` remains the faster path for repeat users

## Current Product Reality

### Local

Today the local product mostly works like this:

1. run `npx showpane`
2. get a local SQLite-backed app running
3. open a new terminal
4. run `showpane claude`
5. either follow prompt examples or choose a slash-command path

This is much better than the older infra-heavy setup, but it is still too prompt-first for true first-run simplicity.

### Hosted

Hosted onboarding is intended to be Stripe-first:

1. sign in
2. if no org exists, go through `/checkout`
3. checkout creates the subscription/trial
4. webhook provisioning creates the workspace
5. then the user deploys and uses hosted Showpane

Important caveat: once an org already exists, deploy/use is not tightly re-gated by billing state. That means old test accounts can get into inconsistent states where deploy works but billing/account state looks odd.

## What Is Already Working Well

- SQLite-first local authoring is real and is the default path
- hosted cloud publish is real and is the default publish path
- the local welcome page already teaches “open a new terminal” explicitly
- `/portal onboard` exists and does function as a guided path
- `/portal deploy` is already cloud-first rather than provider-choice-first

## What Still Feels Wrong

### 1. First run is still too prompt-first

The welcome page and public first-portal docs still lead with prompt examples rather than strongly saying:

`If this is your first portal, run /portal onboard.`

That keeps first-time users in blank-canvas mode longer than necessary.

### 2. `/portal onboard` is not yet a true wizard

It is guided, but it still mostly feels like an orchestrator over:

- setup
- create
- credentials
- preview

That is directionally correct, but not yet a product-shaped first-portal wizard.

### 3. `/portal create` still carries onboarding weight

`/portal create` still includes too much first-run guidance and handholding. It is useful, but it does not yet feel like the calm repeat-user path.

### 4. Non-deploy skills still inherit too much infra framing

The shared skill worldview still foregrounds config, deploy mode, org slug, and env loading more than ideal for ordinary local content work.

### 5. Hosted account state is too easy to pollute

Legacy/test accounts can end up with:

- existing org membership
- partial Stripe state
- confusing dashboard billing state
- deploy paths that still work despite incomplete account state

That makes real onboarding harder to reason about during testing.

## Immediate Correctness Work

Recent testing surfaced a few first-run correctness issues that are not strategic debates, just product bugs:

1. scaffold/test typing must not block first deploy on a fresh workspace
2. toolchain scripts must not depend on hidden local path projections or accidental symlink state
3. local runtime/file exports must use the local SQLite org, not the hosted org slug from config
4. deploy scripts must fail clearly on real export/upload errors

These are high-priority because they damage trust in the first-run flow.

## Recommended Product Direction

### 1. Make `/portal onboard` the canonical first step

The product should consistently tell first-time users:

1. run `showpane claude`
2. run `/portal onboard`

That should be true in:

- local welcome page
- first-portal docs
- skill guidance

### 2. Turn `/portal onboard` into a real first-portal wizard

The desired flow is:

1. orient the user
2. collect only the minimum local/company context
3. choose the first portal source
4. generate a useful first draft
5. ask for one or two practical refinements
6. preview locally
7. only then introduce publish/share

The user should feel like they are succeeding at one coherent workflow, not manually stepping through a skill stack.

### 3. Narrow `/portal create`

`/portal create` should be optimized for:

- returning users
- transcript-driven creation
- quick repeated use

It should not carry the emotional burden of first-run success.

### 4. Align the docs and product story

The local app, docs, and skills should all tell the same story:

- local first
- value before infrastructure
- hosted when ready to share

Right now the user can still see a mixture of:

- wizard-first ideas
- prompt-first docs
- hosted-first account logic

That inconsistency is the remaining product problem.

### 5. Treat hosted billing as a clean onboarding prerequisite

The intended hosted story should remain:

- no org -> checkout
- checkout -> provisioning
- then hosted use

The product should not imply “deploy first, billing later,” even if legacy accounts can currently drift into that state.

## Priorities

### Priority 1: correctness

- fix first-run deploy blockers
- make toolchain assumptions robust
- make deploy failures explicit and trustworthy

### Priority 2: narrative clarity

- update local welcome page to point to `/portal onboard`
- update first-portal docs to make the wizard the default story

### Priority 3: skill role clarity

- strengthen `/portal onboard`
- narrow `/portal create`
- reduce infra-first framing in shared preambles for non-deploy work

### Priority 4: hosted account hygiene

- make billing/account state clearer in dashboard settings
- make it easier to reset or isolate internal test accounts
- decide whether hosted deploy should become more tightly billing-aware for existing-org edge cases

## Non-Goals

- do not add a new top-level onboarding command
- do not make Postgres the default local path
- do not put self-hosting back into the main first-run story
- do not turn `/portal deploy` into a hosted-vs-self-hosted chooser

## Bottom Line

The big strategic question is already answered:

- SQLite first
- hosted default
- self-hosted advanced

The remaining work is mostly onboarding quality and correctness:

- make the first-run path wizard-first
- make the docs and app tell the same story
- remove the bugs that make first deploy feel fragile
- reduce confusion from polluted hosted test accounts
