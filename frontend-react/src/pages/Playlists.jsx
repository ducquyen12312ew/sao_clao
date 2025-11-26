import React, { useEffect, useState } from 'react'
import api from '../api'
import { Link } from 'react-router-dom'

export default function Playlists(){
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api.get('/playlists')
      .then(res => {
        if (mounted && res.data?.success) setPlaylists(res.data.playlists || [])
      })
      .catch(err => console.error('Playlists API error', err))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  if (loading) return <p>Loading...</p>

  return (
    <div>
      <h1>Your Playlists</h1>
      {playlists.length === 0 && <p>No playlists yet.</p>}
      <ul>
        {playlists.map(p => (
          <li key={p._id}><Link to={`/playlist/${p._id}`}>{p.name}</Link></li>
        ))}
      </ul>
    </div>
  )
}
