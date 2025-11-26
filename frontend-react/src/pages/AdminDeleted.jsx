import React, { useEffect, useState } from 'react'
import api from '../api'

export default function AdminDeleted(){
  const [tracks, setTracks] = useState([])
  useEffect(() => {
    api.get('/admin/deleted')
      .then(res => { if (res.data?.success) setTracks(res.data.tracks || []) })
      .catch(err => console.error('Admin deleted api', err))
  }, [])

  return (
    <div>
      <h1>Deleted Tracks</h1>
      <ul>{tracks.map(t => <li key={t._id}>{t.title} — {t.artist}</li>)}</ul>
    </div>
  )
}
