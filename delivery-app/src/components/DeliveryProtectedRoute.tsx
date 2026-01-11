import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface DeliveryProtectedRouteProps {
  children: ReactNode;
}

const DeliveryProtectedRoute = ({ children }: DeliveryProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  if (!user || user.role !== 'delivery') {
    // Redirect to login page if not authenticated or not a delivery user
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default DeliveryProtectedRoute;

