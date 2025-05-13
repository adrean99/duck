import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import apiClient from"../utils/apiClient";
import { useNavigate } from "react-router-dom"; // Import for redirecting
import { 
  Container, TextField, Button, Typography, Paper, MenuItem, 
  Select, FormControl, InputLabel, Table, TableHead, 
  TableBody, TableRow, TableCell, Alert 
} from "@mui/material";

const ApplyLeave = () => {
  const { token, logout } = useContext(AuthContext);  // Get token & logout from context
  const navigate = useNavigate(); // Hook for redirecting
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Fetch leave requests when component mounts or token changes
  useEffect(() => {
    const fetchLeaveRequests = async () => {
    if (!token) {
      console.log("🚨 No token found in AuthContext!");
      setLeaveRequests([]);
      return;
    }

    console.log("🚀 Fetching leave requests with token:", token);
    
    
      
      try {
        const res = await apiClient.get("/api/leaves", {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log("Fetched leave requests:", res.data);
        setLeaveRequests(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error("Error fetching leave requests:", error);
        setLeaveRequests([]);

        if (error.response?.status === 401) {
          setMessage({ type: "error", text: "Session expired. Please log in again." });
          logout(); // Clear token from context
          navigate("/login"); // Redirect to login page
        } else {
          setMessage({ type: "error", text: "Failed to fetch leave requests." });
        }
      }
    };

    fetchLeaveRequests();
  }, [token, logout, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Token in use:", token);
    if (!token) {
      setMessage({ type: "error", text: "You must be logged in to apply for leave." });
      return;
    }

    try {
      const res = await apiClient.post("/api/leaves/apply",
        { leaveType, startDate, endDate, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("Server response:", res.data);
      setLeaveRequests((prev) => [...(prev || []), res.data.leave]);
      setMessage({ type: "success", text: "Leave request submitted successfully!" });
      setLeaveType("");
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (error) {
      console.error("Error submitting leave request:", error);

      if (error.response?.status === 401) {
        setMessage({ type: "error", text: "Session expired. Please log in again." });
        logout();
        navigate("/login");
      } else {
        setMessage({ type: "error", text: "Error submitting leave request." });
      }
    }
  };

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ padding: 4, marginTop: 4 }}>
        <Typography variant="h5" gutterBottom>Apply for Leave</Typography>

        {message.text && (
          <Alert severity={message.type} sx={{ marginBottom: 2 }}>
            {message.text}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <FormControl fullWidth margin="normal">
            <InputLabel>Leave Type</InputLabel>
            <Select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} required>
              <MenuItem value="Sick Leave">Sick Leave</MenuItem>
              <MenuItem value="Annual Leave">Annual Leave</MenuItem>
              <MenuItem value="Unpaid Leave">Unpaid Leave</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </Select>
          </FormControl>
          <TextField fullWidth label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} margin="normal" required />
          <TextField fullWidth label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} margin="normal" required />
          <TextField fullWidth label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} margin="normal" required />
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ marginTop: 2 }}>Submit Request</Button>
        </form>
      </Paper>

      {/* Leave Requests Table */}
      <Paper elevation={3} sx={{ padding: 4, marginTop: 4 }}>
        <Typography variant="h6" gutterBottom>My Leave Requests</Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {leaveRequests.length > 0 ? (
              leaveRequests.map((leave, index) => (
                <TableRow key={index}>
                  <TableCell>{leave.leaveType}</TableCell>
                  <TableCell>{new Date(leave.startDate).toISOString().split("T")[0]}</TableCell>
                  <TableCell>{new Date(leave.endDate).toISOString().split("T")[0]}</TableCell>
                  <TableCell>{leave.status}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} align="center">No leave requests found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  );
};

export default ApplyLeave;
