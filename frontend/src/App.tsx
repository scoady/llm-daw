import { Routes, Route } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { ProjectPage } from '@/pages/ProjectPage'

export default function App() {
  return (
    <Routes>
      <Route path="/"              element={<HomePage />} />
      <Route path="/project/:id"   element={<ProjectPage />} />
      <Route path="/project/new"   element={<ProjectPage />} />
    </Routes>
  )
}
