import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Role = 'landing' | 'driver' | 'passenger' | 'relative' | 'admin'
type Status = 'active' | 'grace' | 'fallback' | 'restored' | 'ended'
type Point = { lat: number; lng: number }
type Person = { id: string; name: string; role: 'driver' | 'passenger'; location: Point; lastSeen: string; online: boolean; updates: number }
type Event = { id: string; at: string; kind: string; title: string; detail: string }
type Trip = { id: string; shortId: string; name: string; origin: string; destination: string; route: Point[]; status: Status; currentLocation?: Point; trackingSource?: 'driver' | 'passenger-fallback'; lostDriverLocation?: Point; driver: Person; passengers: Person[]; events: Event[]; createdAt: string; demoMode: boolean }

const api = async (path: string, options?: RequestInit) => {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options })
  if (!response.ok) throw new Error((await response.json()).error || 'Request failed')
  return response.json()
}

function MapView({ trip, showPassengers = true }: { trip?: Trip; showPassengers?: boolean }) {
  useEffect(() => {
    const el = document.getElementById('trip-map')
    if (!el || !trip) return
    const currentLocation = trip.currentLocation || trip.driver.location
    const trackingSource = trip.trackingSource || (trip.status === 'fallback' ? 'passenger-fallback' : 'driver')
    const map = L.map(el, {
      zoomControl: false,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    }).setView([19.1, 72.9], 12)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
    const line = L.polyline(trip.route.map((p) => [p.lat, p.lng] as [number, number]), { color: '#f76c5e', weight: 5 }).addTo(map)
    const icon = (color: string, ring = false) => L.divIcon({ className: 'pin', html: `<span style="background:${color};${ring ? 'outline:3px solid #ffffff;box-shadow:0 0 0 2px #f76c5e;' : ''}"></span>`, iconSize: [24, 24], iconAnchor: [12, 12] })
    const sourceColor = trackingSource === 'passenger-fallback' ? '#256879' : '#0d5c63'
    L.marker([currentLocation.lat, currentLocation.lng], { icon: icon(sourceColor) }).addTo(map).bindTooltip(
      trackingSource === 'passenger-fallback' ? 'Passenger cluster centroid (approximate)' : 'Driver location',
      { permanent: false },
    )
    if (trip.lostDriverLocation && !trip.driver.online) {
      L.marker([trip.lostDriverLocation.lat, trip.lostDriverLocation.lng], { icon: icon('#f76c5e', true) })
        .addTo(map)
        .bindTooltip('Driver lost connection here', { permanent: false })
    }
    if (showPassengers) {
      trip.passengers.forEach((p) => L.marker([p.location.lat, p.location.lng], { icon: icon('#f76c5e') }).addTo(map).bindTooltip(p.name))
    }
    map.fitBounds(line.getBounds(), { padding: [20, 20] })
    return () => {
      map.stop()
      map.off()
      if (map.getContainer()) map.remove()
    }
  }, [trip, showPassengers])
  return <div id="trip-map" className="map" />
}

function Badge({ status }: { status: Status }) {
  const labels: Record<Status, string> = { active: 'Driver live', grace: 'Grace period', fallback: 'Passenger-assisted', restored: 'Driver restored', ended: 'Ended' }
  return <span className={`badge ${status}`}>{labels[status]}</span>
}

