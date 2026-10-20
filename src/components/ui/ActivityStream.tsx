import type { ActivityEvent } from "@/content/home-activity";

/** The brand's signature motif: work as a timestamped stream. Hollow marks are
 * people; filled signal marks are the system acting. See BRAND-SYSTEM.md. */
export function ActivityStream({
  label,
  context,
  events,
}: {
  label: string;
  context: string;
  events: ActivityEvent[];
}) {
  return (
    <figure className="activity-stream" aria-label={label}>
      <figcaption className="activity-stream-head">
        <span>{label}</span>
        <span>{context}</span>
      </figcaption>
      <ol>
        {events.map((event, index) => (
          <li key={index} data-system={event.system ? "" : undefined}>
            <span className="activity-stream-time">{event.time}</span>
            <span className="activity-stream-mark" aria-hidden="true" />
            <span>
              {event.system && <span className="sr-only">System: </span>}
              {event.text}
            </span>
          </li>
        ))}
      </ol>
      <p className="activity-stream-key">
        <span>
          <span className="activity-stream-mark" data-system="" aria-hidden="true" /> The system
        </span>
        <span>
          <span className="activity-stream-mark" aria-hidden="true" /> Your team and customers
        </span>
      </p>
    </figure>
  );
}
