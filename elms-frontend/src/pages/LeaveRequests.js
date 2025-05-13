import { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { Button, TextField, Container, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell } from "@mui/material";
import apiClient from "../utils/apiClient";
const LeaveRequests = () => {
  const { user } = useContext(AuthContext);
  const [leaves, setLeaves] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  // Fetch leave requests
  useEffect(() => {
    const fetchLeaves = async () => {
      const res = await apiClient.get("/api/leaves", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setLeaves(res.data);
    };
    fetchLeaves();
  }, []);
  
  // Apply for leave
  const applyForLeave = async () => {
    try {
      const response = await apiClient.post(
        "/api/leaves/apply",
        { startDate, endDate, reason },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      console.log("Leave applied:", response.data);
      // Optionally refresh leaves or show success message
    } catch (error) {
      console.error("Error applying for leave:", error);
    }
  };

  // Approve/Reject leave
  const updateLeaveStatus = async (id, status) => {
    try {
      await apiClient.put(
        `/api/leaves/${id}`,
        { status },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      window.location.reload();
    } catch (error) {
      console.error("Error updating leave status:", error);
    }
  };

  return (
    <Container maxWidth="md" className="mt-10">
      <Paper className="p-6 shadow-lg">
        <Typography variant="h5" className="mb-4">Leave Requests</Typography>

        {/* Apply for Leave (Employee) */}
        {user?.role === "Employee" && (
          <div className="mb-6">
            <Typography variant="h6">Apply for Leave</Typography>
            <TextField label="Start Date" type="date" fullWidth value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mb-4" />
            <TextField label="End Date" type="date" fullWidth value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mb-4" />
            <TextField label="Reason" fullWidth value={reason} onChange={(e) => setReason(e.target.value)} className="mb-4" />
            <Button variant="contained" color="primary" onClick={applyForLeave}>Submit Request</Button>
          </div>
        )}

        {/* Leave Requests Table (For All Roles) */}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Status</TableCell>
              
            </TableRow>
          </TableHead>
          <TableBody>
            {leaves.map((leave) => (
              <TableRow key={leave._id}>
                <TableCell>{leave.employeeId?.name || "N/A"}</TableCell>
                <TableCell>{leave.startDate.split("T")[0]}</TableCell>
                <TableCell>{leave.endDate.split("T")[0]}</TableCell>
                <TableCell>{leave.status}</TableCell>
                {user?.role === "Supervisor" && leave.status === "Pending" && (
                  <TableCell>
                    <Button color="success" onClick={() => updateLeaveStatus(leave._id, "Approved")}>Approve</Button>
                    <Button color="error" onClick={() => updateLeaveStatus(leave._id, "Rejected")}>Reject</Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  );
};

export default LeaveRequests;
