import { Navigate, Route, Routes } from 'react-router-dom';
import About from './pages/About';
import Home from './pages/Home';
import Landing from './pages/Landing';
import Preview from './pages/Preview';
import Publication from './pages/Publication';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/preview" element={<Preview />} />
      <Route path="/preview/:id" element={<Preview />} />
      <Route path="/publication/:slug" element={<Publication />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