function App() {
  const [role, setRole] = useState<Role>('landing')
  const [trips, setTrips] = useState<Trip[]>([])
  const [selected, setSelected] = useState<string>()
  const [name, setName] = useState('')
  const [tripCode, setTripCode] = useState('')
  const [error, setError] = useState('')
  const trip = trips.find((item) => item.id === selected) || trips[0]

  const refresh = () => api('/api/state').then((data) => setTrips(data.trips)).catch((e) => setError(e.message))
  useEffect(() => {
    refresh()
    const socket = io()
    socket.on('state', (data: { trips: Trip[] }) => setTrips(data.trips))
    return () => { socket.disconnect() }
  }, [])
  useEffect(() => { if (trip) setSelected(trip.id) }, [trip?.id])

  const act = async (action: string) => {
    if (!trip) return
    try { await api(`/api/trips/${trip.id}/action`, { method: 'POST', body: JSON.stringify({ action }) }); await refresh() }
    catch (e) { setError((e as Error).message) }
  }
  const create = async (demoMode = false) => {
    try {
      const data = await api('/api/trips', { method: 'POST', body: JSON.stringify({ demoMode }) })
      setTrips((current) => [data.trip, ...current]); setSelected(data.trip.id)
      if (demoMode) setRole('driver')
    } catch (e) { setError((e as Error).message) }
  }
  const join = async () => {
    if (!trip) return
    try {
      const data = await api(`/api/trips/${trip.id}/join`, { method: 'POST', body: JSON.stringify({ name: name || undefined, role: role === 'driver' ? 'driver' : 'passenger' }) })
      setTrips((current) => current.map((item) => item.id === trip.id ? data.trip : item)); setName('')
    } catch (e) { setError((e as Error).message) }
  }

  const nav = [
    ['landing', '⌂', 'Home'], ['driver', '◉', 'Driver'], ['passenger', '↗', 'Passenger'],
    ['relative', '◌', 'Track someone'], ['admin', '▦', 'Admin']
  ] as [Role, string, string][]
  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setRole('landing')}><span className="brand-mark">↗</span><span>Safar <b>Setu</b><small>connected journeys</small></span></button>
      <div className="top-actions"><span className="connection"><i /> Realtime connected</span><button className="demo-button" onClick={() => create(true)}>▶ Run demo</button></div>
    </header>
    <div className="layout">
      <aside className="sidebar">{nav.map(([key, icon, label]) => <button key={key} className={role === key ? 'nav-item active' : 'nav-item'} onClick={() => setRole(key)}><span>{icon}</span>{label}</button>)}</aside>
      <main className="content">
        {error && <div className="error" onClick={() => setError('')}>{error} ×</div>}
        {role === 'landing' && <Landing create={create} setRole={setRole} />}
        {role === 'driver' && <Driver trip={trip} action={act} name={name} setName={setName} join={join} />}
        {role === 'passenger' && <Passenger trip={trip} action={act} name={name} setName={setName} join={join} tripCode={tripCode} setTripCode={setTripCode} selectTrip={(code) => { const match = trips.find((item) => item.shortId.toLowerCase() === code.trim().toLowerCase()); if (match) { setSelected(match.id); setError('') } else setError('No active trip matches that Trip ID') }} />}
        {role === 'relative' && <Relative trip={trip} />}
        {role === 'admin' && <Admin trips={trips} selected={selected} setSelected={setSelected} create={create} />}
      </main>
    </div>
  </div>
}

function Landing({ create, setRole }: { create: (demo?: boolean) => void; setRole: (role: Role) => void }) {
  return <section className="landing page">
    <div className="hero-copy"><span className="eyebrow">SAFETY, TOGETHER</span><h1>Every journey has<br /><em>a safety net.</em></h1><p>Safar Setu keeps drivers, passengers and families connected — even when a signal disappears.</p><div className="hero-actions"><button className="primary" onClick={() => create(false)}>＋ Generate a trip</button><button className="secondary" onClick={() => create(true)}>▶ Try the live demo</button></div><div className="trust-row"><span>● Encrypted check-ins</span><span>● Rule-based recovery</span><span>● OpenStreetMap powered</span></div></div>
    <div className="hero-card"><div className="signal-art"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-pin">↗</div><span className="spark s1">✦</span><span className="spark s2">✦</span><span className="spark s3">✦</span></div><div className="hero-card-copy"><span className="mini-label">THE SAFAR SETU PROMISE</span><h3>Lost signal?<br /><strong>Never lost.</strong></h3><p>Smart recovery finds the journey's people and brings everyone home.</p><button onClick={() => setRole('relative')}>How it works →</button></div></div>
  </section>
}

function TripHeader({ trip, title, subtitle }: { trip?: Trip; title: string; subtitle: string }) {
  return <div className="section-head"><div><span className="eyebrow">{subtitle}</span><h2>{title}</h2></div>{trip && <div className="trip-chip"><span>TRIP</span><b>{trip.shortId}</b><Badge status={trip.status} /></div>}</div>
}

