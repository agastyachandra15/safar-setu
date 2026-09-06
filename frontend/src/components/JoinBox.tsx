export function JoinBox({
  role,
  name,
  setName,
  join,
}: {
  role: 'driver' | 'passenger'
  name: string
  setName: (s: string) => void
  join: () => void
}) {
  return (
    <div className="join-box">
      <div>
        <b>{role === 'driver' ? 'Reconnect as driver' : 'Join this trip'}</b>
        <small>{role === 'driver' ? 'Use your name to reconnect' : 'Add your name to the passenger group'}</small>
      </div>
      <div className="join-form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={role === 'driver' ? 'Your name' : 'Passenger name'} />
        <button onClick={join}>Join</button>
      </div>
    </div>
  )
}
