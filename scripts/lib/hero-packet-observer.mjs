/** Serializable page observer. Follow one rendered packet, with a fixed wall
 * deadline for a frozen or absent animation. The artwork caps frame deltas,
 * so a wall-clock sample window alone can end after only two rendered frames. */
export function armPacketObservation(index) {
  window.__heroPacketObservation = new Promise((resolve) => {
    const control = document.querySelectorAll(".home-system-input")[index];
    const circle = document.querySelectorAll(".home-system-signal")[index];
    let deadline = performance.now() + 4000;
    let activated = false;
    let started = false;
    const points = [];
    const activate = () => {
      activated = true;
      deadline = performance.now() + 4000;
    };
    control.addEventListener("click", activate, { once: true });
    const sample = (now) => {
      const visible = circle.getAttribute("opacity") === "1";
      if (activated && visible) {
        started = true;
        const box = circle.getBoundingClientRect();
        points.push({ time: now, x: box.x + box.width / 2, y: box.y + box.height / 2 });
      }
      if (now >= deadline || (started && !visible)) {
        control.removeEventListener("click", activate);
        resolve(points);
      } else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}