function Driver({ trip, action, name, setName, join }: { trip?: Trip; action: (a: string) => void; name: string; setName: (s: string) => void; join: () => void }) {
  if (!trip) return <Empty title="No trip yet" text="Generate a trip from Home, then take the driver's seat." />
  return <section className="page"><TripHeader trip={trip} title="Driver console" subtitle="DRIVER VIEW" /><div className="grid two"><div className="panel map-panel"><MapView trip={trip} /><div className="map-legend"><span><i className="dot teal" /> Driver</span><span><i className="dot coral" /> Passenger</span></div></div><div className="stack"><div className="panel welcome"><span className="mini-label">WELCOME, DRIVER</span><h3>Keep the journey moving.</h3><p>Your location is shared with the people on this trip. If your signal drops, Safar Setu starts a gentle recovery flow.</p><div className="driver-status"><span className={`pulse ${trip.driver.online ? 'on' : ''}`} /><b>{trip.driver.online ? 'Location sharing on' : 'Location sharing paused'}</b><small>Last ping {timeAgo(trip.driver.lastSeen)}</small></div></div><div className="panel controls"><h3>Trip controls</h3><button className="control-button" onClick={() => action('move')}>⌁ Send location ping <span>Simulate movement</span></button>{trip.status === 'grace' || trip.status === 'fallback' ? <><button className="control-button restore" onClick={() => action('restore')}>↻ Restore my signal <span>Return to driver tracking</span></button>{trip.status === 'grace' && <button className="control-button" onClick={() => action('validate')}>◎ Validate passenger cluster <span>Use rule + centroid fallback</span></button>}</> : <button className="control-button danger" onClick={() => action('fail')}>⌁ Simulate signal loss <span>Start recovery flow</span></button>}<button className="end-button" onClick={() => action('end')}>End trip</button></div><JoinBox role="driver" name={name} setName={setName} join={join} /></div></div><EventLog events={trip.events} /></section>
}

function Passenger({ trip, action, name, setName, join, tripCode, setTripCode, selectTrip }: { trip?: Trip; action: (a: string) => void; name: string; setName: (s: string) => void; join: () => void; tripCode: string; setTripCode: (s: string) => void; selectTrip: (code: string) => void }) {
  if (!trip) return <Empty title="Choose a trip" text="Generate a trip first, then join as a passenger." />
  const mine = trip.passengers[trip.passengers.length - 1]
  return <section className="page"><TripHeader trip={trip} title="Passenger check-in" subtitle="PASSENGER VIEW" /><div className="join-box trip-code-box"><b>Join by Trip ID</b><small>Ask the driver for the code shown on their dashboard.</small><div className="join-form"><input value={tripCode} onChange={(event) => setTripCode(event.target.value)} placeholder="Example: A514A0" /><button onClick={() => selectTrip(tripCode)}>Find trip</button></div></div><div className="grid two"><div className="panel map-panel"><MapView trip={trip} /></div><div className="stack"><div className="panel checkin"><span className="eyebrow">TRIP {trip.shortId}</span><h3>You're on the list.</h3><p>Share your check-in so the driver and trusted contacts know you are travelling together.</p><div className="people">{trip.passengers.map((p) => <div className="person" key={p.id}><span className="avatar">{p.name[0]}</span><span><b>{p.name}</b><small>{p.online ? 'Checked in' : 'Offline'}</small></span><i className="online-dot" /></div>)}</div>{!mine && <JoinBox role="passenger" name={name} setName={setName} join={join} />}</div><div className="panel safety"><span className="safety-icon">✓</span><div><b>Safety check-ins are active</b><p>If something changes, your group becomes a trusted signal for recovery.</p></div></div><button className="primary wide" onClick={() => action('move')}>Send a check-in ping</button></div></div><EventLog events={trip.events} /></section>
}

