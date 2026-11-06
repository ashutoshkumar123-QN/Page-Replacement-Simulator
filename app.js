/**
 * MODULE 2 - USER INTERFACE & VISUALIZATION (Person 2)
 * ---------------------------------------------------------------
 * Reads the user's input, calls the simulation engine (window.PageEngine,
 * defined in engine.js) and renders the results. This file never
 * implements an algorithm itself: it only consumes the engine's result
 * contract (see the header comment in engine.js).
 */
(function () {
  'use strict';

  var E = window.PageEngine;
  var $ = function (id) { return document.getElementById(id); };

  // results: array of engine results, active: index of the shown result,
  // step: number of requests already processed (0..total), timer: play interval
  var state = { results: [], active: 0, step: 0, timer: null };

  // CSS cannot override an explicit smooth scroll requested from JavaScript, so check the preference here too
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ------------------------------------------------------------------
  // Small DOM helpers (text is always set with textContent, never innerHTML)
  // ------------------------------------------------------------------
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showError(message) {
    var box = $('error');
    box.textContent = message || '';
    box.hidden = !message;
  }

  function current() { return state.results[state.active]; }
  function total() { return current() ? current().steps.length : 0; }

  // ------------------------------------------------------------------
  // Running a simulation
  // ------------------------------------------------------------------
  function runSimulation(note) {
    stopPlayback();
    var refs, frameCount;
    try {
      refs = E.parseReferenceString($('refs').value);
      frameCount = Number($('frames').value);
      E.validateInput(refs, frameCount);
    } catch (err) {
      showError(err.message);
      return;
    }
    showError('');

    var algo = $('algo').value;
    state.results = algo === 'ALL' ? E.compareAll(refs, frameCount) : [E.simulate(algo, refs, frameCount)];
    state.active = 0;
    state.step = total(); // show the finished simulation first; Reset or Play replays it

    $('results').hidden = false;
    renderNote(note);
    renderAll();
    announceSummary();
    $('results').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------
  // Spoken summary after a new run or a tab switch (stepping is announced by goTo)
  function announceSummary() {
    var res = current();
    $('simulation-announcement').textContent =
      res.algorithm + ' ready. ' + res.totalRequests + ' requests, ' + res.totalHits + ' page hits, ' +
      res.totalFaults + ' page faults, fault ratio ' + res.faultRatio + ' percent.';
  }

  function renderAll() {
    renderTabs();
    renderStats();
    renderControls();
    renderExplanation();
    renderTrace();
    renderComparison();
  }

  function renderTabs() {
    var tabs = $('tabs');
    tabs.textContent = '';
    tabs.hidden = state.results.length < 2;
    state.results.forEach(function (res, i) {
      var b = el('button', 'tab', res.algorithm);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(i === state.active));
      b.addEventListener('click', function () {
        stopPlayback();
        state.active = i;
        state.step = total();
        renderAll();
        announceSummary();
      });
      tabs.appendChild(b);
    });
  }

  function renderStats() {
    var res = current();
    var done = res.steps.slice(0, state.step);
    var hits = done.filter(function (s) { return s.status === 'Hit'; }).length;
    var faults = done.length - hits;
    var faultRatio = done.length ? Math.round((faults / done.length) * 10000) / 100 : 0;
    var hitRatio = done.length ? Math.round((hits / done.length) * 10000) / 100 : 0;

    var cards = [
      ['Algorithm', res.algorithm, ''],
      ['Frames', String(res.frameCount), ''],
      ['Requests', state.step + ' / ' + res.totalRequests, ''],
      ['Page hits', String(hits), 'hit'],
      ['Page faults', String(faults), 'fault'],
      ['Hit ratio', hitRatio + '%', 'hit'],
      ['Fault ratio', faultRatio + '%', 'fault']
    ];
    var box = $('stats');
    box.textContent = '';
    cards.forEach(function (c) {
      var card = el('div', 'stat ' + c[2]);
      card.appendChild(el('div', 'label', c[0]));
      card.appendChild(el('div', 'value', c[1]));
      box.appendChild(card);
    });
  }

  function renderControls() {
    var n = total();
    $('btn-reset').disabled = state.step === 0;
    $('btn-prev').disabled = state.step === 0;
    $('btn-next').disabled = state.step >= n;
    $('btn-end').disabled = state.step >= n;
    // Same symbols as the HTML entities used elsewhere (&#10074; and &#9654;), set as plain text
    $('btn-play').textContent = state.timer ? '\u275A\u275A Pause' : '\u25B6 Play';
    $('step-counter').textContent = 'Step ' + state.step + ' of ' + n;
  }

  function renderExplanation() {
    var box = $('explanation');
    if (state.step === 0) {
      box.textContent = 'Press Next or Play to watch the simulation step by step.';
      return;
    }
    var s = current().steps[state.step - 1];
    box.textContent = 'Request ' + s.step + ' (page ' + s.page + '): ' + s.explanation;
  }

  function renderTrace() {
    var res = current();
    var table = el('table', 'trace');
    var head = el('tr');
    head.appendChild(el('th', 'row-head', 'Request'));
    res.steps.forEach(function (s, i) {
      var th = el('th', cellClass(i), String(s.page));
      th.scope = 'col';
      head.appendChild(th);
    });
    var thead = el('thead');
    thead.appendChild(head);
    table.appendChild(thead);

    var body = el('tbody');
    for (var f = 0; f < res.frameCount; f++) {
      var row = el('tr');
      var rh = el('th', 'row-head', 'Frame ' + (f + 1));
      rh.scope = 'row';
      row.appendChild(rh);
      res.steps.forEach(function (s, i) {
        var visible = i < state.step;
        var value = s.frames[f];
        var cls = cellClass(i);
        if (!visible) cls += ' future';
        else if (value === null) cls += ' empty';
        if (visible && s.changedSlot === f) cls += ' changed';
        row.appendChild(el('td', cls, visible ? (value === null ? '-' : String(value)) : '.'));
      });
      body.appendChild(row);
    }

    var result = el('tr');
    result.appendChild(el('th', 'row-head', 'Result'));
    res.steps.forEach(function (s, i) {
      var visible = i < state.step;
      var cls = cellClass(i);
      if (!visible) cls += ' future';
      else cls += s.status === 'Hit' ? ' res-hit' : ' res-fault';
      result.appendChild(el('td', cls, visible ? s.status : '.'));
    });
    body.appendChild(result);

    var evicted = el('tr');
    evicted.appendChild(el('th', 'row-head', 'Evicted'));
    res.steps.forEach(function (s, i) {
      var visible = i < state.step;
      var cls = cellClass(i) + (visible ? '' : ' future');
      evicted.appendChild(el('td', cls, visible ? (s.replaced === null ? '-' : String(s.replaced)) : '.'));
    });
    body.appendChild(evicted);

    table.appendChild(body);
    var wrap = $('trace-wrap');
    wrap.textContent = '';
    wrap.appendChild(table);

    // keep the current column in view while stepping through long strings
    var currentCell = wrap.querySelector('.col-current');
    if (currentCell && wrap.scrollWidth > wrap.clientWidth) {
      wrap.scrollLeft = Math.max(0, currentCell.offsetLeft - wrap.clientWidth / 2);
    }
  }

  function cellClass(i) {
    return i === state.step - 1 ? 'col-current' : '';
  }

  function renderComparison() {
    var section = $('compare');
    var results = state.results;
    section.hidden = results.length < 2;
    if (results.length < 2) return;

    var best = E.bestAlgorithms(results);
    var minFaults = Math.min.apply(null, results.map(function (r) { return r.totalFaults; }));
    $('best').textContent = best.length === results.length
      ? 'All algorithms perform equally on this input (' + minFaults + ' page faults each).'
      : 'Best for this input: ' + best.join(' and ') + ' with ' + minFaults + ' page faults.';

    var table = el('table', 'compare-table');
    var thead = el('thead');
    var hr = el('tr');
    ['Algorithm', 'Hits', 'Faults', 'Hit ratio', 'Fault ratio', 'Extra faults vs best'].forEach(function (h) {
      hr.appendChild(el('th', '', h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el('tbody');
    results.forEach(function (r) {
      var tr = el('tr', best.indexOf(r.algorithm) !== -1 ? 'best-row' : '');
      [r.algorithm, r.totalHits, r.totalFaults, r.hitRatio + '%', r.faultRatio + '%', r.totalFaults - minFaults]
        .forEach(function (v) { tr.appendChild(el('td', '', String(v))); });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    var wrap = $('compare-table-wrap');
    wrap.textContent = '';
    wrap.appendChild(table);

    var chart = $('chart');
    chart.textContent = '';
    results.forEach(function (r) {
      var row = el('div', 'bar-row' + (best.indexOf(r.algorithm) !== -1 ? ' best' : ''));
      row.appendChild(el('div', 'bar-label', r.algorithm));
      var track = el('div', 'bar-track');
      var fill = el('div', 'bar-fill');
      fill.style.width = r.faultRatio + '%';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('div', 'bar-value', r.totalFaults + ' faults (' + r.faultRatio + '%)'));
      chart.appendChild(row);
    });
  }

  function renderNote(note) {
    var box = $('note');
    box.textContent = '';
    box.hidden = !note;
    if (!note) return;
    note.forEach(function (line) { box.appendChild(el('p', '', line)); });
  }

  // ------------------------------------------------------------------
  // Step controls
  // ------------------------------------------------------------------
  function goTo(step) {
    state.step = Math.max(0, Math.min(total(), step));

    renderStats();
    renderControls();
    renderExplanation();
    renderTrace();

    // Screen readers: one complete, polite announcement per step
    var announcement = $('simulation-announcement');

    if (state.step === 0) {
      announcement.textContent = 'Simulation reset. Step 0 of ' + total() + '.';
      return;
    }

    var currentStep = current().steps[state.step - 1];

    announcement.textContent =
      'Step ' + state.step + ' of ' + total() +
      '. Page ' + currentStep.page +
      '. ' + currentStep.status +
      '. ' + currentStep.explanation;
  }

  function stopPlayback() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    if (state.results.length) renderControls();
  }

  function startPlayback() {
    if (state.step >= total()) goTo(0);
    state.timer = setInterval(function () {
      if (state.step >= total()) {
        stopPlayback();
        return;
      }
      goTo(state.step + 1);
      if (state.step >= total()) stopPlayback();
    }, Number($('speed').value));
    renderControls();
  }

  // ------------------------------------------------------------------
  // Helpers for the example buttons
  // ------------------------------------------------------------------
  function randomReferenceString() {
    var out = [];
    for (var i = 0; i < 15; i++) out.push(Math.floor(Math.random() * 8));
    return out.join(' ');
  }

  function beladyNote() {
    var refs = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
    var f3 = E.fifo(refs, 3).totalFaults;
    var f4 = E.fifo(refs, 4).totalFaults;
    var l3 = E.lru(refs, 3).totalFaults;
    var l4 = E.lru(refs, 4).totalFaults;
    return [
      "Belady's anomaly: giving FIFO more memory can cause more page faults.",
      'FIFO: ' + f3 + ' faults with 3 frames, but ' + f4 + ' faults with 4 frames.',
      'LRU does not suffer from this: ' + l3 + ' faults with 3 frames and ' + l4 + ' with 4 frames.',
      'Change the number of frames to 4 and run again to see it for yourself.'
    ];
  }

  // ------------------------------------------------------------------
  // Event wiring
  // ------------------------------------------------------------------
  $('sim-form').addEventListener('submit', function (e) {
    e.preventDefault();
    runSimulation();
  });

  $('btn-random').addEventListener('click', function () {
    $('refs').value = randomReferenceString();
    runSimulation();
  });

  $('btn-example').addEventListener('click', function () {
    $('refs').value = '7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1';
    $('frames').value = 3;
    $('algo').value = 'ALL';
    runSimulation();
  });

  $('btn-belady').addEventListener('click', function () {
    $('refs').value = '1 2 3 4 1 2 5 1 2 3 4 5';
    $('frames').value = 3;
    $('algo').value = 'ALL';
    runSimulation(beladyNote());
  });

  $('btn-reset').addEventListener('click', function () { stopPlayback(); goTo(0); });
  $('btn-prev').addEventListener('click', function () { stopPlayback(); goTo(state.step - 1); });
  $('btn-next').addEventListener('click', function () { stopPlayback(); goTo(state.step + 1); });
  $('btn-end').addEventListener('click', function () { stopPlayback(); goTo(total()); });
  $('btn-play').addEventListener('click', function () {
    if (state.timer) stopPlayback(); else startPlayback();
  });
  $('speed').addEventListener('change', function () {
    if (state.timer) { stopPlayback(); startPlayback(); }
  });

  // Show the textbook example as soon as the page opens
  runSimulation();
  window.scrollTo(0, 0);
})();
