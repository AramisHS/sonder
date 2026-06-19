import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function RootRedirect() {
    const { profile, loading } = useAuthStore();

    if (loading) {
        return null;
    }
    const redirectTo = profile?.role === 'admin' ? '/dashboard' : '/nueva-venta';
    return <Navigate to={redirectTo} replace />;
}