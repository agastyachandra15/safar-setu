import type { Trip } from '../types'
import { Badge } from './Badge'

export function TripHeader({ trip, title, subtitle }: { trip?: Trip; title: string; subtitle: string }) {
  return (
    <div className="section-head">
      <div>
        <span className="eyebrow">{subtitle}</span>
        <h2>{title}</h2>
      </div>
      {trip && (
        <div className="trip-chip">
          <span>TRIP</span>
          <b>{trip.shortId}</b>
          <Badge status={trip.status} />
        </div>
      )}
    </div>
  )
}
