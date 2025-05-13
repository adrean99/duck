import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import Login from "./pages/Login";
import AdminLogin from "./components/AdminLogin";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import LeaveRoster from "./components/LeaveRoster";
import Notifications from "./components/Notifications";


//import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import LeaveCalendar from "./pages/LeaveCalendar";
import ApplyLeave from "./pages/ApplyLeave";
import Profile from "./pages/Profile";
import ShortLeave from "./components/ShortLeave";
import AnnualLeave from "./components/AnnualLeave";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import { Typography } from "@mui/material";

//import PrivateRoute from "./utils/PrivateRoute";

const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, token } = useContext(AuthContext);
  
  const localToken = localStorage.getItem("token");
  const localUser = JSON.parse(localStorage.getItem("user") || "null");

  console.log("PrivateRoute rendering - Context User:", user, "Context Token:", token);
  console.log("PrivateRoute - LocalStorage User:", localUser, "LocalStorage Token:", localToken);

  // Use context if available, otherwise fall back to localStorage
  const effectiveToken = token || localToken;
  const effectiveUser = user || localUser;

  if (effectiveUser === undefined || effectiveToken === undefined) {
    console.log("PrivateRoute: Auth state not yet loaded (undefined), waiting...");
    return <Typography>Loading dashboard...</Typography>;
  }

  if (!effectiveUser || !effectiveToken) {
    console.log("PrivateRoute: No user or token, redirecting to /login");
    return <Navigate to="/login" />;
  }

  if (!allowedRoles.includes(effectiveUser.role)) {
    console.log(`PrivateRoute: Role ${effectiveUser.role} not allowed, redirecting to /dashboard`);
    return <Navigate to="/dashboard" />;
  }

  console.log("PrivateRoute: Access granted to", allowedRoles);
  return children;
};


function App() {
  console.log("App rendering");
  return (
    <AuthProvider>
       <NotificationProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/register" element={<Register />} />

          {/* Private Routes */}
          <Route path="/dashboard" element={<PrivateRoute allowedRoles={["Employee", "SectionalHead", "DepartmentalHead", "HRDirector", "Admin"]}><Dashboard /></PrivateRoute>} />
          <Route path="/employee-dashboard" element={<PrivateRoute allowedRoles={["Employee"]}><EmployeeDashboard /></PrivateRoute>} />
          <Route path="/leave-roster" element={<LeaveRoster />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<PrivateRoute allowedRoles={["Employee", "Admin", "SectionalHead", "DepartmentalHead", "HRDirector"]}><Profile /></PrivateRoute>} />
          <Route path="/admin-dashboard" element={<PrivateRoute allowedRoles={["Supervisor", "Admin", "SectionalHead", "DepartmentalHead", "HRDirector"]}><AdminDashboard /></PrivateRoute>} />
          <Route path="/super-admin-dashboard" element={<PrivateRoute allowedRoles={["Admin"]}><SuperAdminDashboard /></PrivateRoute>} />
          
          {/* Leave Calendar (Assumed Accessible to All) */}
          <Route path="/leave-calendar" element={<LeaveCalendar />} />
          <Route path="/apply-leave" element={<ApplyLeave />} />
          <Route path="/apply-leave/short" element={<ShortLeave />} />
          <Route path="/apply-leave/annual" element={<AnnualLeave />} />
          
          

          {/* 404 Not Found Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      </NotificationProvider>
    </AuthProvider>
   
  );
}

export default App;
