/**
 * Unit tests for the simulation engine (Module 1).
 * Run with:  node tests.js
 *
 * Expected values come from the standard textbook example
 * (Silberschatz, Operating System Concepts) and hand calculation.
 */
'use strict';
var E = require('./engine.js');

// Small deterministic random number generator (mulberry32). Every run of the
// tests uses the same inputs, so a failure can always be reproduced.
function seededRandom(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var passed = 0;
var failed = 0;

function check(name, actual, expected) {
  var ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log('  PASS  ' + name);
  } else {
    failed++;
    console.log('  FAIL  ' + name + '\n        expected ' + JSON.stringify(expected) + '\n        got      ' + JSON.stringify(actual));
  }
}

function throwsError(name, fn) {
  try { fn(); } catch (e) { passed++; console.log('  PASS  ' + name); return; }
  failed++;
  console.log('  FAIL  ' + name + ' (no error thrown)');
}

// ---- Textbook reference string, 3 frames -------------------------------
console.log('\nTextbook string 7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1, 3 frames');
var book = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
check('FIFO faults = 15', E.fifo(book, 3).totalFaults, 15);
check('LRU faults = 12', E.lru(book, 3).totalFaults, 12);
check('Optimal faults = 9', E.optimal(book, 3).totalFaults, 9);

// ---- Step-by-step frame contents ---------------------------------------
console.log('\nStep-by-step frame contents for 1 2 3 1 4, 3 frames');
var small = [1, 2, 3, 1, 4];
var f = E.fifo(small, 3).steps;
check('FIFO final frames = 4 2 3', f[4].frames, [4, 2, 3]);
check('FIFO evicts page 1', f[4].replaced, 1);
check('FIFO step 4 is a Hit', f[3].status, 'Hit');
var l = E.lru(small, 3).steps;
check('LRU final frames = 1 4 3', l[4].frames, [1, 4, 3]);
check('LRU evicts page 2', l[4].replaced, 2);
var o = E.optimal(small, 3).steps;
check('Optimal final frames = 4 2 3 (tie broken by lowest frame)', o[4].frames, [4, 2, 3]);

// ---- Result contract ---------------------------------------------------
console.log('\nResult contract and ratios');
var r = E.fifo(small, 3);
check('totalHits = 1', r.totalHits, 1);
check('totalFaults = 4', r.totalFaults, 4);
check('faultRatio = 80', r.faultRatio, 80);
check('hitRatio = 20', r.hitRatio, 20);
check('hits + faults = requests', r.totalHits + r.totalFaults, r.totalRequests);
check('every step has frameCount slots', r.steps.every(function (s) { return s.frames.length === 3; }), true);

// ---- Edge cases --------------------------------------------------------
console.log('\nEdge cases');
check('1 frame, all different pages = all faults', E.lru([1, 2, 3, 4], 1).totalFaults, 4);
check('1 frame, same page repeated = 1 fault', E.fifo([5, 5, 5, 5], 1).totalFaults, 1);
check('single request', E.optimal([9], 3).totalFaults, 1);
check('frames >= distinct pages gives faults = distinct pages (FIFO)', E.fifo([1, 2, 1, 2, 3], 5).totalFaults, 3);
check('frames >= distinct pages gives faults = distinct pages (LRU)', E.lru([1, 2, 1, 2, 3], 5).totalFaults, 3);
check('frames >= distinct pages gives faults = distinct pages (Optimal)', E.optimal([1, 2, 1, 2, 3], 5).totalFaults, 3);

// ---- Optimal is never worse than FIFO or LRU ---------------------------
console.log('\nProperty: Optimal <= FIFO and Optimal <= LRU on 200 seeded random inputs');
var always = true;
var rand = seededRandom(2026);
for (var t = 0; t < 200; t++) {
  var len = 5 + Math.floor(rand() * 40);
  var refs = [];
  for (var i = 0; i < len; i++) refs.push(Math.floor(rand() * 8));
  var frames = 1 + Math.floor(rand() * 5);
  var opt = E.optimal(refs, frames).totalFaults;
  if (opt > E.fifo(refs, frames).totalFaults || opt > E.lru(refs, frames).totalFaults) always = false;
}
check('Optimal never loses', always, true);

