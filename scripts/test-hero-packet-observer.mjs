import assert from "node:assert/strict";
import vm from "node:vm";
import { armPacketObservation } from "./lib/hero-packet-observer.mjs";

function fixture() {
  let now = 0,
    visible = false,
    x = 0,
    click,
    removed = false;
  const frames = [];
  const control = {
    addEventListener: (_name, callback) => {
      click = callback;
    },
    removeEventListener: () => {
      removed = true;
    },
  };
  const circle = {
    getAttribute: () => (visible ? "1" : "0"),
    getBoundingClientRect: () => ({ x, y: 0, width: 2, height: 2 }),
  };
  const window = {};
  const context = {
    window,
    performance: { now: () => now },
    document: { querySelectorAll: (selector) => [selector.includes("input") ? control : circle] },
    requestAnimationFrame: (callback) => frames.push(callback),
  };
  vm.runInNewContext(`(${armPacketObservation.toString()})(0)`, context);
  return {
    activate: () => click(),
    frame: (time, shown, left) => {
      now = time;
      visible = shown;
      x = left;
      const callback = frames.shift();
      assert(callback, "Observer must keep sampling");
      callback(time);
    },
    result: window.__heroPacketObservation,
    removed: () => removed,
    frames,
  };
}

const delayed = fixture();
delayed.activate();
delayed.frame(16, true, 0);
delayed.frame(1010, true, 5);
assert.equal(
  delayed.removed(),
  false,
  "A delayed second frame must not end observation before the packet travels",
);
delayed.frame(1100, true, 16);
delayed.frame(1200, false, 20);
const travelled = await delayed.result;
assert.equal(travelled.length, 3);
assert.equal(travelled[2].x - travelled[0].x, 16);
assert.equal(delayed.frames.length, 0);
assert.equal(delayed.removed(), true);

const frozen = fixture();
frozen.activate();
frozen.frame(16, true, 0);
frozen.frame(2000, true, 0);
frozen.frame(4001, true, 0);
const still = await frozen.result;
assert(
  still.every((point) => point.x === still[0].x),
  "A frozen packet must retain zero observed travel",
);
assert.equal(frozen.frames.length, 0);

const missing = fixture();
missing.frame(4001, false, 0);
assert.equal((await missing.result).length, 0);
assert.equal(missing.removed(), true);
console.log(
  "PASS: delayed frames retain packet observation; frozen and absent signals still reach the unchanged deadline with no travel",
);
