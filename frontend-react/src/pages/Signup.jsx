import React, { useState } from 'react'

export default function Signup(){
  const [form, setForm] = useState({ name:'', username:'', email:'', password:'' })
  const [msg, setMsg] = useState('')

  const onChange = e => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async e => {
    e.preventDefault()
    try {
      const res = await fetch('/signup', { method: 'POST', body: new URLSearchParams(form) })
      if (res.redirected) window.location.href = res.url
      else setMsg('Signup attempted')
    } catch (err) { setMsg('Error') }
  }

  return (
    <div>
      <h1>Signup</h1>
      <form onSubmit={submit}>
        <input name="name" placeholder="Name" value={form.name} onChange={onChange} />
        <input name="username" placeholder="Username" value={form.username} onChange={onChange} />
        <input name="email" placeholder="Email" value={form.email} onChange={onChange} />
        <input name="password" type="password" placeholder="Password" value={form.password} onChange={onChange} />
        <button type="submit">Sign up</button>
      </form>
      {msg && <p>{msg}</p>}
    </div>
  )
}
