import React, { useEffect, useState } from 'react'
import api from '../api'

export default function AdminReports(){
  const [reports, setReports] = useState([])
  useEffect(() => {
    api.get('/admin/reports')
      .then(res => { if (res.data?.success) setReports(res.data.reports || []) })
      .catch(err => console.error('Admin reports api', err))
  }, [])

  return (
    <div>
      <h1>Reports</h1>
      <ul>{reports.map(r => <li key={r._id}>{r.reason} - {r.trackId?.title}</li>)}</ul>
    </div>
  )
}
