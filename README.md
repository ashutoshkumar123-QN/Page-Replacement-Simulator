# Efficient Page Replacement Algorithm Simulator

An interactive, browser-based simulator that lets users test, visualize and compare the **FIFO**, **LRU** and **Optimal** page replacement algorithms used in operating-system virtual memory management.

No installation, server or internet connection is needed. Open `index.html` in any modern browser.

---

## 1. Project overview

| | |
|---|---|
| **Problem statement** | Design a simulator that allows users to test and compare different page replacement algorithms (e.g. FIFO, LRU, Optimal). It should provide visualizations and performance metrics to aid in understanding algorithm efficiency. |
| **Goal** | An educational tool that shows exactly how each algorithm manages memory frames, and which one performs best for a given input. |
| **Expected outcomes** | Users can enter a reference string and frame count, watch every request processed step by step, see hits, faults and evictions, and compare the algorithms with tables and a chart. |
| **Scope** | FIFO, LRU and Optimal. Out of scope (future work): LFU, Clock / Second-Chance, multi-level paging, working-set model. |

## 2. Requirement checklist (where each requirement is met)

| Requirement from the problem statement | Where it is implemented |
|---|---|
| Test page replacement algorithms (FIFO, LRU, Optimal) | `engine.js`: `fifo()`, `lru()`, `optimal()` |
| Compare different algorithms | "Compare all" option; comparison table, bar chart and best-algorithm banner (`app.js`: `renderComparison()`) |
| Visualizations | Step-by-step frame table with colour-coded hits and faults, highlighted written frame, evicted-page row, bar chart |
| Performance metrics | Hits, faults, hit ratio, fault ratio, extra faults vs best (live-updating while stepping) |
| Aid understanding of algorithm efficiency | Plain-English explanation of every decision, Belady's anomaly demo, algorithm descriptions on the page |
| Input validation / robustness | `parseReferenceString()` and `validateInput()` with friendly error messages |
| Correctness evidence | `tests.js`: 36 automated tests, run with `node tests.js` |

## 3. Module breakdown

| | Module 1: Simulation Engine | Module 2: User Interface & Visualization |
|---|---|---|
| **Owner** | Person 1 | Person 2 |
| **Files** | `engine.js`, `tests.js` | `index.html`, `style.css`, `app.js` |
| **Purpose** | Core logic: run the algorithms and produce results and metrics | Collect input, display results, provide controls and charts |
| **Depends on** | Nothing (pure logic, also runs in Node.js) | Only the engine's result contract (below) |

The two modules are fully decoupled. The UI never implements an algorithm, and the engine never touches the page, so each person can work and test independently.

### The contract between the modules

Every algorithm returns this structure:

```js
{
  algorithm: "FIFO",              // "FIFO" | "LRU" | "Optimal"
  frameCount: 3,
  referenceString: [1, 2, 3, 1, 4],
  steps: [
    {
      step: 1,                    // 1-based request number
      page: 1,                    // page requested
      frames: [1, null, null],    // memory after this request (null = empty)
      status: "Fault",            // "Hit" | "Fault"
      replaced: null,             // evicted page, or null
      changedSlot: 0,             // frame index written, or -1 on a hit
      explanation: "Page fault. A free frame was available, ..."
    }
    // ... one entry per request
  ],
  totalRequests: 5,
  totalHits: 1,
  totalFaults: 4,
  hitRatio: 20,                   // percent
  faultRatio: 80                  // percent
}
```

## 4. Functionalities

### Module 1: Engine
- **FIFO**: evicts the page that entered memory first (circular pointer).
- **LRU**: evicts the page with the oldest last-use time.
- **Optimal**: evicts the page whose next use is farthest in the future (or never). Ties are broken by lowest frame number so results are deterministic.
- Hit and fault detection, frame state recorded after every request, hit/fault totals and ratios.
- Input parsing and validation (whole numbers only, 1 to 10 frames, up to 100 requests).
- `compareAll()` and `bestAlgorithms()` helpers for comparison.

**Worked example** (reference string `1 2 3 1 4`, 3 frames):

| Request | FIFO frames | Result | LRU frames | Result |
|---|---|---|---|---|
| 1 | 1 - - | Fault | 1 - - | Fault |
| 2 | 1 2 - | Fault | 1 2 - | Fault |
| 3 | 1 2 3 | Fault | 1 2 3 | Fault |
| 1 | 1 2 3 | Hit | 1 2 3 | Hit |
| 4 | **4** 2 3 | Fault (page 1 evicted: oldest) | 1 **4** 3 | Fault (page 2 evicted: least recently used) |

