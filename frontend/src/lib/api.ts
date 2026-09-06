export const api = async (path: string, options?: RequestInit) => {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options })
  if (!response.ok) throw new Error((await response.json()).error || 'Request failed')
  return response.json()
}
