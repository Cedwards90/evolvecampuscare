import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";

import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { ProtectedRoute } from "@/components/layouts/ProtectedRoute";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import SubmitRequest from "./pages/SubmitRequest";
import TrackRequests from "./pages/TrackRequests";
import OfflineDraft from "./pages/OfflineDraft";
import ManageRequests from "./pages/ManageRequests";
import AdminDashboard from "./pages/AdminDashboard";
import UserManagementPage from "./pages/admin/UserManagementPage";
import AnalyticsDashboard from "./pages/admin/AnalyticsDashboard";
import TrainingOrganizations from "./pages/admin/TrainingOrganizations";
import RequestDetail from "./pages/RequestDetail";
import RequestsList from "./pages/RequestsList";
import CaseManagerDetail from "./pages/CaseManagerDetail";
import StudentDetail from "./pages/StudentDetail";
import Messages from "./pages/Messages";
import SupportCenter from "./pages/SupportCenter";
import CompleteProfile from "./pages/CompleteProfile";
import IntakeSurvey from "./pages/IntakeSurvey";
import StudentFolders from "./pages/StudentFolders";
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
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
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
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  
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
            <Route path="/admin/analytics" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AnalyticsDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <UserManagementPage />
                    </ProtectedRoute>
                  } />
                  
                  {/* Messages - All authenticated users */}
                  <Route path="/messages" element={
                    <ProtectedRoute>
                      <Messages />
                    </ProtectedRoute>
                  } />
                  <Route path="/messages/:userId" element={
                    <ProtectedRoute>
                      <Messages />
                    </ProtectedRoute>
                  } />
                  
                  {/* Shared routes */}
              <Route path="/requests/:id" element={
                <ProtectedRoute>
                  <RequestDetail />
                </ProtectedRoute>
              } />
              <Route path="/requests" element={
                <ProtectedRoute>
                  <RequestsList />
                </ProtectedRoute>
              } />
              <Route path="/case-managers/:id" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <CaseManagerDetail />
                </ProtectedRoute>
              } />
              <Route path="/students/:id" element={
                <ProtectedRoute allowedRoles={['case_manager', 'admin']}>
                  <StudentDetail />
                </ProtectedRoute>
              } />

              {/* Student Folders */}
              <Route path="/student-folders" element={
                <ProtectedRoute allowedRoles={['case_manager', 'admin']}>
                  <StudentFolders />
                </ProtectedRoute>
              } />

              {/* Support Center */}
              <Route path="/support" element={
                <ProtectedRoute>
                  <SupportCenter />
                </ProtectedRoute>
              } />

              {/* Profile Completion */}
              <Route path="/complete-profile" element={
                <ProtectedRoute>
                  <CompleteProfile />
                </ProtectedRoute>
              } />
              <Route path="/intake-survey" element={
                <ProtectedRoute>
                  <IntakeSurvey />
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
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
