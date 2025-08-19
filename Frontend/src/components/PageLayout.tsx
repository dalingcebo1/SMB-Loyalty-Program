import React from 'react';
import Container from './ui/Container';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';

export interface PageLayoutProps {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  loadingText?: string;
  children?: React.ReactNode;
}

// Removed merge conflict markers
const PageLayout: React.FC<PageLayoutProps> = ({ loading, error, onRetry, loadingText, children }) => {
  if (loading) {
    return <Loading text={loadingText} />;
  }
  if (error) {
    return <ErrorMessage message={error} onRetry={onRetry} />;
  }
  // Wrap page content in global Container for consistent max-width and padding
  return (
    <>
      <Container>
        {children}
        <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
          API Version: v1.0.0
        </footer>
      </Container>
    </>
  );
};

export default PageLayout;
