import React, { useEffect, useState } from 'react'
import api from '../api'

export default function AdminDashboard(){
  const [stats, setStats] = useState(null)
  const [tracks, setTracks] = useState([])
  useEffect(() => {
    let mounted = true
    api.get('/admin/dashboard')
      .then(res => { if (mounted && res.data?.success) { setStats(res.data.stats); setTracks(res.data.tracks || []) } })
      .catch(err => console.error('Admin API', err))
    return () => { mounted = false }
  }, [])

  if (!stats) return <p>Loading admin dashboard...</p>
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <pre>{JSON.stringify(stats, null, 2)}</pre>
      <h3>Pending Tracks</h3>
      <ul>{tracks.map(t => <li key={t._id}>{t.title} — {t.artist}</li>)}</ul>
    </div>
  )
}
