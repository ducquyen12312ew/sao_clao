import React, { useEffect, useState } from 'react'
import api from '../api'

export default function Profile(){
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api.get('/me')
      .then(res => { if (mounted && res.data?.success) setProfile(res.data.user) })
      .catch(err => console.error('Profile API', err))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  if (loading) return <p>Loading...</p>
  if (!profile) return <p>Not logged in</p>

  return (
    <div>
      <h1>{profile.name}</h1>
      <p>@{profile.username}</p>
      <img src={profile.avatarUrl} alt="avatar" style={{maxWidth:120}} />
    </div>
  )
}
