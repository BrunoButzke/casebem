import { Navigate, Route, Routes } from 'react-router-dom';
import { DemoProvider } from './DemoContext.jsx';
import DemoShell from './DemoShell.jsx';
import Quiz from './pages/Quiz.jsx';
import Desafios from './pages/Desafios.jsx';
import Selo from './pages/Selo.jsx';
import Ranking from './pages/Ranking.jsx';
import Galeria from './pages/Galeria.jsx';
import Sorteio from './pages/Sorteio.jsx';

export default function App() {
  return (
    <DemoProvider>
      <Routes>
        <Route element={<DemoShell />}>
          <Route path="/" element={<Navigate to="/quiz" replace />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/desafios" element={<Desafios />} />
          <Route path="/selo" element={<Selo />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/galeria" element={<Galeria />} />
          <Route path="/sorteio" element={<Sorteio />} />
        </Route>
        <Route path="*" element={<Navigate to="/quiz" replace />} />
      </Routes>
    </DemoProvider>
  );
}
