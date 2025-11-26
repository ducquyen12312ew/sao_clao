import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Upload from './pages/Upload'
import PlaylistDetail from './pages/PlaylistDetail'
import TrackDetail from './pages/TrackDetail'
import Playlists from './pages/Playlists'
import Signup from './pages/Signup'
import Profile from './pages/Profile'
import Likes from './pages/Likes'
import Settings from './pages/Settings'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import UserProfile from './pages/UserProfile'
import AdminDashboard from './pages/AdminDashboard'
import AdminReports from './pages/AdminReports'
import AdminDeleted from './pages/AdminDeleted'
import AdminSearch from './pages/AdminSearch'
import NotFound from './pages/NotFound'
import Music from './pages/Music'

export default function App() {
  return (
    <div>
      <header className="site-header">
        <Link to="/">SaoClao</Link>
        <nav>
          <Link to="/playlists">Playlists</Link>
          <Link to="/likes">Likes</Link>
          <Link to="/login">Login</Link>
          <Link to="/upload">Upload</Link>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/login" element={<Login/>} />
          <Route path="/upload" element={<Upload/>} />
          <Route path="/playlist/:id" element={<PlaylistDetail/>} />
          <Route path="/track/:id" element={<TrackDetail/>} />
          <Route path="/playlists" element={<Playlists/>} />
          <Route path="/signup" element={<Signup/>} />
          <Route path="/profile" element={<Profile/>} />
          <Route path="/likes" element={<Likes/>} />
          <Route path="/settings" element={<Settings/>} />
          <Route path="/forgot-password" element={<ForgotPassword/>} />
          <Route path="/reset-password/:token" element={<ResetPassword/>} />
          <Route path="/users/:username" element={<UserProfile/>} />
          <Route path="/admin/dashboard" element={<AdminDashboard/>} />
          <Route path="/admin/reports" element={<AdminReports/>} />
          <Route path="/admin/deleted" element={<AdminDeleted/>} />
          <Route path="/admin/search" element={<AdminSearch/>} />
          <Route path="/music" element={<Music/>} />
          <Route path="*" element={<NotFound/>} />
        </Routes>
      </main>
    </div>
  )
}
