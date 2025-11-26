import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'

export default function PlaylistDetail(){
  const { id } = useParams()
  const [playlist, setPlaylist] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api.get(`/playlists/${id}`)
      .then(res => {
        if (mounted && res.data?.success) setPlaylist(res.data.playlist)
      })
      .catch(err => console.error('Playlist API error', err))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [id])

  if (loading) return <p>Loading...</p>
  if (!playlist) return <p>Playlist not found.</p>

  return (
    <div>
      <h1>{playlist.name}</h1>
      <p>{playlist.description}</p>

      <h3>Tracks</h3>
      {(!playlist.tracks || playlist.tracks.length === 0) && <p>No tracks.</p>}
      <ul>
        {(playlist.tracks || []).map(t => (
          <li key={t._id}>
            <Link to={`/track/${t._id}`}>{t.title} — {t.artist}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
