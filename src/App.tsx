import { Navigate, Route, Routes } from 'react-router-dom';
import { isDesktopApp } from '@/lib/desktopBridge';
import About from './pages/About';
import Download from './pages/Download';
import Home from './pages/Home';
import Landing from './pages/Landing';

export default function App() {
  if (isDesktopApp()) return <Home />;

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Home />} />
      <Route path="/download" element={<Download />} />
      <Route path="/about" element={<About />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
