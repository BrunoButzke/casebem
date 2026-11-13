import { Navigate, Route, Routes } from 'react-router-dom';
import ComingSoon from './pages/ComingSoon.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ComingSoon />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
