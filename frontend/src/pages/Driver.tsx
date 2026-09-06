import type { Trip } from '../types'
import { MapView } from '../components/MapView'
import { TripHeader } from '../components/TripHeader'
import { EventLog } from '../components/EventLog'
import { Empty } from '../components/Empty'
import { JoinBox } from '../components/JoinBox'
import { timeAgo } from '../utils/time'

export function Driver({
  trip,
  action,
  name,
  setName,
  join,
}: {
  trip?: Trip
  action: (a: string) => void
  name: string
  setName: (s: string) => void
  join: () => void
}) {
  if (!trip) return <Empty title="No trip yet" text="Generate a trip from Home, then take the driver's seat." />
  return (
    <section className="page">
      <TripHeader trip={trip} title="Driver console" subtitle="DRIVER VIEW" />
      <div className="grid two">
        <div className="panel map-panel">
          <MapView trip={trip} showPassengers={false} />
          <div className="map-legend">
            <span>
              <i className="dot teal" /> Driver
            </span>
            <span>
              <i className="dot coral" /> Centroid
            </span>
          </div>
        </div>
        <div className="stack">
          <div className="panel welcome">
            <span className="mini-label">WELCOME, DRIVER</span>
            <h3>Keep the journey moving.</h3>
            <p>Your location is shared with the people on this trip. If your signal drops, Safar Setu starts a gentle recovery flow.</p>
            <div className="driver-status">
              <span className={`pulse ${trip.driver.online ? 'on' : ''}`} />
              <b>{trip.driver.online ? 'Location sharing on' : 'Location sharing paused'}</b>
              <small>Last ping {timeAgo(trip.driver.lastSeen)}</small>
            </div>
          </div>
          <div className="panel controls">
            <h3>Trip controls</h3>
            <button className="control-button" onClick={() => action('move')}>
              ⌁ Send location ping <span>Simulate movement</span>
            </button>
            {trip.status === 'grace' || trip.status === 'fallback' ? (
              <>
                <button className="control-button restore" onClick={() => action('restore')}>
                  ↻ Restore my signal <span>Return to driver tracking</span>
                </button>
                {trip.status === 'grace' && (
                  <button className="control-button" onClick={() => action('validate')}>
                    ◎ Validate passenger cluster <span>Use rule + centroid fallback</span>
                  </button>
                )}
              </>
            ) : (
              <button className="control-button danger" onClick={() => action('fail')}>
                ⌁ Simulate signal loss <span>Start recovery flow</span>
              </button>
            )}
            <button className="end-button" onClick={() => action('end')}>
              End trip
            </button>
          </div>
          <JoinBox role="driver" name={name} setName={setName} join={join} />
        </div>
      </div>
      <EventLog events={trip.events} />
    </section>
  )
}
