import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { gamesRouterBasename } from '../../functions/_lib/pages-routing.mjs';
import App from './App.jsx';
import { loadAndApplyDesafioTheme } from './theme.js';
import './styles.css';

await loadAndApplyDesafioTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={gamesRouterBasename(window.location.hostname)}>
      <App />
    </BrowserRouter>
  </StrictMode>
);
