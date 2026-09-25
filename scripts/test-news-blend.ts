import assert from "node:assert/strict";
import { blendHeadlines, titleFingerprint, urlFingerprint } from "../lib/providers/news";

type Sample = { title: string; publisher: string; url: string };

// Fixture note: the fingerprint keys on the first six content words, so each
// sample needs a distinguishing multi-character token in that window.
const batch = (tag: string, count: number, publisher: string): Sample[] =>
  Array.from({ length: count }, (_, i) => ({
    title: `${tag} coverage headline t${String(i).padStart(3, "0")}`,
    publisher,
    url: `https://example.com/${tag}/${i}`,
  }));

// A 50-item vendor batch must not monopolise the visible headline set.
const blended = blendHeadlines(
  [batch("alpha", 50, "Benzinga"), batch("bravo", 8, "fool.com"), batch("charlie", 8, "Google News")],
  10,
);
assert.equal(blended.length, 10);
assert.ok(blended.some((h) => h.publisher === "fool.com"), "second provider must appear");
assert.ok(blended.some((h) => h.publisher === "Google News"), "third provider must appear");
assert.ok(
  blended.filter((h) => h.publisher === "Benzinga").length < 10,
  "first provider must not fill every slot",
);
console.log("ok - blends headlines across providers instead of one feed's whole batch");

// De-duplication is title-based and case-insensitive; blank titles are dropped.
const deduped = blendHeadlines(
  [
    [{ title: "Apple beats", publisher: "A", url: "u1" }],
    [
      { title: "APPLE BEATS", publisher: "B", url: "u2" },
      { title: "   ", publisher: "C", url: "u3" },
      { title: "Other story", publisher: "D", url: "u4" },
    ],
  ],
  5,
);
assert.deepEqual(deduped.map((h) => h.publisher), ["A", "D"]);
console.log("ok - de-duplicates by normalised title and drops blank headlines");

// Providers with fewer items than the limit must drain without looping.
const short = blendHeadlines([batch("delta", 1, "A"), batch("echo", 1, "B")], 10);
assert.equal(short.length, 2);
console.log("ok - stops cleanly when providers run out of items");

// The same wire story arriving from two publishers under different lead text and
// different URLs (observed in a live run) must collapse to one headline.
const syndicated = blendHeadlines(
  [
    [
      {
        title: "Prediction: This Is What a $1,000 Investment in Apple Will Be Worth by 2030 | The Motley Fool",
        publisher: "fool.com",
        url: "https://www.fool.com/investing/2026/09/24/prediction-apple-2030/",
      },
    ],
    [
      {
        title: "Prediction: This Is What a $1,000 Investment in Apple Will Be Worth",
        publisher: "Yahoo Finance",
        url: "https://finance.yahoo.com/news/prediction-apple-investment-2030.html",
      },
      {
        title: "Chip stocks retreat as Qualcomm secures Apple licensing deal",
        publisher: "investors.com",
        url: "https://www.investors.com/news/technology/apple-qualcomm-licensing/",
      },
    ],
  ],
  5,
);
assert.equal(syndicated.length, 2, `syndicated duplicate should collapse, got ${JSON.stringify(syndicated)}`);
assert.deepEqual(syndicated.map((h) => h.publisher), ["fool.com", "investors.com"]);
console.log("ok - collapses the same story syndicated across publishers with different URLs");

// Fingerprints must be stable under punctuation, case and filler words.
assert.equal(
  titleFingerprint("Apple's Quality Is Tempting, But I'm Put Off By The Valuation"),
  titleFingerprint("apple quality tempting but put off valuation"),
);
assert.equal(
  urlFingerprint("https://WWW.Fool.com/investing/story/?utm=1#top"),
  urlFingerprint("https://fool.com/investing/story"),
);
console.log("ok - fingerprints ignore case, punctuation, filler words, query strings and www");

console.log("5 headline-blend checks passed");
