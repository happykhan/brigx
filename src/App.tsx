import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import About from './pages/About';
import Home from './pages/Home';
import Landing from './pages/Landing';
import Viewer from './pages/Preview';
import Publication from './pages/Publication';

function LegacyPreviewRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/viewer${search}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/viewer" element={<Viewer />} />
      <Route path="/preview" element={<LegacyPreviewRedirect />} />
      <Route path="/publication/:slug" element={<Publication />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
