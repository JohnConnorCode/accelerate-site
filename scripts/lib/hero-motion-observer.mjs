// Runs inside the browser. Preserve observations before a slow automation caller
// returns from navigation; never substitute a later settled frame for entry.
export function installHeroMotionObserver() {
  window.__heroEntrances = [];
  window.__heroForward = null;
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
    if (
      phase === "lead" &&
      window.__heroForwardArmedAt != null &&
      !window.__heroForward &&
      location.pathname === "/"
    ) {
      window.__heroForward = {
        kind: document.documentElement.dataset.navigationKind,
        animated: getComputedStyle(target).animationName,
        immediate: hero.classList.contains("reveal-immediate"),
        playState: animation?.playState,
        currentTime: animation?.currentTime,
        endTime: timing?.endTime,
        action: Number(getComputedStyle(hero.querySelector(".home-hero-actions")).opacity),
        startTime: animation?.startTime,
        armedAt: window.__heroForwardArmedAt,
        observedAt,
      };
      window.__heroForwardOnEntry?.();
    }
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
