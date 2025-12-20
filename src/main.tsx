import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Add error handling for debugging
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found!');
  document.body.innerHTML = '<div style="padding: 20px; font-family: Arial;">Error: Root element not found. Check console for details.</div>';
} else {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    console.log('App rendered successfully');
  } catch (error) {
    console.error('Error rendering app:', error);
    rootElement.innerHTML = '<div style="padding: 20px; font-family: Arial;">Error loading app. Check console for details.</div>';
  }
}