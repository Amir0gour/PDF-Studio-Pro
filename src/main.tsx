import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'pdfjs-dist/web/pdf_viewer.css';

createRoot(document.getElementById('root')!).render(<App />);
