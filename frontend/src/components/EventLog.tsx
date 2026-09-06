import type { TripEvent } from '../types'
import { timeAgo } from '../utils/time'

export function EventLog({ events }: { events: TripEvent[] }) {
  return (
    <div className="event-log">
      <div className="panel-title">
        <h3>Event log</h3>
        <span className="live-label">
          <i /> Live updates
        </span>
      </div>
      {events.slice(0, 5).map((event) => (
        <div className="event" key={event.id}>
          <span className={`event-icon ${event.kind}`}>{event.kind === 'alert' ? '!' : event.kind === 'validation' ? '✓' : '•'}</span>
          <div>
            <b>{event.title}</b>
            <p>{event.detail}</p>
          </div>
          <time>{timeAgo(event.at)}</time>
        </div>
      ))}
    </div>
  )
}