### Module 2: UI
- Inputs for reference string, number of frames and algorithm (FIFO, LRU, Optimal or Compare all).
- Step table: requests as columns, frames as rows, plus Result and Evicted rows. Green = hit, red = fault, yellow = frame written in this step. Labels are also written as text, so meaning never depends on colour alone.
- Controls: Reset, Previous, Play/Pause, Next, End, and a speed selector.
- Live statistic cards (requests processed, hits, faults, hit ratio, fault ratio).
- Per-step explanation text (educational mode).
- Comparison table, fault-ratio bar chart and a "best algorithm" banner.
- Extras: random reference string generator, textbook example button, Belady's anomaly demo.
- Responsive layout, keyboard-focusable controls, light and dark mode.

## 5. Technology choices

| Part | Choice | Why |
|---|---|---|
| Language | JavaScript (ES5-compatible) | Runs in the browser with no backend, and in Node.js for tests |
| Frontend | HTML5, CSS3 | No framework needed for this scope |
| Charts | Pure CSS bars | No external dependency, so it works offline and cannot break from a CDN failure |
| Testing | Plain Node.js script | No setup, easy to run: `node tests.js` |
| Tools | VS Code, Git/GitHub | Standard workflow |

## 6. How to run

**Simulator:** open `index.html` in a browser (double-click is enough).

**Tests:** requires Node.js.

```bash
node tests.js
```

Expected final line: `36 passed, 0 failed`.

## 7. Algorithm notes

| Algorithm | Idea | Time | Space | Notes |
|---|---|---|---|---|
| FIFO | Evict the oldest resident page | O(n · f) | O(f) | Simple, but suffers from Belady's anomaly |
| LRU | Evict the least recently used page | O(n · f) | O(f) | Good approximation of Optimal; no Belady's anomaly |
| Optimal | Evict the page used farthest in the future | O(n² · f) worst case | O(f) | Needs future knowledge, so it is a theoretical lower bound used as a benchmark |

(n = number of requests, f = number of frames)

Verified results for the standard textbook string `7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1` with 3 frames:

| Algorithm | Faults | Fault ratio |
|---|---|---|
| FIFO | 15 | 75% |
| LRU | 12 | 60% |
| Optimal | 9 | 45% |

**Belady's anomaly** (string `1 2 3 4 1 2 5 1 2 3 4 5`): FIFO gives 9 faults with 3 frames but 10 faults with 4 frames. LRU gives 10 and 8, so it does not show the anomaly.

## 8. Testing

`tests.js` contains 36 checks:
- Textbook fault counts for all three algorithms
- Exact frame contents and evicted page at each step on a small example
- Result contract and ratio calculations
- Edge cases: 1 frame, repeated pages, more frames than distinct pages, single request
- Property test: on 200 random inputs, Optimal never produces more faults than FIFO or LRU
- Belady's anomaly values
- Input validation (empty, letters, negatives, 0 or too many frames, non-integers, unknown algorithm)

Manual UI checklist: run the textbook example; step with Next and Previous; press Play; switch tabs; enter `1 x 3` and confirm an error appears; click each of the extra buttons.

## 9. Team task split

**Person 1: Simulation Engine**
- [x] Study FIFO, LRU, Optimal
- [x] Implement the three algorithms with a common signature
- [x] Record frame state and hit/fault status at each step
- [x] Calculate hits, faults and ratios
- [x] Input parsing and validation
- [x] Write and run the test suite

**Person 2: UI & Visualization**
- [x] Layout and input form with validation messages
- [x] Step table with hit/fault colouring
- [x] Step controls, play/pause and speed
- [x] Statistic cards
- [x] Comparison table, bar chart and best-algorithm banner
- [x] Random generator, textbook example and Belady's demo

**Shared:** agree the result contract, integrate, test, write the report and presentation.

## 10. Limitations and future work
- Limited to 100 requests and 10 frames to keep the visualization readable.
- Possible extensions: LFU, Clock and Second-Chance algorithms, exporting results as CSV, saving test cases, a graph of faults versus frame count.

## 11. Likely viva questions

1. **What is a page fault?** The requested page is not in a physical frame, so it must be loaded from disk, evicting another page if memory is full.
2. **Why is Optimal not used in real systems?** It requires knowing future page requests. It is used as a benchmark to judge other algorithms.
3. **What is Belady's anomaly?** For some algorithms (such as FIFO) increasing the number of frames can increase page faults. LRU and Optimal are stack algorithms and do not show it.
4. **Why does LRU usually beat FIFO?** Programs show locality of reference, so recently used pages are likely to be used again.
5. **How is Optimal tie-breaking handled here?** If several pages are never used again, the one in the lowest-numbered frame is evicted, so results are repeatable.
6. **How did you verify correctness?** Against textbook results (15 / 12 / 9 faults), hand-worked examples, and a property test that Optimal never loses.
