import { lazy, Suspense } from "react";
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
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingSpinner } from "@/components/LoadingSpinner";

// Eager: critical first-paint routes
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy: everything behind auth or rarely visited
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const SubmitRequest = lazy(() => import("./pages/SubmitRequest"));
const TrackRequests = lazy(() => import("./pages/TrackRequests"));
const OfflineDraft = lazy(() => import("./pages/OfflineDraft"));
const ManageRequests = lazy(() => import("./pages/ManageRequests"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const UserManagementPage = lazy(() => import("./pages/admin/UserManagementPage"));
const AnalyticsDashboard = lazy(() => import("./pages/admin/AnalyticsDashboard"));
const TrainingOrganizations = lazy(() => import("./pages/admin/TrainingOrganizations"));
const OrganizationDetail = lazy(() => import("./pages/admin/OrganizationDetail"));
const SurveyResponses = lazy(() => import("./pages/admin/SurveyResponses"));
const RequestDetail = lazy(() => import("./pages/RequestDetail"));
const RequestsList = lazy(() => import("./pages/RequestsList"));
const CaseManagerDetail = lazy(() => import("./pages/CaseManagerDetail"));
const StudentDetail = lazy(() => import("./pages/StudentDetail"));
const Messages = lazy(() => import("./pages/Messages"));
const SupportCenter = lazy(() => import("./pages/SupportCenter"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));
const IntakeSurvey = lazy(() => import("./pages/IntakeSurvey"));
const StudentFolders = lazy(() => import("./pages/StudentFolders"));
const StudentCheckIn = lazy(() => import("./pages/StudentCheckIn"));
const PostGraduationPlan = lazy(() => import("./pages/PostGraduationPlan"));

// Create query client outside component to ensure stable reference
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoadingSpinner size="lg" />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <OfflineProvider>
                <TooltipProvider delayDuration={0}>
                  <Toaster />
                  <Sonner />
                  <Suspense fallback={<RouteFallback />}>
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
                  <Route path="/check-in" element={
                    <ProtectedRoute allowedRoles={['student']}>
                      <StudentCheckIn />
                    </ProtectedRoute>
                  } />
                  <Route path="/post-graduation-plan" element={
                    <ProtectedRoute allowedRoles={['student']}>
                      <PostGraduationPlan />
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
            <Route path="/admin/organizations" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <TrainingOrganizations />
              </ProtectedRoute>
            } />
            <Route path="/admin/organizations/:id" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <OrganizationDetail />
              </ProtectedRoute>
            } />
            <Route path="/admin/surveys" element={
              <ProtectedRoute allowedRoles={['case_manager', 'admin']}>
                <SurveyResponses />
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
                </Suspense>
              </TooltipProvider>
            </OfflineProvider>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
