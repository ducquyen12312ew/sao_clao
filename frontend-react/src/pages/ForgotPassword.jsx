import React, { useState } from 'react'

export default function ForgotPassword(){
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const submit = async e => {
    e.preventDefault()
    try {
      const res = await fetch('/forgot-password', { method: 'POST', body: new URLSearchParams({ email }) })
      if (res.redirected) window.location.href = res.url
      else setMsg('If email exists, reset link sent')
    } catch (err) { setMsg('Error') }
  }
  return (
    <div>
      <h1>Forgot Password</h1>
      <form onSubmit={submit}>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <button type="submit">Send</button>
      </form>
      {msg && <p>{msg}</p>}
    </div>
  )
}
