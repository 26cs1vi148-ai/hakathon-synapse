import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

class AppErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <main style={{minHeight:'100vh',padding:'32px',background:'#020617',color:'#f8fafc',fontFamily:'system-ui'}}>
          <h1>Campus SOS could not start</h1>
          <p style={{color:'#fca5a5'}}>A browser error stopped the page from rendering.</p>
          <pre style={{whiteSpace:'pre-wrap',background:'#111827',padding:'16px',borderRadius:'12px',overflow:'auto'}}>{this.state.error?.stack || this.state.error?.message}</pre>
          <p>Restart the Vite server and refresh this page. If this message remains, copy the error above.</p>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>
);
