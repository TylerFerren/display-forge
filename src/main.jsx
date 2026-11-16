import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ColorPickerDemo } from './components/ui/color-picker.jsx';
import { GradientPickerDemo } from './components/ui/gradient-picker.jsx';
import './react-app.css';

createRoot(document.getElementById('root')).render(<React.StrictMode>{window.location.search.includes('gradient-picker') ? <GradientPickerDemo /> : window.location.search.includes('color-picker') ? <ColorPickerDemo /> : <App />}</React.StrictMode>);
