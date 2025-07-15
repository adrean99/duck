import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import apiClient from "../utils/apiClient";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Paper,
  Alert,
  Box,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Button,
  Chip,
  LinearProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Snackbar,
  Grid,
} from "@mui/material";
import { styled } from "@mui/system";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Sidebar from "../components/Sidebar";
import { useNotifications } from "../context/NotificationContext";

// Styled components for custom styling
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: "#1976d2",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  zIndex: 1201,
}));

const MainContent = styled(Box)(({ theme }) => ({
  marginTop: "64px",
  height: "calc(100vh - 64px)",
  width: "100%",
  overflow: "auto",
  padding: theme.spacing(3),
  boxSizing: "border-box",
}));

const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: 8,
  backgroundColor: "#f9f9f9",
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  transition: "transform 0.2s ease-in-out",
  width: "100%",
  "&:hover": {
    transform: "translateY(-4px)",
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: 6,
  textTransform: "none",
  padding: "8px 16px",
}));

const EmployeeDashboard = () => {
  const { user, logout, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const { notifications, removeNotification } = useNotifications();
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const localToken = localStorage.getItem("token");
  const localUser = JSON.parse(localStorage.getItem("user") || "null");
  const effectiveToken = token || localToken;
  const effectiveUser = user || localUser;

  useEffect(() => {
    if (!effectiveToken || !effectiveUser) {
      navigate("/login");
      return;
    }

    const fetchLeaveBalance = async () => {
      try {
        const res = await apiClient.get("/api/leave-balances/", {
          headers: { Authorization: `Bearer ${effectiveToken}` },
          timeout: 10000,
        });
        setLeaveBalance(res.data);
      } catch (error) {
        console.error("Fetch error:", error);
        setError("Failed to fetch leave balance");
        if (error.response?.status === 401) {
          logout();
          navigate("/login");
        }
      }
    };

    const fetchLeaveHistory = async () => {
      try {
        const [shortLeaveRes, annualLeaveRes] = await Promise.all([
          apiClient.get("/api/leaves/my-leaves", {
            headers: { Authorization: `Bearer ${effectiveToken}` },
            params: { leaveType: "Short Leave" },
          }),
          apiClient.get("/api/leaves/my-leaves", {
            headers: { Authorization: `Bearer ${effectiveToken}` },
            params: { leaveType: "Annual Leave" },
          }),
        ]);
        const combinedLeaves = [...shortLeaveRes.data, ...annualLeaveRes.data]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5);
        setLeaveHistory(combinedLeaves);
      } catch (error) {
        console.error("Fetch leave history error:", error);
        setError("Failed to fetch leave history");
      }
    };

    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([fetchLeaveBalance(), fetchLeaveHistory()]);
      setIsLoading(false);
    };

    fetchData();
  }, []);

  const handleApplyLeave = () => {
    navigate("/apply-leave/short");
  };

  const getAvailabilityStatus = (availableDays) => {
    if (availableDays >= 20) return "Good";
    if (availableDays >= 10) return "Moderate";
    return "Low";
  };

 const getLeaveStatus = (leaveHistory, availableLeave) => {
    const today = new Date();
    const activeLeave = leaveHistory.find((leave) => {
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);
      return leave.status === "Approved" && startDate <= today && today <= endDate;
    });

    if (activeLeave) {
      return { status: "on_leave", label: "On Leave", color: "primary" };
    }

    const pendingLeave = leaveHistory.find((leave) => leave.status === "Pending");
    if (pendingLeave) {
      return { status: "pending", label: "Leave Request Pending", color: "warning" };
    }

    const mostRecentLeave = leaveHistory[0];
    if (mostRecentLeave && mostRecentLeave.status === "Rejected" && !activeLeave && !pendingLeave) {
      return { status: "rejected", label: "Leave Request Rejected", color: "error" };
    }

    if (availableLeave <= 0) {
      return { status: "no_balance", label: "No Leave Balance", color: "default" };
    }

    return { status: "eligible", label: "Eligible for Leave", color: "success" };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  if (!effectiveToken || !effectiveUser) {
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

  const availableLeave = leaveBalance
    ? leaveBalance.leaveBalanceBF + leaveBalance.currentYearLeave - leaveBalance.leaveTakenThisYear
    : 0;
  const totalLeave = leaveBalance ? leaveBalance.leaveBalanceBF + leaveBalance.currentYearLeave : 0;
  const leaveUsagePercentage = totalLeave ? (leaveBalance.leaveTakenThisYear / totalLeave) * 100 : 0;
  const availabilityStatus = getAvailabilityStatus(availableLeave);
 const { status: leaveStatus, label: statusLabel, color: statusColor } = getLeaveStatus(leaveHistory, availableLeave);

  const chartData = leaveHistory.map((leave, index) => ({
    month: `Month ${index + 1}`,
    daysTaken: leave.daysApplied || 0,
  }));

  return (
    <div>
      <StyledAppBar position="fixed">
        <Toolbar>
          <Sidebar onLogout={logout} />
          <Typography
            variant="h6"
            sx={{ flexGrow: 1, fontWeight: "bold", letterSpacing: 1, color: "#fff", ml: 2 }}
          >
            Employee Dashboard
          </Typography>
          <Typography variant="subtitle1" sx={{ color: "#fff", fontWeight: "medium" }}>
            {effectiveUser?.role || "Employee"}
          </Typography>
        </Toolbar>
      </StyledAppBar>

      <MainContent>
        {leaveBalance ? (
          <>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <StyledCard>
                  <CardContent>
                    <Typography variant="h5" sx={{ fontWeight: "bold", mb: 3 }}>
                      User Status
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                    <Typography variant="body1" sx={{ color: "#555" }}>
                      <strong>Name:</strong> {effectiveUser?.name || "N/A"}
                    </Typography>
                    <Typography variant="body1" sx={{ color: "#555" }}>
                      <strong>Role:</strong> {effectiveUser?.role || "N/A"}
                    </Typography>
                    <Typography variant="body1" sx={{ color: "#555" }}>
                      <strong>Leave Balance:</strong> {availableLeave} days ({availabilityStatus})
                    </Typography>
                    <Typography variant="body1" sx={{ color: "#555" }}>
                      <strong>Current Status:</strong> <Chip label={statusLabel} color={statusColor} size="small" />
                    </Typography>
                     </Box>
                    <Box sx={{ mt: 2 }}>
                      <StyledButton variant="outlined" color="primary" onClick={handleApplyLeave}>
                        Apply for Leave
                      </StyledButton>
                    </Box>
                  </CardContent>
                </StyledCard>
              </Grid>

              <Grid item xs={12} md={4}>
                <StyledCard>
                  <CardContent>
                    <Typography variant="h5" sx={{ fontWeight: "bold", mb: 3 }}>
                      Notifications
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    {notifications.length === 0 ? (
                      <Typography variant="body1" sx={{ color: "#666" }}>
                        No notifications
                      </Typography>
                    ) : (
                      notifications.map((notif, index) => (
                        <Box
                          key={index}
                          sx={{
                            p: 2,
                            bgcolor: "#e3f2fd",
                            borderRadius: 2,
                            mb: 2,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                          }}
                        >
                          <Typography variant="body2" sx={{ color: "#1976d2" }}>
                            {notif.message} - {notif.timestamp.toLocaleString()}
                          </Typography>
                        </Box>
                      ))
                    )}
                  </CardContent>
                </StyledCard>
              </Grid>

              <Grid item xs={12} md={4}>
                <StyledCard>
                  <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                      <Typography variant="h5" sx={{ fontWeight: "bold" }}>
                        Your Leave Balance
                      </Typography>
                      <Chip
                        label={availabilityStatus}
                        color={
                          availabilityStatus === "Good"
                            ? "success"
                            : availabilityStatus === "Moderate"
                            ? "warning"
                            : "error"
                        }
                        size="small"
                      />
                    </Box>
                    <Divider sx={{ mb: 3 }} />
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                      <Typography variant="body1" sx={{ color: "#555" }}>
                        <strong>Balance Brought Forward:</strong> {leaveBalance.leaveBalanceBF} days
                      </Typography>
                      <Typography variant="body1" sx={{ color: "#555" }}>
                        <strong>Current Year Leave:</strong> {leaveBalance.currentYearLeave} days
                      </Typography>
                      <Typography variant="body1" sx={{ color: "#555" }}>
                        <strong>Leave Taken This Year:</strong> {leaveBalance.leaveTakenThisYear} days
                      </Typography>
                      <Box>
                        <Typography variant="body2" sx={{ color: "#666", mb: 1 }}>
                          Leave Usage: {Math.round(leaveUsagePercentage)}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={leaveUsagePercentage}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: "#e0e0e0",
                            "& .MuiLinearProgress-bar": {
                              bgcolor: availabilityStatus === "Good" ? "#4caf50" : availabilityStatus === "Moderate" ? "#ff9800" : "#f44336",
                            },
                          }}
                        />
                      </Box>
                      <Typography variant="body1" sx={{ fontWeight: "bold", color: "#1976d2", fontSize: "1.2rem" }}>
                        <strong>Available Leave:</strong> {availableLeave} days
                      </Typography>
                    </Box>
                  </CardContent>
                </StyledCard>
              </Grid>

              <Grid item xs={12}>
                <StyledCard>
                  <CardContent>
                    <Typography variant="h5" sx={{ fontWeight: "bold", mb: 3 }}>
                      Leave Usage Trend
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis label={{ value: "Days Taken", angle: -90, position: "insideLeft" }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="daysTaken" stroke="#1976d2" activeDot={{ r: 8 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <Typography variant="body1" sx={{ color: "#666" }}>
                        No leave history available to display trends.
                      </Typography>
                    )}
                  </CardContent>
                </StyledCard>
              </Grid>
            </Grid>

            <StyledCard sx={{ mt: 4 }}>
              <CardContent>
                <Typography variant="h5" sx={{ fontWeight: "bold", mb: 3 }}>
                  Recent Leave History
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <TableContainer sx={{ maxHeight: "calc(100vh - 300px)", overflow: "auto" }}>
                  <Table stickyHeader sx={{ width: "100%", tableLayout: "auto" }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Days</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Start Date</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>End Date</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {leaveHistory.length > 0 ? (
                        leaveHistory.map((leave) => (
                          <TableRow key={leave._id} hover sx={{ "&:hover": { bgcolor: "#f0f0f0" } }}>
                            <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.leaveType}</TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.daysApplied}</TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(leave.startDate)}</TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(leave.endDate)}</TableCell>
                            <TableCell>
                              <Chip
                                label={leave.status || "Pending"}
                                color={
                                  leave.status === "Approved"
                                    ? "success"
                                    : leave.status === "Rejected"
                                    ? "error"
                                    : "warning"
                                }
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            No recent leave history available.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </StyledCard>
          </>
        ) : (
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, width: "100%" }}>
            <Typography variant="body1" sx={{ color: "#666" }}>
              No leave balance data available.
            </Typography>
          </Paper>
        )}

        {notifications.map((notif) => (
          <Snackbar
            key={notif.id}
            open={true}
            autoHideDuration={6000}
            onClose={() => removeNotification(notif.id)}
          >
            <Alert
              onClose={() => removeNotification(notif.id)}
              severity={notif.type}
              sx={{ width: "100%" }}
            >
              {notif.message}
            </Alert>
          </Snackbar>
        ))}
      </MainContent>
    </div>
  );
};

export default EmployeeDashboard;