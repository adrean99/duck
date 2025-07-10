import React, { useState, useEffect } from "react";
import apiClient from "../utils/apiClient";
import { io } from "socket.io-client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import {
  Box, Typography, Grid, Select, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, Button,
  TextField, Card, CardContent, CardHeader, CircularProgress, Alert
} from "@mui/material";
import { styled } from "@mui/system";

const StyledCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
}));

const StyledTable = styled(Table)(({ theme }) => ({
  minWidth: 650,
  "& .MuiTableCell-head": {
    backgroundColor: "#f5f5f5",
    fontWeight: "bold",
  },
  "& .MuiTableCell-root": {
    borderBottom: "1px solid #e0e0e0",
    padding: theme.spacing(1),
  },
}));

const AdminLeaveRoster = () => {
  const [employees, setEmployees] = useState([]);
  const [employeesLeaves, setEmployeesLeaves] = useState([]);
  const [suggestedLeaves, setSuggestedLeaves] = useState([]);
  const [counterSuggestion, setCounterSuggestion] = useState({
    startDate: "",
    endDate: "",
    leaveType: "Annual Leave",
  });
  const [newPeriod, setNewPeriod] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDirectorate, setSelectedDirectorate] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [directorates, setDirectorates] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch Data Functions
  const fetchEmployees = async () => {
    try {
      const response = await apiClient.get("/api/users", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setEmployees(response.data);
      const uniqueDirectorates = [...new Set(response.data.map(emp => emp.directorate).filter(Boolean))];
      const uniqueDepartments = [...new Set(response.data.map(emp => emp.department).filter(Boolean))];
      setDirectorates(uniqueDirectorates);
      setDepartments(uniqueDepartments);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch employees");
    }
  };

  const fetchEmployeesLeaves = async () => {
    try {
      const monthString = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
      const params = { month: monthString };
      if (selectedDirectorate !== "All") params.directorate = selectedDirectorate;
      if (selectedDepartment !== "All") params.department = selectedDepartment;
      const response = await apiClient.get("/api/leaves/approved", {
        params,
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setEmployeesLeaves(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch approved leaves");
    }
  };

  const fetchSuggestedLeaves = async () => {
    try {
      const response = await apiClient.get("/api/leave-roster/suggested", {
        params: {
          directorate: selectedDirectorate === "All" ? undefined : selectedDirectorate,
          department: selectedDepartment === "All" ? undefined : selectedDepartment,
        },
      });
      setSuggestedLeaves(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch suggested leaves");
    }
  };

  // Admin Action Handlers
  const handleSuggestPeriod = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post("/api/leave-roster/suggest", newPeriod);
      fetchSuggestedLeaves();
      setNewPeriod({ startDate: "", endDate: "", leaveType: "Annual Leave" });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to suggest leave period");
    }
  };

 // Handle counter-suggestion submission
  const handleCounterSuggest = async (periodId, employeeId) => {
    try {
      await apiClient.post(`/api/leave-roster/counter-suggest/${employeeId}/${periodId}`, counterSuggestion);
      fetchSuggestedLeaves();
      setCounterSuggestion({ startDate: "", endDate: "", leaveType: "Annual Leave" });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to counter-suggest");
    }
  };


  const handleUpdatePeriod = async (leaveId, status) => {
    try {
      await apiClient.patch(`/api/leave-roster/update-period/${leaveId}`, { status });
      fetchSuggestedLeaves();
      fetchEmployeesLeaves();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update leave period");
    }
  };

  // WebSocket Setup
  useEffect(() => {
    fetchSuggestedLeaves();

    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io("http://localhost:5000", {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("WebSocket connected for admin");
    socket.emit("joinAdmin", "admin-room");
    });

    socket.on("rosterUpdate", () => {
      fetchEmployeesLeaves();
      fetchSuggestedLeaves();
    });

    return () => socket.disconnect();
  }, []);

  // Fetch Data on Filter or Date Change
  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchEmployees(), fetchEmployeesLeaves(), fetchSuggestedLeaves()]).finally(() =>
      setIsLoading(false)
    );
  }, [selectedMonth, selectedYear, selectedDirectorate, selectedDepartment]);

  // Calendar and Leave Logic
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  const getDaysArray = () => {
    const monthStart = startOfMonth(new Date(selectedYear, selectedMonth - 1));
    const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth - 1));
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  };

  const getLeaveCode = (leaveType) => {
    switch (leaveType) {
      case "Annual Leave":
      case "Short Leave": return "L";
      case "Emergency Leave":
      case "Compassionate Leave": return "C";
      case "Maternity Leave": return "P";
      case "Terminal Leave": return "T";
      case "Sports Leave": return "S";
      case "Unpaid Leave": return "U";
      default: return "";
    }
  };

  const getLeaveColor = (leaveType) => {
    switch (leaveType) {
      case "Annual Leave":
      case "Short Leave": return "#28a745";
      case "Emergency Leave":
      case "Compassionate Leave": return "#ffc107";
      case "Maternity Leave": return "#007bff";
      case "Terminal Leave": return "#ff6347";
      case "Sports Leave": return "#20b2aa";
      case "Unpaid Leave": return "#a9a9a9";
      default: return "transparent";
    }
  };

  const getEmployeeLeaveDays = (employeeId) => {
    const leaveDays = {};
    const days = getDaysArray();
    days.forEach((day, index) => {
      leaveDays[index + 1] = { code: "", color: isWeekend(day) ? "#d3d3d3" : "transparent", status: "" };
    });

    const employeeLeaves = employeesLeaves.filter((leave) => leave.employeeId === employeeId);
    employeeLeaves.forEach((leave) => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const leaveDaysInterval = eachDayOfInterval({ start, end });
      leaveDaysInterval.forEach((leaveDay) => {
        const dayOfMonth = leaveDay.getDate();
        if (leaveDay.getMonth() + 1 === selectedMonth && leaveDay.getFullYear() === selectedYear && !isWeekend(leaveDay)) {
          leaveDays[dayOfMonth] = {
            code: getLeaveCode(leave.leaveType),
            color: getLeaveColor(leave.leaveType),
            status: "Approved",
          };
        }
      });
    });

    const employeeSuggestedLeaves = suggestedLeaves.filter((leave) => leave.employeeId === employeeId);
    employeeSuggestedLeaves.forEach((leave) => {
      if (leave.status === "Pending" || leave.status === "Counter-Suggested") {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        const leaveDaysInterval = eachDayOfInterval({ start, end });
        leaveDaysInterval.forEach((leaveDay) => {
          const dayOfMonth = leaveDay.getDate();
          if (leaveDay.getMonth() + 1 === selectedMonth && leaveDay.getFullYear() === selectedYear && !isWeekend(leaveDay)) {
            leaveDays[dayOfMonth] = {
              code: getLeaveCode(leave.leaveType),
              color: getLeaveColor(leave.leaveType),
              status: leave.status,
            };
          }
        });
      }
    });

    return leaveDays;
  };

  if (isLoading) return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <CircularProgress />
      <Typography sx={{ ml: 2 }}>Loading roster data...</Typography>
    </Box>
  );
  if (error) return (
    <Box sx={{ p: 3 }}>
      <Alert severity="error">{error}</Alert>
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: "bold" }}>
        Admin Leave Roster
      </Typography>

      {/* Filters and Calendar Controls */}
      <StyledCard>
        <CardHeader title="Filters & Calendar" />
        <CardContent>
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid item xs={12} sm={2}>
              <Typography variant="subtitle1">Month</Typography>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                fullWidth
                size="small"
              >
                {months.map((month, index) => (
                  <MenuItem key={index} value={index + 1}>{month}</MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Typography variant="subtitle1">Year</Typography>
              <Select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                fullWidth
                size="small"
              >
                {years.map((year) => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Typography variant="subtitle1">Directorate</Typography>
              <Select
                value={selectedDirectorate}
                onChange={(e) => setSelectedDirectorate(e.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="All">All</MenuItem>
                {directorates.map((dir) => (
                  <MenuItem key={dir} value={dir}>{dir}</MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Typography variant="subtitle1">Department</Typography>
              <Select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="All">All</MenuItem>
                {departments.map((dept) => (
                  <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                ))}
              </Select>
            </Grid>
          </Grid>
        </CardContent>
      </StyledCard>

      {/* Calendar View */}
      <StyledCard>
        <CardHeader title={`Leave Roster Calendar - ${months[selectedMonth - 1]} ${selectedYear}`} />
        <CardContent>
          <div className="overflow-x-auto">
            <StyledTable>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ position: "sticky", left: 0, backgroundColor: "#f5f5f5", zIndex: 1, minWidth: 150 }}>
                    Employee
                  </TableCell>
                  {getDaysArray().map((day, index) => (
                    <TableCell key={index} sx={{ textAlign: "center", minWidth: 40 }}>
                      {day.getDate()}<br />
                      <span style={{ fontSize: "0.75rem" }}>{format(day, "EEE")}</span>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {employees
                  .filter(emp => selectedDirectorate === "All" || emp.directorate === selectedDirectorate)
                  .filter(emp => selectedDepartment === "All" || emp.department === selectedDepartment)
                  .map((employee) => {
                    const leaveDays = getEmployeeLeaveDays(employee._id);
                    return (
                      <TableRow key={employee._id}>
                        <TableCell sx={{ position: "sticky", left: 0, backgroundColor: "#fff", zIndex: 1, minWidth: 150 }}>
                          {employee.name} ({employee.role})
                        </TableCell>
                        {getDaysArray().map((day, index) => {
                          const dayInfo = leaveDays[index + 1];
                          return (
                            <TableCell
                              key={index}
                              sx={{
                                textAlign: "center",
                                backgroundColor: dayInfo.color,
                                color: dayInfo.color === "transparent" ? "#000" : "#fff",
                                opacity: dayInfo.status === "Pending" || dayInfo.status === "Counter-Suggested" ? 0.6 : 1,
                                border: dayInfo.status === "Pending" || dayInfo.status === "Counter-Suggested" ? "1px dashed #000" : "none",
                              }}
                            >
                              {dayInfo.code || "-"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
              </TableBody>
            </StyledTable>
          </div>
        </CardContent>
      </StyledCard>

      {/* Legend */}
      <StyledCard>
        <CardHeader title="Key" />
        <CardContent>
          <Grid container spacing={2}>
            {[
              { color: "#28a745", label: "Annual/Short Leave (L)" },
              { color: "#ffc107", label: "Emergency/Compassionate Leave (C)" },
              { color: "#007bff", label: "Maternity Leave (P)" },
              { color: "#ff6347", label: "Terminal Leave (T)" },
              { color: "#20b2aa", label: "Sports Leave (S)" },
              { color: "#a9a9a9", label: "Unpaid Leave (U)" },
              { color: "#d3d3d3", label: "Weekend" },
              { style: { border: "1px dashed #000", backgroundColor: "transparent", opacity: 0.6 }, label: "Suggested/Counter-Suggested Leave" },
            ].map((item, index) => (
              <Grid item xs={12} sm={3} key={index}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <Box sx={{ width: 20, height: 20, mr: 1, ...item.style, backgroundColor: item.color }} />
                  <Typography>{item.label}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </StyledCard>

      {/* Suggest Leave Period Form */}
      <StyledCard>
        <CardHeader title="Suggest Leave Period" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Start Date"
                type="date"
                value={newPeriod.startDate}
                onChange={(e) => setNewPeriod({ ...newPeriod, startDate: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="End Date"
                type="date"
                value={newPeriod.endDate}
                onChange={(e) => setNewPeriod({ ...newPeriod, endDate: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="Leave Type"
                value={newPeriod.leaveType}
                onChange={(e) => setNewPeriod({ ...newPeriod, leaveType: e.target.value })}
                fullWidth
                size="small"
              >
                {["Annual Leave", "Short Leave", "Emergency Leave", "Maternity Leave", "Terminal Leave", "Compassionate Leave", "Sports Leave", "Unpaid Leave"].map((type) => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <Button variant="contained" color="primary" onClick={handleSuggestPeriod} sx={{ mt: 1 }}>
                Suggest Period
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </StyledCard>

      {/* Suggested Leaves Management */}
      <StyledCard>
        <CardHeader title="Manage Suggested Leaves" />
        <CardContent>
          <StyledTable>
            <TableHead>
          <TableRow>
            <TableCell>Employee</TableCell>
            <TableCell>Start Date</TableCell>
            <TableCell>End Date</TableCell>
            <TableCell>Leave Type</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Counter-Suggestion</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {suggestedLeaves.map((leave) => (
            <TableRow key={leave._id}>
              <TableCell>{leave.employeeName}</TableCell>
              <TableCell>{new Date(leave.startDate).toLocaleDateString()}</TableCell>
              <TableCell>{new Date(leave.endDate).toLocaleDateString()}</TableCell>
              <TableCell>{leave.leaveType}</TableCell>
              <TableCell>{leave.status}</TableCell>
              <TableCell>
                <TextField
                  type="date"
                  value={counterSuggestion.startDate}
                  onChange={(e) =>
                    setCounterSuggestion({ ...counterSuggestion, startDate: e.target.value })
                  }
                  size="small"
                  sx={{ mr: 1 }}
                />
                <TextField
                  type="date"
                  value={counterSuggestion.endDate}
                  onChange={(e) =>
                    setCounterSuggestion({ ...counterSuggestion, endDate: e.target.value })
                  }
                  size="small"
                  sx={{ mr: 1 }}
                />
                <Select
                  value={counterSuggestion.leaveType}
                  onChange={(e) =>
                    setCounterSuggestion({ ...counterSuggestion, leaveType: e.target.value })
                  }
                  size="small"
                >
                  <MenuItem value="Annual Leave">Annual Leave</MenuItem>
                  <MenuItem value="Short Leave">Short Leave</MenuItem>
                  <MenuItem value="Emergency Leave">Emergency Leave</MenuItem>
                </Select>
              </TableCell>
              <TableCell>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleCounterSuggest(leave._id, leave.employeeId)}
                  disabled={!counterSuggestion.startDate || !counterSuggestion.endDate}
                >
                  Counter-Suggest
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
          </StyledTable>
        </CardContent>
      </StyledCard>
    </Box>
  );
};

export default AdminLeaveRoster;