import type { Role } from '../types'

export function Landing({ create, setRole }: { create: (demo?: boolean) => void; setRole: (role: Role) => void }) {
  return (
    <section className="landing page">
      <div className="hero-copy">
        <span className="eyebrow">SAFETY, TOGETHER</span>
        <h1>
          Every journey has
          <br />
          <em>a safety net.</em>
        </h1>
        <p>Safar Setu keeps drivers, passengers and families connected — even when a signal disappears.</p>
        <div className="hero-actions">
          <button className="primary" onClick={() => create(false)}>
            ＋ Generate a trip
          </button>
          <button className="secondary" onClick={() => create(true)}>
            ▶ Try the live demo
          </button>
        </div>
        <div className="trust-row">
          <span>● Encrypted check-ins</span>
          <span>● Rule-based recovery</span>
          <span>● OpenStreetMap powered</span>
        </div>
      </div>
      <div className="hero-card">
        <div className="signal-art">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-pin">↗</div>
          <span className="spark s1">✦</span>
          <span className="spark s2">✦</span>
          <span className="spark s3">✦</span>
        </div>
        <div className="hero-card-copy">
          <span className="mini-label">THE SAFAR SETU PROMISE</span>
          <h3>
            Lost signal?
            <br />
            <strong>Never lost.</strong>
          </h3>
          <p>Smart recovery finds the journey's people and brings everyone home.</p>
          <button onClick={() => setRole('relative')}>How it works →</button>
        </div>
      </div>
    </section>
  )
}
