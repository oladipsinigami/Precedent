# User-test protocol

Five 15-minute sessions with self-directed retail traders. No results are
recorded here because none have been run. This file is the script for whoever
runs them.

## Why this exists

The product's claims are about evidence quality, not interface quality. A trader
who cannot tell a measured figure from an estimate will misread the whole memo,
and no amount of correctness in the code fixes that. These sessions test whether
the interface keeps that line visible.

## Who to recruit

Five traders who hold or have held a tokenized US equity (rToken) on a crypto
exchange. Mix of experience:

- Two who trade weekly or more and already track their positions
- Two who hold and check occasionally
- One who has never traded a tokenized equity

Screen out anyone who works in finance, or who has built a trading product.
They read the interface differently from the target user.

## Setup

- Shared screen and audio recording, with written consent
- The deployed app on the participant's own machine, at whatever size they
  normally use. Do not resize for them.
- Start from the landing page. Do not pre-load a trade.
- Fifteen minutes, timed from "you can look around for a moment" to "that's the
  end". Let it run over; note when it did.

## What to show

Nothing beyond the landing page. If a participant asks what to do, say:

> Type a trade you are actually thinking about: how much, how long you would
> hold it, and the most you could afford to lose.

## Three tasks

Give each in this order. Do not help. If they are stuck after ninety seconds,
say "what would you try next?" and keep quiet. If they are still stuck at two
minutes, move to the next task and record where they stopped.

**Task 1 — Set up a trade.** Type a real or realistic trade into the single
input. Confirm the chips under the box show what you expect.

**Task 2 — Read the verdict.** Press the primary button. Before saying anything,
ask them to say out loud what the tool told them and how confident they are it is
based on live data. Then ask them to point at the thing on screen that told them
that.

**Task 3 — Change one number and re-check.** Halve the size, or shorten the hold.
Ask them to predict the verdict before they press. Record the prediction, the
actual verdict, and whether they were right.

## What to record

For each session:

- Task completion and time to first action per task
- Whether they predicted correctly in task 3
- Whether they ever confused a measured figure with an estimate, and where
- Whether they noticed the data-health banner when a stream degraded
- Whether they looked for a number to act on, and what they expected to happen
- Any point where they stopped, went back, or asked what something meant

## Quotes

Ask at the end: is there anything on this screen you would want to remember
later? Record verbatim.

**Quotes are used only with explicit permission.** Ask separately: may I use
this quote, unattributed, in a product review? A yes to "may I record this" is
not a yes to using it. Store the written permission with the quote. Decline to
use any quote without it.

## Analysis

Report what happened, not what it suggests. For each of the three tasks, give
the completion count out of five and the observed times. Name the specific
screens where a participant confused the two kinds of figure rather than
generalising from one. If a task failed five times out of five, that is the
finding to report, not a rounding error to note.

Do not compute an overall satisfaction score. Five sessions is too small a
sample to average, and averaging hides the failures that matter.

## What not to do

- Do not demonstrate the features. The point is whether the interface explains
  itself.
- Do not tell them what the product is for beyond the one-line task framing.
- Do not rescue a stuck participant before two minutes.
- Do not report a success rate that includes a rescued session.