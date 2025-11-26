import React, { useEffect, useState } from 'react'
import api from '../api'
import { Link } from 'react-router-dom'

export default function Home(){
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api.get('/home')
      .then(res => {
        if (mounted && res.data?.success) setTracks(res.data.tracks || [])
      })
      .catch(err => console.error('Home API error', err))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  if (loading) return <p>Loading...</p>

  return (
    <div>
      <h1>Latest Tracks</h1>
      {tracks.length === 0 && <p>No tracks found.</p>}
      <ul>
        {tracks.map(t => (
          <li key={t._id}>
            <Link to={`/track/${t._id}`}>{t.title} — {t.artist}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
