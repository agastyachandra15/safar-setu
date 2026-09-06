export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty page">
      <span className="empty-icon">↗</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  )
}
