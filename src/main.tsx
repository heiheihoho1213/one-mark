import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './utils/markdownHighlight';
import App from './App.tsx';
import './index.css';
import './styles/code-highlight.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
