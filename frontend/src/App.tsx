import { useEffect, useState } from 'react'
import { api } from './lib/api'
import { useTrips } from './hooks/useTrips'
import type { Role } from './types'
import { Landing } from './pages/Landing'
import { Driver } from './pages/Driver'
import { Passenger } from './pages/Passenger'
import { Relative } from './pages/Relative'
import { Admin } from './pages/Admin'

function App() {
  const [role, setRole] = useState<Role>('landing')
  const { trips, setTrips, error, setError, refresh } = useTrips()
  const [selected, setSelected] = useState<string>()
  const [name, setName] = useState('')
  const [tripCode, setTripCode] = useState('')
  const trip = trips.find((item) => item.id === selected) || trips[0]

  useEffect(() => {
    if (trip) setSelected(trip.id)
  }, [trip?.id])

  const act = async (action: string) => {
    if (!trip) return
    try {
      await api(`/api/trips/${trip.id}/action`, { method: 'POST', body: JSON.stringify({ action }) })
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const create = async (demoMode = false) => {
    try {
      const data = await api('/api/trips', { method: 'POST', body: JSON.stringify({ demoMode }) })
      setTrips((current) => [data.trip, ...current])
      setSelected(data.trip.id)
      if (demoMode) setRole('driver')
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const join = async () => {
    if (!trip) return
    try {
      const data = await api(`/api/trips/${trip.id}/join`, {
        method: 'POST',
        body: JSON.stringify({ name: name || undefined, role: role === 'driver' ? 'driver' : 'passenger' }),
      })
      setTrips((current) => current.map((item) => (item.id === trip.id ? data.trip : item)))
      setName('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const nav = [
    ['landing', '⌂', 'Home'],
    ['driver', '◉', 'Driver'],
    ['passenger', '↗', 'Passenger'],
    ['relative', '◌', 'Track someone'],
    ['admin', '▦', 'Admin'],
  ] as [Role, string, string][]

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setRole('landing')}>
          <span className="brand-mark">↗</span>
          <span>
            Safar <b>Setu</b>
            <small>connected journeys</small>
          </span>
        </button>
        <div className="top-actions">
          <span className="connection">
            <i /> Realtime connected
          </span>
          <button className="demo-button" onClick={() => create(true)}>
            ▶ Run demo
          </button>
        </div>
      </header>
      <div className="layout">
        <aside className="sidebar">
          {nav.map(([key, icon, label]) => (
            <button key={key} className={role === key ? 'nav-item active' : 'nav-item'} onClick={() => setRole(key)}>
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </aside>
        <main className="content">
          {error && (
            <div className="error" onClick={() => setError('')}>
              {error} ×
            </div>
          )}
          {role === 'landing' && <Landing create={create} setRole={setRole} />}
          {role === 'driver' && <Driver trip={trip} action={act} name={name} setName={setName} join={join} />}
          {role === 'passenger' && (
            <Passenger
              trip={trip}
              action={act}
              name={name}
              setName={setName}
              join={join}
              tripCode={tripCode}
              setTripCode={setTripCode}
              selectTrip={(code) => {
                const match = trips.find((item) => item.shortId.toLowerCase() === code.trim().toLowerCase())
                if (match) {
                  setSelected(match.id)
                  setError('')
                } else setError('No active trip matches that Trip ID')
              }}
            />
          )}
          {role === 'relative' && <Relative trip={trip} />}
          {role === 'admin' && <Admin trips={trips} selected={selected} setSelected={setSelected} create={create} />}
        </main>
      </div>
    </div>
  )
}

export default App
