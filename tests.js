/**
 * Unit tests for the simulation engine (Module 1).
 * Run with:  node tests.js
 *
 * Expected values come from the standard textbook example
 * (Silberschatz, Operating System Concepts) and hand calculation.
 */
'use strict';
var E = require('./engine.js');

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
console.log('\nProperty: Optimal <= FIFO and Optimal <= LRU on 200 random inputs');
var always = true;
for (var t = 0; t < 200; t++) {
  var len = 5 + Math.floor(Math.random() * 40);
  var refs = [];
  for (var i = 0; i < len; i++) refs.push(Math.floor(Math.random() * 8));
  var frames = 1 + Math.floor(Math.random() * 5);
  var opt = E.optimal(refs, frames).totalFaults;
  if (opt > E.fifo(refs, frames).totalFaults || opt > E.lru(refs, frames).totalFaults) always = false;
}
check('Optimal never loses', always, true);

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

// ---- compare / best ----------------------------------------------------
console.log('\ncompareAll / bestAlgorithms');
var all = E.compareAll(book, 3);
check('compareAll returns 3 results', all.length, 3);
check('best algorithm on textbook string = Optimal', E.bestAlgorithms(all), ['Optimal']);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
