import React, { useEffect, useState } from 'react'
import api from '../api'
import { Link } from 'react-router-dom'

export default function Likes(){
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api.get('/likes')
      .then(res => { if (mounted && res.data?.success) setTracks(res.data.tracks || []) })
      .catch(err => console.error('Likes API', err))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  if (loading) return <p>Loading...</p>
  return <div>
    <h1>Liked Tracks</h1>
    <ul>
      {tracks.map(t => <li key={t._id}>
        <Link to={`/track/${t._id}`}>{t.title} — {t.artist}</Link>
        <button style={{marginLeft:8}} onClick={async ()=>{
          try { await api.post(`/tracks/${t._id}/unlike`); setTracks(tracks.filter(x=>x._id!==t._id)) } catch(e){console.error(e)}
        }}>Remove</button>
      </li>)}
    </ul>
  </div>
}
