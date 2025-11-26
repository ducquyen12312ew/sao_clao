import React, { useState } from 'react'
import api from '../api'
import axios from 'axios'

export default function Upload(){
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [audioFile, setAudioFile] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [msg, setMsg] = useState('')

  const submit = async e => {
    e.preventDefault()
    if (!audioFile) return setMsg('Please select an audio file')
    const fd = new FormData()
    fd.append('title', title)
    fd.append('artist', artist)
    fd.append('audio', audioFile)
    if (coverFile) fd.append('cover', coverFile)

    try {
      const res = await axios.post('/upload/new', fd, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          const p = Math.round((ev.loaded / ev.total) * 100)
          setProgress(p)
        }
      })
      if (res.status === 200) {
        setMsg('Upload successful')
      }
    } catch (err) {
      console.error('Upload error', err)
      setMsg('Upload failed')
    }
  }

  return (
    <div>
      <h1>Upload</h1>
      <form onSubmit={submit}>
        <div>
          <input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
        </div>
        <div>
          <input placeholder="Artist" value={artist} onChange={e=>setArtist(e.target.value)} />
        </div>
        <div>
          <label>Audio file</label>
          <input type="file" accept="audio/*" onChange={e=>setAudioFile(e.target.files[0])} />
        </div>
        <div>
          <label>Cover image (optional)</label>
          <input type="file" accept="image/*" onChange={e=>setCoverFile(e.target.files[0])} />
        </div>
        <div>
          <button type="submit">Upload</button>
        </div>
      </form>
      {progress > 0 && <div>Uploading: {progress}%</div>}
      {msg && <div>{msg}</div>}
    </div>
  )
}
