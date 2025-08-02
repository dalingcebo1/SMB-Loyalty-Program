import React from 'react';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';

interface PageLayoutProps {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  loadingText?: string;
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({ loading, error, onRetry, loadingText, children }) => {
  if (loading) {
    return <Loading text={loadingText} />;
  }
  if (error) {
    return <ErrorMessage message={error} onRetry={onRetry} />;
  }
  return <>{children}</>;
};

export default PageLayout;