function Relative({ trip }: { trip?: Trip }) {
  if (!trip) return <Empty title="No one to track yet" text="Use the demo button to create a live journey, then come back here." />
  return <section className="page"><TripHeader trip={trip} title="Track a journey" subtitle="TRUSTED CONTACT VIEW" /><div className="relative-grid"><div className="panel map-panel large"><MapView trip={trip} showPassengers={false} /><div className="map-footer"><div><span className={`pulse ${trip.status !== 'grace' ? 'on' : ''}`} /> <b>{trip.status === 'grace' ? 'Checking the last known location' : trip.status === 'fallback' ? 'Passenger-assisted location (approximate)' : 'Journey is moving safely'}</b><small>{trip.origin} → {trip.destination}</small></div><Badge status={trip.status} /></div></div><div className="stack"><div className="panel journey-card"><div className="journey-row"><span className="route-dot start" /><div><small>STARTED FROM</small><b>{trip.origin}</b></div></div><div className="route-line" /><div className="journey-row"><span className="route-dot end" /><div><small>HEADING TO</small><b>{trip.destination}</b></div></div><div className="eta">⌁ <span>Estimated arrival</span><b>10:42 AM</b></div></div>{(trip.status === 'grace' || trip.status === 'fallback') && <div className="panel alert-card"><span>!</span><div><b>{trip.status === 'fallback' ? 'Passenger-assisted tracking' : "We're checking in"}</b><p>{trip.status === 'fallback' ? 'The map shows an approximate centroid of consistent passengers on this trip.' : "The driver's signal paused. Passengers are helping us verify this trip."}</p></div></div>}<div className="panel people-card"><span className="mini-label">PASSENGERS CHECKED IN · {trip.passengers.length}</span><p className="muted">Individual passenger locations are kept private. Their combined check-ins help verify the approximate bus location.</p></div></div></div><EventLog events={trip.events} /></section>
}

function Admin({ trips, selected, setSelected, create }: { trips: Trip[]; selected?: string; setSelected: (s: string) => void; create: (demo?: boolean) => void }) {
  const counts = useMemo(() => ({ active: trips.filter((t) => t.status === 'active' || t.status === 'restored').length, grace: trips.filter((t) => t.status === 'grace' || t.status === 'fallback').length, ended: trips.filter((t) => t.status === 'ended').length }), [trips])
  return <section className="page"><TripHeader title="Operations room" subtitle="ADMIN OVERVIEW" /><div className="stats"><div><small>ACTIVE TRIPS</small><b>{counts.active}</b><span className="stat-up">↑ Live</span></div><div><small>IN GRACE PERIOD</small><b>{counts.grace}</b><span>Needs attention</span></div><div><small>ENDED TODAY</small><b>{counts.ended}</b><span>All clear</span></div></div><div className="admin-grid"><div className="panel table-panel"><div className="panel-title"><h3>Trip monitor</h3><button className="text-button" onClick={() => create(true)}>＋ New demo</button></div>{trips.length === 0 ? <p className="muted">No trips yet.</p> : trips.map((item) => <button className={`trip-row ${item.id === selected ? 'selected' : ''}`} key={item.id} onClick={() => setSelected(item.id)}><span className="trip-id">{item.shortId}</span><span><b>{item.name}</b><small>{item.origin} → {item.destination}</small></span><Badge status={item.status} /><span className="row-arrow">›</span></button>)}</div><div className="panel admin-help"><span className="mini-label">RECOVERY PLAYBOOK</span><h3>When a driver goes quiet</h3><ol><li><b>Grace period</b><span>Wait for a natural reconnection.</span></li><li><b>Cluster validation</b><span>Use same-trip passenger pings.</span></li><li><b>Centroid fallback</b><span>Show the safest last-known estimate.</span></li></ol></div></div></section>
}

function JoinBox({ role, name, setName, join }: { role: 'driver' | 'passenger'; name: string; setName: (s: string) => void; join: () => void }) {
  return <div className="join-box"><div><b>{role === 'driver' ? 'Reconnect as driver' : 'Join this trip'}</b><small>{role === 'driver' ? 'Use your name to reconnect' : 'Add your name to the passenger group'}</small></div><div className="join-form"><input value={name} onChange={(e) => setName(e.target.value)} placeholder={role === 'driver' ? 'Your name' : 'Passenger name'} /><button onClick={join}>Join</button></div></div>
}
function EventLog({ events }: { events: Event[] }) {
  return <div className="event-log"><div className="panel-title"><h3>Event log</h3><span className="live-label"><i /> Live updates</span></div>{events.slice(0, 5).map((event) => <div className="event" key={event.id}><span className={`event-icon ${event.kind}`}>{event.kind === 'alert' ? '!' : event.kind === 'validation' ? '✓' : '•'}</span><div><b>{event.title}</b><p>{event.detail}</p></div><time>{timeAgo(event.at)}</time></div>)}</div>
}
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty page"><span className="empty-icon">↗</span><h2>{title}</h2><p>{text}</p></div> }
function timeAgo(value: string) { const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000)); return seconds < 5 ? 'just now' : seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago` }

export default App
