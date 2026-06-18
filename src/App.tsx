import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";

import { AuthProvider } from "@/contexts/AuthContext";
import { useRealtimeBridge } from "@/hooks/useRealtimeBridge";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import { ProtectedRoute } from "@/components/layouts/ProtectedRoute";
import { NavigationTracker } from "@/components/navigation/NavigationTracker";

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
import CaseManagersPage from "./pages/admin/CaseManagersPage";
import TrainingOrganizations from "./pages/admin/TrainingOrganizations";
import OrganizationDetail from "./pages/admin/OrganizationDetail";
import SurveyResponses from "./pages/admin/SurveyResponses";
import QRCodesPage from "./pages/admin/QRCodesPage";
import QRLanding from "./pages/QRLanding";
import QRStandaloneRequest from "./pages/QRStandaloneRequest";
import QRRequestSuccess from "./pages/QRRequestSuccess";
import PublicSharedRequest from "./pages/PublicSharedRequest";
import RequestDetail from "./pages/RequestDetail";
import RequestsList from "./pages/RequestsList";
import CaseManagerDetail from "./pages/CaseManagerDetail";
import StudentDetail from "./pages/StudentDetail";
import Messages from "./pages/Messages";
import SupportCenter from "./pages/SupportCenter";
import CompleteProfile from "./pages/CompleteProfile";
import IntakeSurvey from "./pages/IntakeSurvey";
import StudentFolders from "./pages/StudentFolders";
import StudentCheckIn from "./pages/StudentCheckIn";
import PostGraduationPlan from "./pages/PostGraduationPlan";
import MySubmissions from "./pages/MySubmissions";
import Reports from "./pages/Reports";
import StudentProgressReportPage from "./pages/StudentProgressReport";
import NotFound from "./pages/NotFound";
import AcceptNda from "./pages/AcceptNda";
import AdminNda from "./pages/admin/AdminNda";
import TransitionsDashboard from "./pages/admin/TransitionsDashboard";
import ImpactDashboard from "./pages/admin/ImpactDashboard";
import AdminStudentSubmissions from "./pages/admin/AdminStudentSubmissions";
import TimeTracking from "./pages/TimeTracking";
import TimeTrackingAdmin from "./pages/admin/TimeTrackingAdmin";

// Create query client outside component to ensure stable reference.
// Defaults tuned to avoid stale UI after mutations or returning to a tab,
// while still keeping React Query's dedupe/cache benefits.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

function RealtimeBridge() {
  useRealtimeBridge();
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <BrowserRouter>
          <AuthProvider>
            <NavigationTracker />
            <RealtimeBridge />
            <LanguageProvider>
              <OfflineProvider>
                <GlobalFiltersProvider>
                <TooltipProvider delayDuration={0}>
                  <Toaster />
                  <Sonner />
                  <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/qr/:code" element={<QRLanding />} />
                  <Route path="/qr/:code/request" element={<QRStandaloneRequest />} />
                  <Route path="/qr/:code/request/success" element={<QRRequestSuccess />} />
                  <Route path="/shared/request/:token" element={<PublicSharedRequest />} />

                  {/* NDA acceptance gate (requires login but bypasses NDA gate itself) */}
                  <Route path="/accept-nda" element={<AcceptNda />} />
                  
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
                  {/* Canonical QR-friendly alias for the student support-request page */}
                  <Route path="/student/support-request" element={
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
                  <Route path="/my-submissions" element={
                    <ProtectedRoute allowedRoles={['student']}>
                      <MySubmissions />
                    </ProtectedRoute>
                  } />
                  
                  {/* Case Manager routes */}
                  <Route path="/case-manager-managing-student-requests" element={
                    <ProtectedRoute allowedRoles={['case_manager', 'org_admin']}>
                      <ManageRequests />
                    </ProtectedRoute>
                  } />
                  <Route path="/reports" element={
                    <ProtectedRoute allowedRoles={['case_manager', 'admin', 'org_admin']}>
                      <Reports />
                    </ProtectedRoute>
                  } />
                  <Route path="/reports/student" element={
                    <ProtectedRoute allowedRoles={['case_manager', 'admin', 'org_admin']}>
                      <StudentProgressReportPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/reports/student/:studentId" element={
                    <ProtectedRoute allowedRoles={['case_manager', 'admin', 'org_admin']}>
                      <StudentProgressReportPage />
                    </ProtectedRoute>
                  } />
                  
                  {/* Admin routes */}
            <Route path="/admin-monitoring-reassigning-requests" element={
              <ProtectedRoute allowedRoles={['admin', 'org_admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/analytics" element={
              <ProtectedRoute allowedRoles={['admin', 'org_admin']}>
                <AnalyticsDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <UserManagementPage />
                    </ProtectedRoute>
                  } />
            <Route path="/admin/case-managers" element={
              <ProtectedRoute allowedRoles={['admin', 'org_admin']}>
                <CaseManagersPage />
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
              <ProtectedRoute allowedRoles={['case_manager', 'admin', 'org_admin']}>
                <SurveyResponses />
              </ProtectedRoute>
            } />
            <Route path="/admin/qr-codes" element={
              <ProtectedRoute allowedRoles={['admin', 'org_admin']}>
                <QRCodesPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/nda" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminNda />
              </ProtectedRoute>
            } />
            <Route path="/admin/transitions" element={
              <ProtectedRoute allowedRoles={['admin', 'org_admin']}>
                <TransitionsDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/impact" element={
              <ProtectedRoute allowedRoles={['admin', 'org_admin']}>
                <ImpactDashboard />
              </ProtectedRoute>
            } />
            <Route path="/time-tracking" element={
              <ProtectedRoute allowedRoles={['case_manager', 'admin']}>
                <TimeTracking />
              </ProtectedRoute>
            } />
            <Route path="/admin/time-tracking" element={
              <ProtectedRoute allowedRoles={['admin', 'org_admin']}>
                <TimeTrackingAdmin />
              </ProtectedRoute>
            } />
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
                <ProtectedRoute allowedRoles={['admin', 'org_admin']}>
                  <CaseManagerDetail />
                </ProtectedRoute>
              } />
              <Route path="/students/:id" element={
                <ProtectedRoute allowedRoles={['case_manager', 'admin', 'org_admin']}>
                  <StudentDetail />
                </ProtectedRoute>
              } />
              <Route path="/admin/students/:id/submissions" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminStudentSubmissions />
                </ProtectedRoute>
              } />

              {/* Student Folders */}
              <Route path="/student-folders" element={
                <ProtectedRoute allowedRoles={['case_manager', 'admin', 'org_admin']}>
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
                </GlobalFiltersProvider>
              </OfflineProvider>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
