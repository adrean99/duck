import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import apiClient from "../utils/apiClient";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  TextField,
  Button,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Alert,
  Box,
  TableContainer,
  Chip,
  Tooltip,
  Grid,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import InfoIcon from "@mui/icons-material/Info";
import Sidebar from "../components/Sidebar";
import { styled } from "@mui/system";

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
};

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: "#1976d2",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  zIndex: 1201, // Ensure AppBar is above Sidebar Drawer
  position: "fixed",
}));

// Main content wrapper to account for potential AppBar height
const MainContent = styled(Box)(({ theme }) => ({
  marginTop: "64px", // Assumes AppBar height (adjust if different)
  height: "calc(100vh - 64px)", // Full height minus AppBar
  width: "100%",
  overflow: "auto", // Handle overflow
}));

const AnnualLeave = () => {
  const { user, logout, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [employeeName, setEmployeeName] = useState("");
  const [personNumber, setPersonNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [directorate, setDirectorate] = useState("");
  const [daysApplied, setDaysApplied] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [addressWhileAway, setAddressWhileAway] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [reason, setReason] = useState("");
  const [directorName, setDirectorName] = useState("");
  const [departmentalHeadName, setDepartmentalHeadName] = useState("");
  const [HRDirectorName, setHRDirectorName] = useState("");
  const [leaveBalance, setLeaveBalance] = useState({ leaveBalanceBF: 0, currentYearLeave: 0, leaveTakenThisYear: 0 });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [comments, setComments] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState({ leaveId: "", status: "" });

  const localToken = localStorage.getItem("token");
  const localUser = JSON.parse(localStorage.getItem("user") || "null");
  const effectiveToken = token || localToken;
  const effectiveUser = user || localUser;

  console.log("AnnualLeave rendering - Token:", effectiveToken, "User:", effectiveUser);

  useEffect(() => {
    if (!effectiveToken || !effectiveUser) {
      navigate("/login");
      return;
    }

    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const profileRes = await apiClient.get("/api/profiles", {
          headers: { Authorization: `Bearer ${effectiveToken}` },
        });
        const profile = profileRes.data;
        console.log("Profile fetched:", profile);
        setEmployeeName(profile.name || "");
        setPersonNumber(profile.personNumber || "");
        setDepartment(profile.department || "");
        setDirectorate(profile.directorate || "");
        setEmailAddress(profile.email || "");
        setPhoneNumber(profile.phoneNumber || "");
        setDirectorName(profile.directorName || "");
        setDepartmentalHeadName(profile.departmentalHeadName || "");
        setHRDirectorName(profile.HRDirectorName || "");

        const balanceRes = await apiClient.get("/api/leave-balances", {
          headers: { Authorization: `Bearer ${effectiveToken}` },
        });
        console.log("Leave balance fetched:", balanceRes.data);
        setLeaveBalance({
          leaveBalanceBF: balanceRes.data.leaveBalanceBF || 0,
          currentYearLeave: balanceRes.data.currentYearLeave || 0,
          leaveTakenThisYear: balanceRes.data.leaveTakenThisYear || 0,
        });

        const leavesRes = await apiClient.get("/api/leaves/my-leaves?leaveType=Annual%20Leave", {
          headers: { Authorization: `Bearer ${effectiveToken}` },
        });
        console.log("Leave requests fetched:", leavesRes.data);
        setLeaveRequests(Array.isArray(leavesRes.data) ? leavesRes.data : []);

        if (["Director", "DepartmentalHead", "HRDirector"].includes(effectiveUser.role)) {
          const pendingRes = await apiClient.get("/api/leaves/pending-approvals", {
            headers: { Authorization: `Bearer ${effectiveToken}` },
          });
          console.log("Pending approvals fetched:", pendingRes.data);
          setPendingApprovals(Array.isArray(pendingRes.data) ? pendingRes.data : []);
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
        setMessage({ type: "error", text: "Failed to fetch initial data: " + (error.response?.data?.error || error.message) });
        if (error.response?.status === 401) {
          logout();
          navigate("/login");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const countWorkingDays = (start, end) => {
    let count = 0;
    let current = new Date(start);
    const holidays = [];
    while (current <= end) {
      const day = current.getUTCDay();
      if (day !== 0 && day !== 6 && !holidays.some(h => h.toDateString() === current.toDateString())) {
        count++;
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return count;
  };

  const validateForm = () => {
    if (!employeeName || !personNumber || !department || !daysApplied || !startDate || !endDate || !reason) {
      setMessage({ type: "error", text: "All required fields must be filled" });
      return false;
    }

    const days = Number(daysApplied);
    if (!Number.isInteger(days) || days <= 0 || days > 30) {
      setMessage({ type: "error", text: "Days applied must be between 1 and 30" });
      return false;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setMessage({ type: "error", text: "Invalid start or end date" });
      return false;
    }

    if (start > end) {
      setMessage({ type: "error", text: "Start date cannot be after end date" });
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start - today < 7 * 24 * 60 * 60 * 1000) {
      setMessage({ type: "error", text: "Annual leave must be submitted at least 7 days in advance" });
      return false;
    }

    const workingDays = countWorkingDays(start, end);
    if (workingDays !== days) {
      setMessage({
        type: "error",
        text: `Days applied (${days}) must match working days (${workingDays}) between dates (excluding weekends/holidays)`,
      });
      return false;
    }

    const availableDays = leaveBalance.leaveBalanceBF + leaveBalance.currentYearLeave - leaveBalance.leaveTakenThisYear;
    if (days > availableDays) {
      setMessage({ type: "error", text: "Insufficient leave balance" });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    if (!effectiveToken || !effectiveUser) {
      navigate("/login");
      return;
    }

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const res = await apiClient.post(
        "/api/leaves/apply",
        {
          leaveType: "Annual Leave",
          employeeName,
          personNumber,
          department,
          directorate,
          daysApplied: Number(daysApplied),
          startDate,
          endDate,
          addressWhileAway,
          emailAddress,
          phoneNumber,
          reason,
          leaveBalanceBF: leaveBalance.leaveBalanceBF,
          currentYearLeave: leaveBalance.currentYearLeave,
          leaveTakenThisYear: leaveBalance.leaveTakenThisYear,
          directorName,
          departmentalHeadName,
          HRDirectorName,
        },
        { headers: { Authorization: `Bearer ${effectiveToken}` } }
      );
      console.log("Leave submitted:", res.data);
      setLeaveRequests(prev => [...prev, res.data.leave]);
      setMessage({ type: "success", text: "Annual leave submitted!" });
      setDaysApplied("");
      setStartDate("");
      setEndDate("");
      setAddressWhileAway("");
      setReason("");
    } catch (error) {
      console.error("Error submitting annual leave:", error);
      setMessage({ type: "error", text: error.response?.data?.error || "Error submitting annual leave." });
      if (error.response?.status === 401) {
        logout();
        navigate("/login");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovalConfirm = (leaveId, status) => {
    setDialogData({ leaveId, status });
    setDialogOpen(true);
  };

  const handleApproval = async () => {
    const { leaveId, status } = dialogData;
    const comment = comments[leaveId] || "";
    try {
      const res = await apiClient.put(
        `/api/leaves/approve/${leaveId}`,
        { status, comment },
        { headers: { Authorization: `Bearer ${effectiveToken}` } }
      );
      console.log("Approval updated:", res.data);
      setPendingApprovals(prev => prev.filter(l => l._id !== leaveId));
      setLeaveRequests(prev => prev.map(l => l._id === leaveId ? res.data.leave : l));
      setComments(prev => { const newComments = { ...prev }; delete newComments[leaveId]; return newComments; });
      setMessage({ type: "success", text: `Leave ${status.toLowerCase()}!` });
    } catch (error) {
      console.error("Error updating approval:", error);
      setMessage({ type: "error", text: error.response?.data?.error || "Error updating approval." });
      if (error.response?.status === 401) {
        logout();
        navigate("/login");
      }
    } finally {
      setDialogOpen(false);
    }
  };

  if (!effectiveToken || !effectiveUser) {
    navigate("/login");
    return null;
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  const availableDays = leaveBalance.leaveBalanceBF + leaveBalance.currentYearLeave - leaveBalance.leaveTakenThisYear;

  const getStatusChip = (status) => {
    const statusValue = status || "Pending";
    switch (statusValue) {
      case "Approved":
        return <Chip label="Approved" color="success" size="small" icon={<CheckCircleIcon />} />;
      case "Rejected":
        return <Chip label="Rejected" color="error" size="small" icon={<CancelIcon />} />;
      case "Pending":
      default:
        return <Chip label="Pending" color="warning" size="small" />;
    }
  };

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
            Annual Leave Application
          </Typography>
          <Typography variant="subtitle1" sx={{ color: "#fff", fontWeight: "medium" }}>
            {effectiveUser?.role || "Employee"}
          </Typography>
        </Toolbar>
      </StyledAppBar>

    <MainContent>
      {effectiveUser.role === "Employee" && (
        <Paper elevation={3} sx={{ p: 4, width: "100%", borderRadius: 0, boxSizing: "border-box", boxShadow: 5 }}>
         
          {message.text && <Alert severity={message.type}>{message.text}</Alert>}
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Name"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  sx={{ mb: 2 }}
                  required
                  helperText="Your full name"
                  aria-label="Employee Name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="P/F No."
                  value={personNumber}
                  onChange={(e) => setPersonNumber(e.target.value)}
                  sx={{ mb: 2 }}
                  required
                  helperText="Your personnel number"
                  aria-label="Person Number"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  sx={{ mb: 2 }}
                  required
                  helperText="Your department"
                  aria-label="Department"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Directorate"
                  value={directorate}
                  onChange={(e) => setDirectorate(e.target.value)}
                  sx={{ mb: 2 }}
                  helperText="Your directorate (optional)"
                  aria-label="Directorate"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Days Applied"
                  type="number"
                  value={daysApplied}
                  onChange={(e) => setDaysApplied(e.target.value)}
                  sx={{ mb: 2 }}
                  required
                  inputProps={{ min: 1, max: 30 }}
                  helperText="Number of working days (1-30)"
                  aria-label="Days Applied"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ mb: 2 }}
                  required
                  helperText="Select start date"
                  aria-label="Start Date"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ mb: 2 }}
                  required
                  helperText="Select end date"
                  aria-label="End Date"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address While Away"
                  value={addressWhileAway}
                  onChange={(e) => setAddressWhileAway(e.target.value)}
                  sx={{ mb: 2 }}
                  helperText="Where you’ll be during leave (optional)"
                  aria-label="Address While Away"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email Address"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  sx={{ mb: 2 }}
                  helperText="Your contact email (optional)"
                  aria-label="Email Address"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone No."
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  sx={{ mb: 2 }}
                  helperText="Your contact phone number (optional)"
                  aria-label="Phone Number"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  sx={{ mb: 2 }}
                  required
                  multiline
                  rows={2}
                  helperText="Reason for your leave"
                  aria-label="Reason"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mt: 2 }} color="primary">Leave Days Computation</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Leave Balance B/F"
                  type="number"
                  value={leaveBalance.leaveBalanceBF}
                  sx={{ mb: 2 }}
                  disabled
                  helperText="Balance brought forward"
                  aria-label="Leave Balance B/F"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Current Year Leave"
                  type="number"
                  value={leaveBalance.currentYearLeave}
                  sx={{ mb: 2 }}
                  disabled
                  helperText="This year’s allocation"
                  aria-label="Current Year Leave"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Leave Taken This Year"
                  type="number"
                  value={leaveBalance.leaveTakenThisYear}
                  sx={{ mb: 2 }}
                  disabled
                  helperText="Days already taken"
                  aria-label="Leave Taken This Year"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Available Days"
                  type="number"
                  value={availableDays}
                  sx={{ mb: 2 }}
                  disabled
                  helperText="Calculated as B/F + Current - Taken"
                  aria-label="Available Days"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Director Name"
                  value={directorName}
                  onChange={(e) => setDirectorName(e.target.value)}
                  sx={{ mb: 2 }}
                  helperText="Director’s name (optional)"
                  aria-label="Director Name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Departmental Head Name"
                  value={departmentalHeadName}
                  onChange={(e) => setDepartmentalHeadName(e.target.value)}
                  sx={{ mb: 2 }}
                  helperText="Departmental Head’s name (optional)"
                  aria-label="Departmental Head Name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="HR Director Name"
                  value={HRDirectorName}
                  onChange={(e) => setHRDirectorName(e.target.value)}
                  sx={{ mb: 2 }}
                  helperText="HR Director’s name (optional)"
                  aria-label="HR Director Name"
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  sx={{ marginTop: 2, borderRadius: 2, padding: "8px 24px" }}
                  disabled={submitting}
                  aria-label="Submit Annual Leave"
                >
                  {submitting ? "Submitting..." : "Submit Annual Leave"}
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>
      )}

      <Paper elevation={3} sx={{ p: 4, width: "100%", borderRadius: 0, boxSizing: "border-box", boxShadow: 5, mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          Annual Leave Policies
          <Tooltip title="Key rules for annual leave requests" arrow>
            <IconButton size="small" sx={{ ml: 1 }}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Typography>
        <Box component="ul" sx={{ pl: 2 }}>
          <li>Maximum of 30 working days per request.</li>
          <li>Must be submitted at least 7 days in advance.</li>
          <li>Requires approval from Director, Departmental Head, and HR Director.</li>
          <li>Public Holidays, Saturdays, and Sundays are excluded; only working days count.</li>
          <li>Total annual leave capped at 30 days per year (including balance B/F and current year allocation).</li>
          <li>Total number of days brought forward is 15 days</li>
        </Box>
      </Paper>

      {["Director", "DepartmentalHead", "HRDirector"].includes(effectiveUser.role) && (
        <Paper elevation={3} sx={{ p: 4, width: "100%", borderRadius: 0, boxSizing: "border-box", boxShadow: 5, mt: 2 }}>
          <Typography variant="h6" gutterBottom>Pending Annual Leave Approvals</Typography>
          <TableContainer sx={{ maxHeight: "calc(100vh - 300px)", overflow: "auto" }}>
            <Table stickyHeader sx={{ width: "100%", tableLayout: "auto" }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Employee</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Days</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Start Date</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>End Date</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Reason</TableCell>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingApprovals.length > 0 ? (
                  pendingApprovals.map((leave) => (
                    <TableRow key={leave._id}>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.employeeName}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.daysApplied}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(leave.startDate)}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(leave.endDate)}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.reason}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        <TextField
                          label="Comment"
                          value={comments[leave._id] || ""}
                          onChange={(e) => setComments(prev => ({ ...prev, [leave._id]: e.target.value }))}
                          size="small"
                          sx={{ mr: 1, width: "200px" }}
                          aria-label={`Comment for ${leave.employeeName}`}
                        />
                        <Button
                          onClick={() => handleApprovalConfirm(leave._id, "Approved")}
                          variant="contained"
                          color="success"
                          size="small"
                          sx={{ mr: 1 }}
                          aria-label={`Approve leave for ${leave.employeeName}`}
                        >
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleApprovalConfirm(leave._id, "Rejected")}
                          variant="contained"
                          color="error"
                          size="small"
                          aria-label={`Reject leave for ${leave.employeeName}`}
                        >
                          Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No pending approvals.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Paper elevation={3} sx={{ p: 4, width: "100%", borderRadius: 0, boxSizing: "border-box", boxShadow: 5, mt: 2 }}>
        <Typography variant="h6" gutterBottom>My Annual Leave Requests</Typography>
        <TableContainer sx={{ maxHeight: "calc(100vh - 300px)", overflow: "auto" }}>
          <Table stickyHeader sx={{ width: "100%", tableLayout: "auto" }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Name</TableCell>
                <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>P/F No.</TableCell>
                <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Department</TableCell>
                <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Directorate</TableCell>
                <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Days</TableCell>
                <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Start Date</TableCell>
                <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>End Date</TableCell>
                <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Status</TableCell>
                <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Director</TableCell>
                <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Dept. Head</TableCell>
                <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>HR Director</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leaveRequests.length > 0 ? (
                leaveRequests.map((leave) => (
                  <TableRow
                    key={leave._id}
                    hover
                    sx={{ "&:hover": { bgcolor: "#f0f0f0", cursor: "pointer" } }}
                  >
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.employeeName}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.personNumber}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.department}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.directorate || "N/A"}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.daysApplied}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(leave.startDate)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(leave.endDate)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.reason}</TableCell>
                    <TableCell>
                      <Tooltip title={`Status: ${leave.status || "Pending"}`}>
                        {getStatusChip(leave.status)}
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.directorName || "N/A"}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.departmentalHeadName || "N/A"}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.HRDirectorName || "N/A"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    No annual leave requests found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm {dialogData.status}</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to {dialogData.status.toLowerCase()} this leave request?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="primary">Cancel</Button>
          <Button onClick={handleApproval} variant="contained" color={dialogData.status === "Approved" ? "success" : "error"}>Confirm</Button>
        </DialogActions>
      </Dialog>
    </MainContent>
    </div>
  );
};

export default AnnualLeave;