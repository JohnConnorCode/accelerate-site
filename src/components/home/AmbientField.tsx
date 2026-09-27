/** Decorative depth uses CSS scroll progress and keeps its existing idle drift. */
export function AmbientField() {
  return (
    <div className="ambient-field" aria-hidden="true">
      <div className="ambient-drift ambient-drift--1">
        <div className="ambient-blob ambient-blob--1 atmo-a" />
      </div>
      <div className="ambient-drift ambient-drift--2">
        <div className="ambient-blob ambient-blob--2 atmo-b" />
      </div>
    </div>
  );
}
