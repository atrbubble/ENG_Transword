import { HashRouter, Route, Routes } from 'react-router-dom'

import ExamPage from '@/pages/ExamPage'
import Home from '@/pages/Home'
import StudyPage from '@/pages/StudyPage'
import VocabularyPage from '@/pages/VocabularyPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/exam/:paperId" element={<ExamPage />} />
        <Route path="/vocabulary" element={<VocabularyPage />} />
        <Route path="/study" element={<StudyPage />} />
      </Routes>
    </HashRouter>
  )
}
