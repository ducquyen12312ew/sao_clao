import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'

export default function UserProfile(){
  const { username } = useParams()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api.get(`/users/${username}`)
      .then(res => { if (mounted && res.data?.success) setProfile(res.data) })
      .catch(err => console.error('User API', err))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [username])

  if (loading) return <p>Loading...</p>
  if (!profile) return <p>User not found</p>

  const { profileUser, tracks, playlists, totalPlays, totalLikes } = profile

  return (
    <div>
      <h1>{profileUser.name} (@{profileUser.username})</h1>
      <img src={profileUser.avatarUrl} alt="avatar" style={{maxWidth:120}} />
      <p>Plays: {totalPlays} Likes: {totalLikes}</p>
      <h3>Tracks</h3>
      <ul>{(tracks||[]).map(t => <li key={t._id}><Link to={`/track/${t._id}`}>{t.title}</Link></li>)}</ul>
      <h3>Playlists</h3>
      <ul>{(playlists||[]).map(p => <li key={p._id}><Link to={`/playlist/${p._id}`}>{p.name}</Link></li>)}</ul>
    </div>
  )
}
