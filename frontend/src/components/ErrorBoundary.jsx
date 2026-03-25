import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback card" style={{ margin: '10vh auto', maxWidth: '600px', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>An unexpected error occurred in the application.</p>
          <button 
            className="btn-primary" 
            onClick={() => this.setState({ hasError: false })}
            style={{ marginTop: '1rem' }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
