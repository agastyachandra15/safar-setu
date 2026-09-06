import { useMemo } from 'react'
import type { Trip } from '../types'
import { TripHeader } from '../components/TripHeader'
import { Badge } from '../components/Badge'

export function Admin({
  trips,
  selected,
  setSelected,
  create,
}: {
  trips: Trip[]
  selected?: string
  setSelected: (s: string) => void
  create: (demo?: boolean) => void
}) {
  const counts = useMemo(
    () => ({
      active: trips.filter((t) => t.status === 'active' || t.status === 'restored').length,
      grace: trips.filter((t) => t.status === 'grace' || t.status === 'fallback').length,
      ended: trips.filter((t) => t.status === 'ended').length,
    }),
    [trips],
  )
  return (
    <section className="page">
      <TripHeader title="Operations room" subtitle="ADMIN OVERVIEW" />
      <div className="stats">
        <div>
          <small>ACTIVE TRIPS</small>
          <b>{counts.active}</b>
          <span className="stat-up">↑ Live</span>
        </div>
        <div>
          <small>IN GRACE PERIOD</small>
          <b>{counts.grace}</b>
          <span>Needs attention</span>
        </div>
        <div>
          <small>ENDED TODAY</small>
          <b>{counts.ended}</b>
          <span>All clear</span>
        </div>
      </div>
      <div className="admin-grid">
        <div className="panel table-panel">
          <div className="panel-title">
            <h3>Trip monitor</h3>
            <button className="text-button" onClick={() => create(true)}>
              ＋ New demo
            </button>
          </div>
          {trips.length === 0 ? (
            <p className="muted">No trips yet.</p>
          ) : (
            trips.map((item) => (
              <button className={`trip-row ${item.id === selected ? 'selected' : ''}`} key={item.id} onClick={() => setSelected(item.id)}>
                <span className="trip-id">{item.shortId}</span>
                <span>
                  <b>{item.name}</b>
                  <small>
                    {item.origin} → {item.destination}
                  </small>
                </span>
                <Badge status={item.status} />
                <span className="row-arrow">›</span>
              </button>
            ))
          )}
        </div>
        <div className="panel admin-help">
          <span className="mini-label">RECOVERY PLAYBOOK</span>
          <h3>When a driver goes quiet</h3>
          <ol>
            <li>
              <b>Grace period</b>
              <span>Wait for a natural reconnection.</span>
            </li>
            <li>
              <b>Cluster validation</b>
              <span>Use same-trip passenger pings.</span>
            </li>
            <li>
              <b>Centroid fallback</b>
              <span>Show the safest last-known estimate.</span>
            </li>
          </ol>
        </div>
      </div>
    </section>
  )
}
