import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initTema } from './lib/theme';
import './index.css';

// Dijalankan sebelum render supaya atribut data-tema sudah benar saat React
// mulai menggambar, dan tidak muncul kedipan warna keliru.
initTema();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
