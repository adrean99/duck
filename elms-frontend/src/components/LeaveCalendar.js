import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import apiClient from "../utils/apiClient";
import { useNavigate } from "react-router-dom";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from "@mui/material";
import { styled } from "@mui/system";
import Sidebar from "../components/Sidebar";
import "react-big-calendar/lib/css/react-big-calendar.css";

// Setup the localizer for react-big-calendar
const localizer = momentLocalizer(moment);

// Styled components
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: "#1976d2",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  zIndex: 1201,
  position: "fixed",
}));

const MainContent = styled(Box)(({ theme }) => ({
  marginTop: "64px",
  height: "calc(100vh - 64px)",
  width: "100%",
  overflow: "auto",
  padding: theme.spacing(3),
  boxSizing: "border-box",
}));

const LeaveCalendar = () => {
  const { user, logout, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [leaves, setLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const localToken = localStorage.getItem("token");
  const localUser = JSON.parse(localStorage.getItem("user") || "null");
  const effectiveToken = token || localToken;
  const effectiveUser = user || localUser;

  console.log("LeaveCalendar rendering - Token:", effectiveToken, "User:", effectiveUser);

  useEffect(() => {
    console.log("LeaveCalendar useEffect - Token:", effectiveToken);
    if (!effectiveToken || !effectiveUser) {
      console.log("No token or user, redirecting to /login");
      navigate("/login");
      return;
    }

    const fetchLeaves = async () => {
      setIsLoading(true);
      try {
        // Fetch Short Leave and Annual Leave separately
        const [shortLeaveRes, annualLeaveRes] = await Promise.all([
          apiClient.get("/api/leaves/my-leaves", {
            headers: { Authorization: `Bearer ${effectiveToken}` },
            params: { leaveType: "Short Leave" },
            timeout: 10000,
          }),
          apiClient.get("/api/leaves/my-leaves", {
            headers: { Authorization: `Bearer ${effectiveToken}` },
            params: { leaveType: "Annual Leave" },
            timeout: 10000,
          }),
        ]);

        // Combine the results
        const shortLeaves = Array.isArray(shortLeaveRes.data) ? shortLeaveRes.data : [];
        const annualLeaves = Array.isArray(annualLeaveRes.data) ? annualLeaveRes.data : [];
        const combinedLeaves = [...shortLeaves, ...annualLeaves];

        console.log("Fetched leave data:", combinedLeaves);
        setLeaves(combinedLeaves);
        setError(null);
      } catch (error) {
        console.error("Error fetching leave data:", error);
        setError(`Failed to fetch leave data: ${error.message}`);
        setLeaves([]);
        if (error.response?.status === 401) {
          console.log("401 Unauthorized from /api/leaves/my-leaves, logging out");
          logout();
          navigate("/login");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaves();
  }, [effectiveToken, effectiveUser, navigate, logout]);

  // Map leaves to calendar events
  const events = leaves.map((leave) => ({
    title: `${leave.leaveType} (${leave.status || "Pending"})`,
    start: new Date(leave.startDate),
    end: new Date(leave.endDate),
    allDay: true,
    resource: leave,
  }));

  // Custom event styling based on status
  const eventStyleGetter = (event) => {
    const style = {
      backgroundColor:
        event.resource.status === "Approved"
          ? "#4caf50" // Green for Approved
          : occasion.resource.status === "Rejected"
          ? "#f44336" // Red for Rejected
          : "#ff9800", // Orange for Pending
      borderRadius: "5px",
      opacity: 0.8,
      color: "white",
      border: "0px",
      display: "block",
    };
    return { style };
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading calendar...</Typography>
      </Box>
    );
  }

  if (!effectiveToken || !effectiveUser) {
    console.log("Render guard: No token or user, redirecting");
    navigate("/login");
    return null;
  }

  if (error) {
    return (
      <MainContent>
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
      </MainContent>
    );
  }

  return (
    <div>
      <StyledAppBar>
        <Toolbar>
          <Sidebar onLogout={logout} role={effectiveUser?.role || "Employee"} />
          <Typography
            variant="h6"
            sx={{
              flexGrow: 1,
              fontWeight: "bold",
              letterSpacing: 1,
              color: "#fff",
              ml: 2,
            }}
          >
            Leave Calendar
          </Typography>
          <Typography variant="subtitle1" sx={{ color: "#fff", fontWeight: "medium" }}>
            {effectiveUser?.role || "Employee"}
          </Typography>
        </Toolbar>
      </StyledAppBar>

      <MainContent>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: "bold", color: "#333" }}>
          Your Leave Calendar
        </Typography>
        {leaves.length === 0 ? (
          <Typography>No leave data found.</Typography>
        ) : (
          <Box sx={{ height: "calc(100vh - 150px)" }}>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: "100%" }}
              eventPropGetter={eventStyleGetter}
              onSelectEvent={(event) => alert(`Leave: ${event.title}\nStatus: ${event.resource.status}`)}
            />
          </Box>
        )}
      </MainContent>
    </div>
  );
};

export default LeaveCalendar;