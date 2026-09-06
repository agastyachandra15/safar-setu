import type { Status } from '../types'

export function Badge({ status }: { status: Status }) {
  const labels: Record<Status, string> = {
    active: 'Driver live',
    grace: 'Grace period',
    fallback: 'Passenger-assisted',
    restored: 'Driver restored',
    ended: 'Ended',
  }
  return <span className={`badge ${status}`}>{labels[status]}</span>
}
