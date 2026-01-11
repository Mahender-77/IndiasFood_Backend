import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import DeliveryProtectedRoute from '@/components/DeliveryProtectedRoute';
import Login from '@/pages/Login';
import DeliveryDashboard from '@/pages/DeliveryDashboard';
import DeliveryOrderDetail from '@/pages/DeliveryOrderDetail';
import { Toaster } from '@/components/ui/toaster';

const App = () => {
  return (
    <AuthProvider>
      <Toaster />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <DeliveryProtectedRoute>
              <DeliveryDashboard />
            </DeliveryProtectedRoute>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <DeliveryProtectedRoute>
              <DeliveryOrderDetail />
            </DeliveryProtectedRoute>
          }
        />
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </AuthProvider>
  );
};

export default App;

