import React, { useState } from 'react'
import api from '../api'

export default function AdminSearch(){
  const [q, setQ] = useState('')
  const [tracks, setTracks] = useState([])
  const search = async e => {
    e.preventDefault()
    api.get('/admin/search', { params: { q } })
      .then(res => { if (res.data?.success) setTracks(res.data.tracks || []) })
      .catch(err => console.error('Admin search api', err))
  }
  return (
    <div>
      <h1>Admin Search</h1>
      <form onSubmit={search}><input value={q} onChange={e=>setQ(e.target.value)} /><button>Search</button></form>
      <ul>{tracks.map(t => <li key={t._id}>{t.title} — {t.artist}</li>)}</ul>
    </div>
  )
}
