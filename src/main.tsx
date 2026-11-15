import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { captureFirstTouchAcquisitionSource } from './utils/acquisition';
import './index.css';

// Immediately capture visitor first-touch acquisition source (referrer, UTMs, landing path)
captureFirstTouchAcquisitionSource();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
