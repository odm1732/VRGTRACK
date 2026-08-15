# VRGTrack TODO

## Schema & Database
- [x] Add password, passwordResetToken, passwordResetExpiry fields to users table
- [x] Add members table
- [x] Add submissions table
- [x] Add goals table
- [x] Run migration SQL

## Backend Routers
- [x] auth.register (email/password signup)
- [x] auth.login (email/password signin)
- [x] auth.requestPasswordReset
- [x] auth.resetPassword
- [x] dashboard router (stats, weeklyReport, memberReport, absenceSummary)
- [x] goals router (get, set, ytdSummary, monthSummary)
- [x] members router (list, listAll, create, update, delete)
- [x] submissions router (create)
- [x] users router (listAll, create, updateRole, remove)

## Frontend Pages
- [x] Home page (public YTD progress)
- [x] SubmitForm page (public weekly report submission)
- [x] DashboardLayout with dual sign-in UI (OAuth + email/password tabs)
- [x] Dashboard page
- [x] WeeklyReport page
- [x] MemberReports page
- [x] MemberDetail page
- [x] AbsenceTracking page
- [x] ManageMembers page
- [x] ExportData page
- [x] GoalsSettings page
- [x] UserManagement page
- [x] NotFound page

## Auth Features
- [x] Email/password sign-in tab on dashboard gate
- [x] Email/password sign-up tab on dashboard gate
- [x] Password reset request form
- [x] Password reset confirmation form
- [x] Preserve OAuth sign-in option (Google)
- [x] Role-based access control for both auth methods

## Tests
- [x] auth.login test (success, wrong password, unknown email)
- [x] auth.register test (success, conflict)
- [x] auth.logout test
- [x] auth.requestPasswordReset test (unknown + known email)
