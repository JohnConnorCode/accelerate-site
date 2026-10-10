import assert from "node:assert/strict";
import { mock } from "node:test";
import { dismiss, pauseToasts, resumeToasts, toast } from "../src/lib/admin/useToast";

let now = 1000;
const scheduled: { callback: () => void; delay: number; handle: ReturnType<typeof setTimeout> }[] =
  [];
const cleared: unknown[] = [];
mock.method(performance, "now", () => now);
mock.method(globalThis, "setTimeout", (callback: () => void, delay: number) => {
  const handle = { id: scheduled.length } as unknown as ReturnType<typeof setTimeout>;
  scheduled.push({ callback, delay, handle });
  return handle;
});
mock.method(globalThis, "clearTimeout", (handle: unknown) => cleared.push(handle));
const ids: string[] = [];
try {
  ids.push(toast.success("Saved", 5000));
  const firstTimer = scheduled[0];
  assert.ok(firstTimer, "A new timed message must schedule its expiry");
  now = 2400;
  pauseToasts();
  assert.equal(cleared.at(-1), firstTimer.handle);
  pauseToasts();
  const warningId = toast.error("Read this while feedback is paused", 7000);
  ids.push(warningId);
  assert.equal(scheduled.length, 1, "New feedback must also wait while the reader is interacting");
  now = 12000;
  resumeToasts();
  assert.deepEqual(
    scheduled.slice(1).map((timer) => timer.delay),
    [3600, 7000],
  );
  resumeToasts();
  assert.equal(scheduled.length, 3, "Resuming twice must not create duplicate expiry timers");
  now = 12500;
  pauseToasts();
  dismiss(warningId);
  now = 20000;
  resumeToasts();
  assert.equal(
    scheduled.at(-1)?.delay,
    3100,
    "Only unread time should remain after repeated pauses",
  );
  assert.equal(scheduled.length, 4, "A dismissed message must not be scheduled again");
  scheduled.at(-1)?.callback();
  pauseToasts();
  ids.push(toast.info("Persistent feedback", 0));
  resumeToasts();
  assert.equal(scheduled.length, 4, "Expired and persistent messages must have no running timer");
  console.log(
    "Toast timing passed: remaining time, new messages while paused, repeated pause/resume, dismissal, expiry and persistence.",
  );
} finally {
  for (const id of ids) dismiss(id);
  resumeToasts();
  mock.restoreAll();
}
