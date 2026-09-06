import type { Trip } from '../types'
import { MapView } from '../components/MapView'
import { TripHeader } from '../components/TripHeader'
import { EventLog } from '../components/EventLog'
import { Empty } from '../components/Empty'
import { Badge } from '../components/Badge'

export function Relative({ trip }: { trip?: Trip }) {
  if (!trip) return <Empty title="No one to track yet" text="Use the demo button to create a live journey, then come back here." />
  return (
    <section className="page">
      <TripHeader trip={trip} title="Track a journey" subtitle="TRUSTED CONTACT VIEW" />
      <div className="relative-grid">
        <div className="panel map-panel large">
          <MapView trip={trip} showPassengers={false} />
          <div className="map-footer">
            <div>
              <span className={`pulse ${trip.status !== 'grace' ? 'on' : ''}`} />{' '}
              <b>
                {trip.status === 'grace'
                  ? 'Checking the last known location'
                  : trip.status === 'fallback'
                    ? 'Passenger-assisted location (approximate)'
                    : 'Journey is moving safely'}
              </b>
              <small>
                {trip.origin} → {trip.destination}
              </small>
            </div>
            <Badge status={trip.status} />
          </div>
        </div>
        <div className="stack">
          <div className="panel journey-card">
            <div className="journey-row">
              <span className="route-dot start" />
              <div>
                <small>STARTED FROM</small>
                <b>{trip.origin}</b>
              </div>
            </div>
            <div className="route-line" />
            <div className="journey-row">
              <span className="route-dot end" />
              <div>
                <small>HEADING TO</small>
                <b>{trip.destination}</b>
              </div>
            </div>
            <div className="eta">
              ⌁ <span>Estimated arrival</span>
              <b>10:42 AM</b>
            </div>
          </div>
          {(trip.status === 'grace' || trip.status === 'fallback') && (
            <div className="panel alert-card">
              <span>!</span>
              <div>
                <b>{trip.status === 'fallback' ? 'Passenger-assisted tracking' : "We're checking in"}</b>
                <p>
                  {trip.status === 'fallback'
                    ? 'The map shows an approximate centroid of consistent passengers on this trip.'
                    : "The driver's signal paused. Passengers are helping us verify this trip."}
                </p>
              </div>
            </div>
          )}
          <div className="panel people-card">
            <span className="mini-label">PASSENGERS CHECKED IN · {trip.passengers.length}</span>
            <p className="muted">Individual passenger locations are kept private. Their combined check-ins help verify the approximate bus location.</p>
          </div>
        </div>
      </div>
      <EventLog events={trip.events} />
    </section>
  )
}
