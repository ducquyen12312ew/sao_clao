import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'

export default function TrackDetail(){
  const { id } = useParams()
  const [track, setTrack] = useState(null)
  const [loading, setLoading] = useState(true)
<<<<<<< Updated upstream
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    // check if current user liked this track
    let mounted = true
    api.get('/likes')
      .then(res => {
        if (!mounted) return
        const list = res.data?.tracks || []
        setLiked(list.some(t => t._id === id || t._id === id))
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [id])
=======
>>>>>>> Stashed changes

  useEffect(() => {
    let mounted = true
    api.get(`/tracks/${id}`)
      .then(res => {
        if (mounted && res.data?.success) setTrack(res.data.track)
      })
      .catch(err => console.error('Track API error', err))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [id])

  if (loading) return <p>Loading...</p>
  if (!track) return <p>Track not found.</p>

  return (
    <div>
      <h1>{track.title}</h1>
      <p>Artist: {track.artist}</p>
      <img src={track.coverUrl} alt={track.title} style={{maxWidth:200}} />
      <div>
        <audio controls src={track.audioUrl} />
      </div>
      <div>
<<<<<<< Updated upstream
        <button onClick={async () => {
          try {
            if (!liked) await api.post(`/tracks/${id}/like`)
            else await api.post(`/tracks/${id}/unlike`)
            setLiked(!liked)
          } catch (err) { console.error(err) }
        }}>{liked ? 'Unlike' : 'Like'}</button>
        <span style={{marginLeft:8}}>Likes: {track.likes || 0}</span>
      </div>
      <div>
=======
>>>>>>> Stashed changes
        <h3>Lyrics</h3>
        <pre style={{whiteSpace:'pre-wrap'}}>{track.lyricsText || 'No lyrics'}</pre>
      </div>
    </div>
  )
}
