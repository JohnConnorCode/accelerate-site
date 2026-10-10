// Runs inside the browser. Preserve observations before a slow automation caller
// returns from navigation; never substitute a later settled frame for entry.
export function installHeroMotionObserver() {
  window.__heroEntrances = [];
  window.__heroForward = null;
  let pendingArm;
  const captureFresh = () => {
    const armedAt = window.__heroForwardArmedAt;
    if (
      armedAt == null ||
      pendingArm === armedAt ||
      window.__heroForward ||
      location.pathname !== "/"
    )
      return;
    const hero = document.querySelector(".home-hero.in");
    const word = hero?.querySelector(".home-hero-lead .home-hero-word");
    const animation = word
      ?.getAnimations()
      .find((animation) => animation.animationName === "home-hero-word-enter");
    if (!animation) return;
    pendingArm = armedAt;
    // Retain the first actual state before waiting for the native clock. Even
    // a readiness callback can be delayed past the complete entrance.
    const entry = {
      kind: document.documentElement.dataset.navigationKind,
      animated: getComputedStyle(word).animationName,
      immediate: hero.classList.contains("reveal-immediate"),
      playState: animation.playState,
      currentTime: animation.currentTime,
      endTime: animation.effect.getComputedTiming().endTime,
      action: Number(getComputedStyle(hero.querySelector(".home-hero-actions")).opacity),
      armedAt,
      observedAt: performance.now(),
    };
    void animation.ready.then(() => {
      if (window.__heroForwardArmedAt !== armedAt || window.__heroForward) return;
      window.__heroForward = {
        ...entry,
        immediate: entry.immediate || hero.classList.contains("reveal-immediate"),
        startTime: animation.startTime,
        clockReadyAt: performance.now(),
      };
      window.__heroForwardOnEntry?.();
    });
  };
  const changes = new MutationObserver(captureFresh);
  changes.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "data-reveal-state"],
  });
  document.addEventListener("animationstart", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const hero = target.closest(".home-hero");
    if (!hero) return;
    const phase = target.matches(".home-hero-eyebrow")
      ? "eyebrow"
      : target.matches(".home-hero-lead .home-hero-word")
        ? "lead"
        : target.matches(".home-hero-heading em .home-hero-word")
          ? "outcome"
          : target.matches(".home-hero-support")
            ? "support"
            : target.matches(".home-hero-actions")
              ? "action"
              : target.matches(".home-hero-index > span")
                ? `index-${[...target.parentElement.children].indexOf(target)}`
                : null;
    if (!phase) return;
    const animation = target
      .getAnimations()
      .find((animation) => animation.animationName === event.animationName);
    const timing = animation?.effect?.getComputedTiming();
    // CSS animation events are delivered on the main thread. Their handlers
    // can bunch together even when compositor animation clocks remain staggered.
    const time =
      typeof animation?.startTime === "number" && typeof timing?.delay === "number"
        ? animation.startTime + timing.delay
        : null;
    const observedAt = performance.now();
    window.__heroEntrances.push({ phase, time, observedAt });
  });
}

export function hasPerceptibleHeroSequence(phases) {
  return (
    phases.length > 0 &&
    phases.every(
      (phase, index) =>
        phase &&
        Number.isFinite(phase.time) &&
        (index === 0 || phase.time - phases[index - 1].time >= 30),
    )
  );
}

export function hasFreshHeroEntrance(entrance) {
  return Boolean(
    entrance &&
    entrance.kind === "fresh" &&
    entrance.animated === "home-hero-word-enter" &&
    !entrance.immediate &&
    entrance.playState === "running" &&
    Number.isFinite(entrance.startTime) &&
    entrance.startTime >= entrance.armedAt &&
    Number.isFinite(entrance.currentTime) &&
    Number.isFinite(entrance.endTime) &&
    entrance.currentTime < entrance.endTime,
  );
}
