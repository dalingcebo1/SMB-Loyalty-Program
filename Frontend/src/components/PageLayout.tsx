import React from 'react';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';

<<<<<<< HEAD
interface PageLayoutProps {
=======
export interface PageLayoutProps {
>>>>>>> 2586f56 (Add testing setup and scripts for backend and frontend)
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
<<<<<<< HEAD
    return <ErrorMessage message={error} onRetry={onRetry} />;
=======
    return <ErrorMessage message={error!} onRetry={onRetry} />;
>>>>>>> 2586f56 (Add testing setup and scripts for backend and frontend)
  }
  return <>{children}</>;
};

export default PageLayout;
