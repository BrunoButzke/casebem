import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import Telao from '../games/src/pages/Telao.jsx';
import { loadAndApplyDesafioTheme } from '../games/src/theme.js';
import '../games/src/styles.css';

await loadAndApplyDesafioTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename="/telao">
      <div className="play is-telao">
        <main className="play-main">
          <Telao standalone />
        </main>
      </div>
    </BrowserRouter>
  </StrictMode>
);
