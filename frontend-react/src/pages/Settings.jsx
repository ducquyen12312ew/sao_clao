import React, { useState, useEffect } from 'react'
import api from '../api'

export default function Settings(){
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    api.get('/settings')
      .then(res => { if (mounted && res.data?.success) setSettings(res.data.settings || {}) })
      .catch(err => console.error('Settings API', err))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  if (loading) return <p>Loading...</p>
  return <div>
    <h1>Settings</h1>
    <pre>{JSON.stringify(settings, null, 2)}</pre>
  </div>
}