// ---- Optimised Optimal agrees with a naive reference -------------------
console.log('\nCross-check: optimised Optimal vs a straightforward version');
// Independent, deliberately simple Optimal: scans the future for every page.
function naiveOptimalFrames(refs, frameCount) {
  var frames = [];
  var history = [];
  refs.forEach(function (page, i) {
    if (frames.indexOf(page) === -1) {
      if (frames.length < frameCount) {
        frames.push(page);
      } else {
        var victim = 0;
        var farthest = -1;
        frames.forEach(function (p, slot) {
          var next = refs.indexOf(p, i + 1);
          if (next === -1) next = Infinity;
          if (next > farthest) { farthest = next; victim = slot; }
        });
        frames[victim] = page;
      }
    }
    var padded = frames.slice();
    while (padded.length < frameCount) padded.push(null);
    history.push(padded);
  });
  return history;
}
var rand2 = seededRandom(7);
var identical = true;
for (var c = 0; c < 300; c++) {
  var n2 = 1 + Math.floor(rand2() * 60);
  var refs2 = [];
  for (var j = 0; j < n2; j++) refs2.push(Math.floor(rand2() * 10));
  var f2 = 1 + Math.floor(rand2() * 6);
  var expected = naiveOptimalFrames(refs2, f2);
  var actual = E.optimal(refs2, f2).steps.map(function (s) { return s.frames; });
  if (JSON.stringify(expected) !== JSON.stringify(actual)) identical = false;
}
check('Optimal matches the naive version at every step on 300 seeded inputs', identical, true);

// ---- Belady's anomaly (FIFO only) -------------------------------------
console.log("\nBelady's anomaly");
var belady = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
check('FIFO, 3 frames = 9 faults', E.fifo(belady, 3).totalFaults, 9);
check('FIFO, 4 frames = 10 faults (more frames, more faults)', E.fifo(belady, 4).totalFaults, 10);
check('LRU, 3 frames = 10 faults', E.lru(belady, 3).totalFaults, 10);
check('LRU, 4 frames = 8 faults (no anomaly)', E.lru(belady, 4).totalFaults, 8);

// ---- Input validation --------------------------------------------------
console.log('\nInput validation');
check('parse with commas and spaces', E.parseReferenceString('1, 2  3,4'), [1, 2, 3, 4]);
throwsError('empty string rejected', function () { E.parseReferenceString('   '); });
throwsError('letters rejected', function () { E.parseReferenceString('1 a 3'); });
throwsError('negative numbers rejected', function () { E.parseReferenceString('1 -2 3'); });
throwsError('0 frames rejected', function () { E.fifo([1, 2], 0); });
throwsError('too many frames rejected', function () { E.fifo([1, 2], 50); });
throwsError('non-integer frames rejected', function () { E.fifo([1, 2], 2.5); });
throwsError('unknown algorithm rejected', function () { E.simulate('MRU', [1], 1); });

// ---- Boundary conditions ------------------------------------------------
console.log('\nBoundary conditions');
throwsError('more than 100 references rejected', function () { E.fifo(new Array(101).fill(1), 3); });
throwsError('page greater than 999 rejected', function () { E.fifo([1000], 3); });
throwsError('negative frame count rejected', function () { E.fifo([1, 2], -1); });
check('exactly 100 references accepted', E.lru(new Array(100).fill(1), 3).totalRequests, 100);
check('highest allowed page (999) accepted', E.fifo([999, 0, 999], 2).totalFaults, 2);
check('maximum frames (10) accepted', E.optimal([1, 2, 3], 10).frameCount, 10);

// ---- Extra edge cases ---------------------------------------------------
console.log('\nExtra edge cases');
check('unused frames stay empty (null)', E.fifo([5], 3).steps[0].frames, [5, null, null]);
['fifo', 'lru', 'optimal'].forEach(function (name) {
  var res = E[name]([4, 4, 4, 4, 4], 3);
  check(name + ': all identical pages = 1 fault and 4 hits', [res.totalFaults, res.totalHits], [1, 4]);
});
['fifo', 'lru', 'optimal'].forEach(function (name) {
  var input = [3, 1, 3, 2, 1];
  var copy = input.slice();
  var res = E[name](input, 2);
  res.referenceString.push(99);
  check(name + ': input array is not modified or shared with the result', input, copy);
});
check('FIFO and LRU evict different pages on 1 2 3 1 4',
  [E.fifo(small, 3).steps[4].replaced, E.lru(small, 3).steps[4].replaced], [1, 2]);
check('FIFO and LRU give different fault counts on the Belady string (3 frames)',
  E.fifo(belady, 3).totalFaults !== E.lru(belady, 3).totalFaults, true);

// ---- compare / best ----------------------------------------------------
console.log('\ncompareAll / bestAlgorithms');
var all = E.compareAll(book, 3);
check('compareAll returns 3 results', all.length, 3);
check('best algorithm on textbook string = Optimal', E.bestAlgorithms(all), ['Optimal']);
check('bestAlgorithms returns every tied algorithm', E.bestAlgorithms(E.compareAll([1, 1, 1], 3)), ['FIFO', 'LRU', 'Optimal']);
throwsError('bestAlgorithms rejects an empty list', function () { E.bestAlgorithms([]); });
throwsError('bestAlgorithms rejects a non-array', function () { E.bestAlgorithms(null); });

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
