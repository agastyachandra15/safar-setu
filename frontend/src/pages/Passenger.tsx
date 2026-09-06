import type { Trip } from '../types'
import { MapView } from '../components/MapView'
import { TripHeader } from '../components/TripHeader'
import { EventLog } from '../components/EventLog'
import { Empty } from '../components/Empty'
import { JoinBox } from '../components/JoinBox'

export function Passenger({
  trip,
  action,
  name,
  setName,
  join,
  tripCode,
  setTripCode,
  selectTrip,
}: {
  trip?: Trip
  action: (a: string) => void
  name: string
  setName: (s: string) => void
  join: () => void
  tripCode: string
  setTripCode: (s: string) => void
  selectTrip: (code: string) => void
}) {
  if (!trip) return <Empty title="Choose a trip" text="Generate a trip first, then join as a passenger." />
  const mine = trip.passengers[trip.passengers.length - 1]
  return (
    <section className="page">
      <TripHeader trip={trip} title="Passenger check-in" subtitle="PASSENGER VIEW" />
      <div className="join-box trip-code-box">
        <b>Join by Trip ID</b>
        <small>Ask the driver for the code shown on their dashboard.</small>
        <div className="join-form">
          <input value={tripCode} onChange={(event) => setTripCode(event.target.value)} placeholder="Example: A514A0" />
          <button onClick={() => selectTrip(tripCode)}>Find trip</button>
        </div>
      </div>
      <div className="grid two">
        <div className="panel map-panel">
          <MapView trip={trip} />
        </div>
        <div className="stack">
          <div className="panel checkin">
            <span className="eyebrow">TRIP {trip.shortId}</span>
            <h3>You're on the list.</h3>
            <p>Share your check-in so the driver and trusted contacts know you are travelling together.</p>
            <div className="people">
              {trip.passengers.map((p) => (
                <div className="person" key={p.id}>
                  <span className="avatar">{p.name[0]}</span>
                  <span>
                    <b>{p.name}</b>
                    <small>{p.online ? 'Checked in' : 'Offline'}</small>
                  </span>
                  <i className="online-dot" />
                </div>
              ))}
            </div>
            {!mine && <JoinBox role="passenger" name={name} setName={setName} join={join} />}
          </div>
          <div className="panel safety">
            <span className="safety-icon">✓</span>
            <div>
              <b>Safety check-ins are active</b>
              <p>If something changes, your group becomes a trusted signal for recovery.</p>
            </div>
          </div>
          <button className="primary wide" onClick={() => action('move')}>
            Send a check-in ping
          </button>
        </div>
      </div>
      <EventLog events={trip.events} />
    </section>
  )
}
