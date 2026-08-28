# Admin visual contract

## Capability icons

- Icons identify the object or action in front of the operator. Replies use
  communication icons, approvals use review or shield icons, records use their
  domain icon, and status uses status iconography.
- `Bot`, sparkle, or wand marks are reserved for an explicit AI entry point or
  an action that directly starts model work. They are not decoration and must
  not repeat across queue rows, approvals, notifications, or prompt chips.
- A surface that is already titled AI Workspace needs at most one AI identity
  mark. Child navigation and evidence cards describe their own function.

## Motion and loading

- Next.js owns route prefetching and Suspense. The shared admin fallback owns
  loading geometry. The committed route tree owns the single entrance sequence.
- Fast prefetched navigation should not manufacture a loading state. Slow
  navigation must never leave an empty application frame.
- Reduced motion removes blur, translation, and breathing without changing
  route, focus, or loading semantics.
