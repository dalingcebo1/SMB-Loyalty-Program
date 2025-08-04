import React, { Component, ReactNode } from 'react';
import FocusTrap from 'focus-trap-react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

class ErrorBoundary extends Component<Props, State> {
  // Ref to the error dialog container for focus management
  private containerRef = React.createRef<HTMLDivElement>();
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught error', error, info);
  }

  componentDidMount() {
    if (this.state.hasError) {
      this.containerRef.current?.focus();
    }
  }

  componentDidUpdate(_: Props, prevState: State) {
    if (!prevState.hasError && this.state.hasError) {
      this.containerRef.current?.focus();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <FocusTrap
          focusTrapOptions={{
            clickOutsideDeactivates: false,
            escapeDeactivates: false,
          }}
        >
          <div
            ref={this.containerRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="error-title"
            aria-describedby="error-desc"
            className="flex items-center justify-center h-screen"
          >
            <div className="bg-white p-8 rounded shadow-md text-center">
              <h1 id="error-title" className="text-2xl font-bold mb-4">
                Something went wrong.
              </h1>
              <p id="error-desc">Please try refreshing the page or contact support.</p>
            </div>
          </div>
        </FocusTrap>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
