import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { ProtectedRoute } from "@/components/layouts/ProtectedRoute";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import SubmitRequest from "./pages/SubmitRequest";
import TrackRequests from "./pages/TrackRequests";
import OfflineDraft from "./pages/OfflineDraft";
import ManageRequests from "./pages/ManageRequests";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

// Create query client outside component to ensure stable reference
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <OfflineProvider>
              <TooltipProvider delayDuration={0}>
                <Toaster />
                <Sonner />
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  
                  {/* Protected routes - All authenticated users */}
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/settings" element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  } />
                  
                  {/* Student routes */}
                  <Route path="/student-submitting-a-support-request" element={
                    <ProtectedRoute allowedRoles={['student']}>
                      <SubmitRequest />
                    </ProtectedRoute>
                  } />
                  <Route path="/student-tracking-request-status-scheduling-meeting" element={
                    <ProtectedRoute allowedRoles={['student']}>
                      <TrackRequests />
                    </ProtectedRoute>
                  } />
                  <Route path="/student-creating-offline-draft-request" element={
                    <ProtectedRoute allowedRoles={['student']}>
                      <OfflineDraft />
                    </ProtectedRoute>
                  } />
                  
                  {/* Case Manager routes */}
                  <Route path="/case-manager-managing-student-requests" element={
                    <ProtectedRoute allowedRoles={['case_manager']}>
                      <ManageRequests />
                    </ProtectedRoute>
                  } />
                  
                  {/* Admin routes */}
                  <Route path="/admin-monitoring-reassigning-requests" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } />
                  
                  {/* Catch-all route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </TooltipProvider>
            </OfflineProvider>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
