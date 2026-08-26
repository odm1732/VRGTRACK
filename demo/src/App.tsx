import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import SubmitForm from "./pages/SubmitForm";
import DashboardLayout from "./components/DashboardLayout";
import DashboardPage from "./pages/dashboard/DashboardPage";
import WeeklyReportPage from "./pages/dashboard/WeeklyReportPage";
import MemberReportsPage from "./pages/dashboard/MemberReportsPage";
import MemberDetailPage from "./pages/dashboard/MemberDetailPage";
import AbsenceTrackingPage from "./pages/dashboard/AbsenceTrackingPage";
import ManageMembersPage from "./pages/dashboard/ManageMembersPage";
import ExportDataPage from "./pages/dashboard/ExportDataPage";
import GoalsPage from "./pages/dashboard/GoalsPage";

function DashboardRoute({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Routes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/submit" component={SubmitForm} />
      <Route path="/dashboard">
        <DashboardRoute><DashboardPage /></DashboardRoute>
      </Route>
      <Route path="/dashboard/weekly">
        <DashboardRoute><WeeklyReportPage /></DashboardRoute>
      </Route>
      <Route path="/dashboard/members/:id">
        {(params) => (
          <DashboardRoute><MemberDetailPage memberId={Number(params.id)} /></DashboardRoute>
        )}
      </Route>
      <Route path="/dashboard/members">
        <DashboardRoute><MemberReportsPage /></DashboardRoute>
      </Route>
      <Route path="/dashboard/absences">
        <DashboardRoute><AbsenceTrackingPage /></DashboardRoute>
      </Route>
      <Route path="/dashboard/manage-members">
        <DashboardRoute><ManageMembersPage /></DashboardRoute>
      </Route>
      <Route path="/dashboard/export">
        <DashboardRoute><ExportDataPage /></DashboardRoute>
      </Route>
      <Route path="/dashboard/goals">
        <DashboardRoute><GoalsPage /></DashboardRoute>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          {/* Hash routing so the static build works at any path, with no server rewrite rules. */}
          <Router hook={useHashLocation}>
            <Routes />
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
