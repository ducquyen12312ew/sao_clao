import React, { useState } from 'react'
import { useParams } from 'react-router-dom'

export default function ResetPassword(){
  const { token } = useParams()
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  const submit = async e => {
    e.preventDefault()
    try {
      const res = await fetch(`/reset-password/${token}`, { method: 'POST', body: new URLSearchParams({ password }) })
      if (res.redirected) window.location.href = res.url
      else setMsg('Reset attempted')
    } catch (err) { setMsg('Error') }
  }

  return (
    <div>
      <h1>Reset Password</h1>
      <form onSubmit={submit}>
        <input type="password" placeholder="New password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit">Reset</button>
      </form>
      {msg && <p>{msg}</p>}
    </div>
  )
}
