/**
 * MODULE 1 - SIMULATION ENGINE (Person 1)
 * ---------------------------------------------------------------
 * Page replacement algorithms: FIFO, LRU and Optimal.
 *
 * The engine has NO dependency on the user interface. It works in the
 * browser (window.PageEngine) and in Node.js (require('./engine.js')),
 * which makes it easy to unit-test.
 *
 * Every algorithm returns the same "result contract":
 * {
 *   algorithm:     "FIFO" | "LRU" | "Optimal",
 *   frameCount:    number,
 *   referenceString: number[],
 *   steps: [{
 *     step:        1-based index of the request,
 *     page:        page requested,
 *     frames:      array of length frameCount (null = empty slot),
 *     status:      "Hit" | "Fault",
 *     replaced:    page that was evicted, or null,
 *     changedSlot: index of the slot that was written, or -1 on a hit,
 *     explanation: human readable reason for the decision
 *   }],
 *   totalRequests, totalHits, totalFaults,
 *   hitRatio, faultRatio          (percentages, 2 decimals)
 * }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PageEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_REFERENCES = 100;
  var MAX_FRAMES = 10;
  var MAX_PAGE = 999;

  // ------------------------------------------------------------------
  // Input handling
  // ------------------------------------------------------------------

  /**
   * Converts text such as "7, 0 1 2" into [7, 0, 1, 2].
   * Accepts commas and/or whitespace as separators.
   * Throws an Error with a user-friendly message on invalid input.
   */
  function parseReferenceString(text) {
    if (typeof text !== 'string' || text.trim() === '') {
      throw new Error('Please enter a reference string, e.g. 7 0 1 2 0 3 0 4.');
    }
    var tokens = text.trim().split(/[\s,]+/).filter(Boolean);
    return tokens.map(function (token) {
      if (!/^\d+$/.test(token)) {
        throw new Error('Invalid page "' + token + '". Use whole numbers only (0 or greater).');
      }
      return Number(token);
    });
  }

  /** Validates the reference string and frame count. Throws on error. */
  function validateInput(referenceString, frameCount) {
    if (!Array.isArray(referenceString) || referenceString.length === 0) {
      throw new Error('The reference string must contain at least one page.');
    }
    if (referenceString.length > MAX_REFERENCES) {
      throw new Error('The reference string is limited to ' + MAX_REFERENCES + ' pages.');
    }
    referenceString.forEach(function (p) {
      if (!Number.isInteger(p) || p < 0 || p > MAX_PAGE) {
        throw new Error('Pages must be whole numbers between 0 and ' + MAX_PAGE + '.');
      }
    });
    if (!Number.isInteger(frameCount) || frameCount < 1 || frameCount > MAX_FRAMES) {
      throw new Error('The number of frames must be a whole number between 1 and ' + MAX_FRAMES + '.');
    }
  }

  // ------------------------------------------------------------------
  // Shared helpers
  // ------------------------------------------------------------------

  function round2(x) {
    return Math.round(x * 100) / 100;
  }

  function buildResult(algorithm, referenceString, frameCount, steps) {
    var hits = steps.filter(function (s) { return s.status === 'Hit'; }).length;
    var total = steps.length;
    var faults = total - hits;
    return {
      algorithm: algorithm,
      frameCount: frameCount,
      referenceString: referenceString.slice(),
      steps: steps,
      totalRequests: total,
      totalHits: hits,
      totalFaults: faults,
      hitRatio: round2((hits / total) * 100),
      faultRatio: round2((faults / total) * 100)
    };
  }

  function emptyFrames(n) {
    var f = [];
    for (var i = 0; i < n; i++) f.push(null);
    return f;
  }

  function makeStep(index, page, frames, status, replaced, changedSlot, explanation) {
    return {
      step: index + 1,
      page: page,
      frames: frames.slice(),
      status: status,
      replaced: replaced,
      changedSlot: changedSlot,
      explanation: explanation
    };
  }

  // ------------------------------------------------------------------
  // FIFO - evict the page that has been in memory the longest.
  // Time: O(n * f)   Space: O(f)   (n = requests, f = frames)
  // ------------------------------------------------------------------
  function fifo(referenceString, frameCount) {
    validateInput(referenceString, frameCount);
    var frames = emptyFrames(frameCount);
    var nextVictim = 0; // circular pointer = slot holding the oldest page
    var steps = [];

    referenceString.forEach(function (page, i) {
      var existing = frames.indexOf(page);
      if (existing !== -1) {
        steps.push(makeStep(i, page, frames, 'Hit', null, -1,
          'Page ' + page + ' is already in frame ' + (existing + 1) + ', so no replacement is needed.'));
        return;
      }
      var emptySlot = frames.indexOf(null);
      if (emptySlot !== -1) {
        frames[emptySlot] = page;
        steps.push(makeStep(i, page, frames, 'Fault', null, emptySlot,
          'Page fault. A free frame was available, so page ' + page + ' was loaded into frame ' + (emptySlot + 1) + '.'));
        return;
      }
      var evicted = frames[nextVictim];
      var slot = nextVictim;
      frames[slot] = page;
      nextVictim = (nextVictim + 1) % frameCount;
      steps.push(makeStep(i, page, frames, 'Fault', evicted, slot,
        'Page fault. Memory is full. Page ' + evicted + ' arrived first (oldest), so it was replaced by page ' + page + '.'));
    });

    return buildResult('FIFO', referenceString, frameCount, steps);
  }

  // ------------------------------------------------------------------
  // LRU - evict the page that has not been used for the longest time.
  // Time: O(n * f)   Space: O(f)
  // ------------------------------------------------------------------
  function lru(referenceString, frameCount) {
    validateInput(referenceString, frameCount);
    var frames = emptyFrames(frameCount);
    var lastUsed = {}; // page -> index of its most recent request
    var steps = [];

    referenceString.forEach(function (page, i) {
      var existing = frames.indexOf(page);
      if (existing !== -1) {
        lastUsed[page] = i;
        steps.push(makeStep(i, page, frames, 'Hit', null, -1,
          'Page ' + page + ' is already in frame ' + (existing + 1) + '. Its "recently used" time is refreshed.'));
        return;
      }
      var emptySlot = frames.indexOf(null);
      if (emptySlot !== -1) {
        frames[emptySlot] = page;
        lastUsed[page] = i;
        steps.push(makeStep(i, page, frames, 'Fault', null, emptySlot,
          'Page fault. A free frame was available, so page ' + page + ' was loaded into frame ' + (emptySlot + 1) + '.'));
        return;
      }
      // Find the resident page with the oldest last-use time.
      var slot = 0;
      for (var s = 1; s < frameCount; s++) {
        if (lastUsed[frames[s]] < lastUsed[frames[slot]]) slot = s;
      }
      var evicted = frames[slot];
      frames[slot] = page;
      lastUsed[page] = i;
      steps.push(makeStep(i, page, frames, 'Fault', evicted, slot,
        'Page fault. Memory is full. Page ' + evicted + ' was used least recently (last used at request ' +
        (lastUsed[evicted] + 1) + '), so it was replaced by page ' + page + '.'));
    });

    return buildResult('LRU', referenceString, frameCount, steps);
  }

  // ------------------------------------------------------------------
  // Optimal (Belady's MIN) - evict the page whose next use is farthest
  // in the future (or never). Needs the whole reference string, so it is
  // a theoretical benchmark rather than a practical algorithm.
  // Ties (several pages never used again) are broken by lowest frame
  // number so results are deterministic.
  //
  // Speed-up: the position of the next request for every page is computed
  // once, in one backward pass. Each eviction then only compares the f
  // stored values instead of scanning the rest of the reference string.
  // Time: O(n * f)   Space: O(n + f)
  // ------------------------------------------------------------------
  function optimal(referenceString, frameCount) {
    validateInput(referenceString, frameCount);
    var frames = emptyFrames(frameCount);
    var steps = [];
    var total = referenceString.length;

    // nextOccurrence[i] = index of the next request for the same page after
    // request i, or Infinity when that page is never requested again.
    var nextOccurrence = new Array(total);
    var seenAt = {};
    for (var k = total - 1; k >= 0; k--) {
      var p = referenceString[k];
      nextOccurrence[k] = Object.prototype.hasOwnProperty.call(seenAt, p) ? seenAt[p] : Infinity;
      seenAt[p] = k;
    }
    // frameNextUse[slot] = when the page held in that slot is needed next
    var frameNextUse = emptyFrames(frameCount);

    referenceString.forEach(function (page, i) {
      var existing = frames.indexOf(page);
      if (existing !== -1) {
        frameNextUse[existing] = nextOccurrence[i];
        steps.push(makeStep(i, page, frames, 'Hit', null, -1,
          'Page ' + page + ' is already in frame ' + (existing + 1) + ', so no replacement is needed.'));
        return;
      }
      var emptySlot = frames.indexOf(null);
      if (emptySlot !== -1) {
        frames[emptySlot] = page;
        frameNextUse[emptySlot] = nextOccurrence[i];
        steps.push(makeStep(i, page, frames, 'Fault', null, emptySlot,
          'Page fault. A free frame was available, so page ' + page + ' was loaded into frame ' + (emptySlot + 1) + '.'));
        return;
      }
      var slot = 0;
      var farthest = -1;
      for (var s = 0; s < frameCount; s++) {
        if (frameNextUse[s] > farthest) {
          farthest = frameNextUse[s];
          slot = s;
        }
      }
      var evicted = frames[slot];
      frames[slot] = page;
      frameNextUse[slot] = nextOccurrence[i];
      var why = farthest === Infinity
        ? 'is never used again'
        : 'is not needed until request ' + (farthest + 1) + ' (the farthest in the future)';
      steps.push(makeStep(i, page, frames, 'Fault', evicted, slot,
        'Page fault. Memory is full. Page ' + evicted + ' ' + why + ', so it was replaced by page ' + page + '.'));
    });

    return buildResult('Optimal', referenceString, frameCount, steps);
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  var ALGORITHMS = { FIFO: fifo, LRU: lru, Optimal: optimal };

  /** Runs one algorithm by name ("FIFO", "LRU" or "Optimal"). */
  function simulate(algorithm, referenceString, frameCount) {
    var fn = ALGORITHMS[algorithm];
    if (!fn) throw new Error('Unknown algorithm: ' + algorithm);
    return fn(referenceString, frameCount);
  }

  /** Runs all algorithms on the same input and returns an array of results. */
  function compareAll(referenceString, frameCount) {
    return Object.keys(ALGORITHMS).map(function (name) {
      return ALGORITHMS[name](referenceString, frameCount);
    });
  }

  /** Returns the names of the algorithm(s) with the fewest page faults. */
  function bestAlgorithms(results) {
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('Results cannot be empty.');
    }
    var min = Math.min.apply(null, results.map(function (r) { return r.totalFaults; }));
    return results.filter(function (r) { return r.totalFaults === min; })
      .map(function (r) { return r.algorithm; });
  }

  return {
    parseReferenceString: parseReferenceString,
    validateInput: validateInput,
    fifo: fifo,
    lru: lru,
    optimal: optimal,
    simulate: simulate,
    compareAll: compareAll,
    bestAlgorithms: bestAlgorithms,
    ALGORITHM_NAMES: Object.keys(ALGORITHMS),
    LIMITS: { MAX_REFERENCES: MAX_REFERENCES, MAX_FRAMES: MAX_FRAMES, MAX_PAGE: MAX_PAGE }
  };
});
