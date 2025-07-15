import { useState, useEffect, useMemo, useCallback, useContext } from "react";
import { AuthContext } from '../context/AuthContext';
import apiClient from "../utils/apiClient";
import { io } from "socket.io-client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import {
  Box, Typography, Grid, Select, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, Button,
  TextField, Card, CardContent, CardHeader, CircularProgress, Alert, Dialog, DialogActions, DialogContent, DialogTitle,
} from "@mui/material";
import { styled } from "@mui/system";
import { Navigate } from 'react-router-dom';

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
  const { user, token, isLoading } = useContext(AuthContext);
  const [employees, setEmployees] = useState([]);
  const [employeesLeaves, setEmployeesLeaves] = useState([]);
  const [suggestedLeaves, setSuggestedLeaves] = useState([]);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [employeeLeaveDays, setEmployeeLeaveDays] = useState({});
  const [counterSuggestions, setCounterSuggestions] = useState({});
  const [newPeriod, setNewPeriod] = useState({ startDate: "", endDate: "", leaveType: "Annual Leave" });
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDirectorate, setSelectedDirectorate] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [departments, setDepartments] = useState([]);
  const [directorates, setDirectorates] = useState([]);
  const [departmentData, setDepartmentData] = useState({});
  const [isLoadingRoster, setIsLoadingRoster] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);

  const isPrivilegedRole = ['Admin', 'Director', 'DepartmentalHead', 'HRDirector'].includes(user?.role);

  useEffect(() => {
  const fetchData = async () => {
    try {
      const [empRes, suggRes, apprRes] = await Promise.all([
        apiClient.get('/employees', { params: { role: 'Employee' } }),
        apiClient.get('/suggested-leaves', { params: { department: selectedDepartment, directorate: selectedDirectorate } }),
        apiClient.get('/approved-leaves', { params: { department: selectedDepartment, directorate: selectedDirectorate } }),
      ]);
      setEmployees(empRes.data);
      setSuggestedLeaves(suggRes.data);
      setApprovedLeaves(apprRes.data);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };
  fetchData();
}, [selectedDepartment, selectedDirectorate]);
  
  const fetchDepartmentsAndDirectorates = async () => {
  try {
    const response = await apiClient.get("/api/metadata", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { departments, directorates: deptDirectorates } = response.data;
    setDepartments(departments.length ? ["All", ...departments] : ["All"]);
    setDepartmentData(deptDirectorates || {});

    // Normalize strings for comparison
    const normalizeString = (str) => (str || "").toLowerCase().trim();

    // Find the full department name matching user.department
    if (user?.department) {
      const userDept = normalizeString(user.department);
      const matchingDept = departments.find((dept) =>
        normalizeString(dept).includes(userDept)
      );
      const initialDept = matchingDept || "All";
      setSelectedDepartment(initialDept);
      console.log("Initial selectedDepartment:", initialDept); // Debug log
    } else {
      setSelectedDepartment("All");
    }

    // Set selectedDirectorate to user.directorate or "All"
    const initialDir = user?.directorate || "All";
    setSelectedDirectorate(initialDir);
    console.log("Initial selectedDirectorate:", initialDir); // Debug log
  } catch (err) {
    setError("Failed to fetch departments and directorates: " + (err.response?.data?.error || err.message));
    setDepartments(["All"]);
    setSelectedDepartment("All");
    setSelectedDirectorate("All");
  }
};

  useEffect(() => {
    if (selectedDepartment && selectedDepartment !== "All") {
      const deptDirectorates = departmentData[selectedDepartment] || [];
      setDirectorates(deptDirectorates.length ? ["All", ...deptDirectorates] : []);
      setSelectedDirectorate(deptDirectorates.length ? "All" : "");
    } else {
      setDirectorates([]);
      setSelectedDirectorate("");
    }
  }, [selectedDepartment, departmentData]);

  const fetchEmployees = async () => {
    try {
      const response = await apiClient.get("/api/profiles", {
        headers: { Authorization: `Bearer ${token}` },
        params: { role: 'Employee' }
      });
      console.log('Fetched employees:', response.data);
      setEmployees(response.data);
      return response.data;
    } catch (err) {
      setError("Failed to fetch employees: " + (err.response?.data?.error || err.message));
      console.error('Fetch employees error:', err);
      return [];
    }
  };

  const fetchEmployeesLeaves = async () => {
    try {
      const monthString = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
      const params = { month: monthString };
      if (selectedDirectorate && selectedDirectorate !== "All") params.directorate = selectedDirectorate;
      if (selectedDepartment && selectedDepartment !== "All") params.department = selectedDepartment;
      const response = await apiClient.get("/api/leaves/approved", {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
       console.log('Fetched approved leaves:', response.data);
      setEmployeesLeaves(response.data);
    } catch (err) {
      setError("Failed to fetch approved leaves: " + (err.response?.data?.error || err.message));
      console.error('Fetch approved leaves error:', err);
    }
  };

 const fetchSuggestedLeavePeriods = async () => {
  try {
    const params = {};
    if (selectedDepartment && selectedDepartment !== "All") params.department = selectedDepartment;
    if (selectedDirectorate && selectedDirectorate !== "All") params.directorate = selectedDirectorate;
    console.log("Fetching suggested leaves with params:", params); // Debug log
    const response = await apiClient.get("/api/leave-roster/suggested", {
      params,
      headers: { Authorization: `Bearer ${token}` },
    });
    const suggestedLeaves = response.data
      .filter((leave) => leave.startDate && leave.endDate && leave.employeeId && leave.employeeId._id)
      .map((leave) => ({
        _id: leave._id || `${Date.now()}`,
        employeeId: {
          _id: leave.employeeId._id || "unknown",
          name: leave.employeeId.name || "Unknown",
          department: leave.employeeId.department || "Unknown",
          directorate: leave.employeeId.directorate || "Unknown",
        },
        startDate: leave.startDate,
        endDate: leave.endDate,
        leaveType: leave.leaveType || "Unknown",
        status: leave.status || "Pending",
      }));
    console.log("Fetched suggested leaves:", suggestedLeaves);
    setSuggestedLeaves(suggestedLeaves);
    return suggestedLeaves;
  } catch (err) {
    setError("Failed to fetch suggested leave periods: " + (err.response?.data?.error || err.message));
    console.error("Fetch suggested leaves error:", err);
    return [];
  }
};

  const handleSuggestPeriod = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) {
      setError("Please select an employee");
      return;
    }
    if (!newPeriod.startDate || !newPeriod.endDate) {
      setError("Start and end dates are required");
      return;
    }
    if (new Date(newPeriod.endDate) <= new Date(newPeriod.startDate)) {
      setError("End date must be after start date");
      return;
    }
    setOpenDialog(false);
    try {
      const response = await apiClient.post(`/api/leave-roster/suggest/${selectedEmployee}`, {
        startDate: newPeriod.startDate,
        endDate: newPeriod.endDate,
        leaveType: newPeriod.leaveType,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const newLeave = {
        _id: response.data.roster.periods[response.data.roster.periods.length - 1]._id,
        employeeId: {
          _id: selectedEmployee,
          name: employees.find(emp => emp.userId === selectedEmployee)?.name || "Unknown",
          department: employees.find(emp => emp.userId === selectedEmployee)?.department || "Unknown",
          directorate: employees.find(emp => emp.userId === selectedEmployee)?.directorate || "Unknown",
        },
        startDate: newPeriod.startDate,
        endDate: newPeriod.endDate,
        leaveType: newPeriod.leaveType,
        status: "Pending",
      };
      console.log('Suggested new leave:', newLeave);
      setSuggestedLeaves((prev) => [...prev, newLeave]);
      setNewPeriod({ startDate: "", endDate: "", leaveType: "Annual Leave" });
      setSelectedEmployee("");
    } catch (err) {
      setError("Failed to suggest leave period: " + (err.response?.data?.error || err.message));
      console.error('Suggest period error:', err);
    }
  };

  const handleCounterSuggest = async (periodId, employeeId) => {
    const suggestion = counterSuggestions[periodId] || { startDate: "", endDate: "", leaveType: "Annual Leave" };
    if (!suggestion.startDate || !suggestion.endDate || !suggestion.leaveType) {
      setError("Start date, end date, and leave type are required for counter-suggestion");
      return;
    }
    try {
      const response = await apiClient.put(`/api/leave-roster/suggest/${periodId}`, {
        startDate: suggestion.startDate,
        endDate: suggestion.endDate,
        leaveType: suggestion.leaveType,
        status: "Counter-Suggested",
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Counter-suggested leave:', response.data);
      setSuggestedLeaves((prev) => prev.map((leave) => (leave._id === periodId ? {
        ...leave,
        startDate: response.data.startDate,
        endDate: response.data.endDate,
        leaveType: response.data.leaveType,
        status: response.data.status,
      } : leave)));
    } catch (err) {
      setError("Failed to counter-suggest: " + (err.response?.data?.error || err.message));
      console.error('Counter-suggest error:', err);
    }
  };

  const handleUpdatePeriod = async (rosterId, periodId, status) => {
    try {
      const response = await apiClient.patch(`/api/leave-roster/update-period/${rosterId}/${periodId}`, { status }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Updated period status:', response.data);
      await fetchSuggestedLeavePeriods();
      await fetchEmployeesLeaves();
    } catch (err) {
      setError("Failed to update leave period: " + (err.response?.data?.error || err.message));
      console.error('Update period error:', err);
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!user || !token || !user.id || !isPrivilegedRole) {
      setError("Please log in with a privileged role to access this page");
      console.error("Socket.io initialization skipped: missing user, token, user ID, or not privileged");
      return;
    }

    const socket = io("http://localhost:5000", {
      auth: { token },
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log('Socket.io connected:', socket.id);
      socket.emit("joinAdmin", "admin-room");
      console.log('Joined room: admin-room');
    });

    socket.on("leaveSuggested", (newLeave) => {
      console.log('Received leaveSuggested:', newLeave);
      setSuggestedLeaves((prev) => {
        if (!prev.some((leave) => leave._id === newLeave._id)) {
          return [...prev, newLeave];
        }
        return prev;
      });
    });

    socket.on("connect_error", (err) => {
      console.error('Socket.io connection error:', err.message);
      setError(`Socket.io connection failed: ${err.message}`);
    });

    socket.on("error", (err) => {
      console.error('Socket.io error:', err.message);
      setError(`Socket.io error: ${err.message}`);
    });

    socket.on("disconnect", (reason) => {
      console.log('WebSocket disconnected. Reason:', reason);
      setError(`WebSocket disconnected: ${reason}`);
    });

    const interval = setInterval(() => {
      fetchSuggestedLeavePeriods().then((data) => setSuggestedLeaves(data || []));
    }, 30000);

    const fetchAllData = async () => {
      try {
        const employeesData = await fetchEmployees();
        await fetchDepartmentsAndDirectorates();
        await fetchEmployeesLeaves();
        const suggestedLeavesData = await fetchSuggestedLeavePeriods();
        setSuggestedLeaves(suggestedLeavesData || []);
      } catch (err) {
        setError("Failed to fetch initial data: " + (err.message || "Unknown error"));
      } finally {
        setIsLoadingRoster(false);
      }
    };
    fetchAllData();

    return () => {
      socket.disconnect();
      console.log('Socket.io disconnected');
      clearInterval(interval);
    };
  },  [user, token, isLoading]);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  const getDaysArray = useCallback(() => {
    const firstDay = startOfMonth(new Date(selectedYear, selectedMonth - 1));
    const lastDay = endOfMonth(new Date(selectedYear, selectedMonth - 1));
    return eachDayOfInterval({ start: firstDay, end: lastDay });
  }, [selectedMonth, selectedYear]);

  const getLeaveCode = (leaveType) => ({
    "Annual Leave": "L", "Short Leave": "L",
    "Emergency Leave": "C", "Compassionate Leave": "C",
    "Maternity Leave": "P", "Terminal Leave": "T",
    "Sports Leave": "S", "Unpaid Leave": "U",
  }[leaveType] || "-");

  const getLeaveColor = (leaveType) => ({
    "Annual Leave": "#28a745", "Short Leave": "#28a745",
    "Emergency Leave": "#ffc107", "Compassionate Leave": "#ffc107",
    "Maternity Leave": "#007bff", "Terminal Leave": "#ff6347",
    "Sports Leave": "#20b2aa", "Unpaid Leave": "#a9a9a9",
  }[leaveType] || "transparent");

   const normalizeString = (str) => (str || '').toLowerCase().trim();

  const filteredEmployees = useMemo(() => {
  const normalizeString = (str) => (str || "").toLowerCase().trim();
  const selDept = normalizeString(selectedDepartment);
  const selDir = normalizeString(selectedDirectorate);

  return employees.filter((emp) => {
    const empDept = normalizeString(emp.department);
    const empDir = normalizeString(emp.directorate || "");
    const deptMatch = selectedDepartment === "All" || empDept.includes(selDept);
    const dirMatch = selectedDirectorate === "All" || empDir === selDir;
    const match = deptMatch && dirMatch;
    if (!match) {
      console.log(
        `Employee filtered out: ${emp.name}, dept: ${empDept}, dir: ${empDir}, selDept: ${selDept}, selDir: ${selDir}`
      );
      } else {
      console.log(
        `Employee included: ${emp.name}, dept: "${empDept}", dir: "${empDir}"`
      );
    }
    return match;
  });
}, [employees, selectedDepartment, selectedDirectorate]);

  const processSuggestedLeaves = useCallback((leaves) => {
    const leaveDays = {};
    leaves.forEach((leave) => {
      if (!leave || !leave.startDate || !leave.endDate || !leave.employeeId || !leave.employeeId._id) {
        console.log('Invalid leave data:', leave);
        return;
      }
      const employee = employees.find((emp) => emp.userId === leave.employeeId._id);
       if (!employee) {
        console.log('Employee not found for leave:', leave.employeeId._id);
        return;
      }
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.log('Invalid dates for leave:', leave);
        return;
      }
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateKey = `${leave.employeeId._id}_${d.toISOString().split("T")[0]}`;
        leaveDays[dateKey] = {
          code: getLeaveCode(leave.leaveType),
          color: getLeaveColor(leave.leaveType),
          status: leave.status,
        };
      }
    });
    console.log('Processed leave days:', leaveDays);
    return leaveDays;
  }, [employees]);

  const filteredSuggestedLeaves = useMemo(() => {
    const filtered = suggestedLeaves.filter((leave) => {
      const employee = employees.find((emp) => emp.userId === leave.employeeId._id);
      if (!employee) {
        console.log('Employee not found for suggested leave:', leave.employeeId._id);
        return false;
      }
      const empDept = normalizeString(employee.department);
      const empDir = normalizeString(employee.directorate);
      const selDept = normalizeString(selectedDepartment);
      const selDir = normalizeString(selectedDirectorate);
      const deptMatch = selectedDepartment === "All" || empDept === selDept;
      const dirMatch = selectedDirectorate === "All" || empDir === selDir;
      if (!deptMatch || !dirMatch) {
        console.log(`Suggested leave filtered out: ${leave.employeeId.name}, dept: ${empDept}, dir: ${empDir}, selDept: ${selDept}, selDir: ${selDir}`);
      }
      return deptMatch && dirMatch;
    });
    console.log('Filtered suggested leaves:', filtered);
    return filtered;
  }, [suggestedLeaves, employees, selectedDepartment, selectedDirectorate]);

  useEffect(() => {
    const newLeaveDays = processSuggestedLeaves(suggestedLeaves);
    setEmployeeLeaveDays((prev) => {
      const isDifferent = Object.keys(newLeaveDays).some(
        (key) => !prev[key] || prev[key].code !== newLeaveDays[key].code || prev[key].color !== newLeaveDays[key].color || prev[key].status !== newLeaveDays[key].status
      );
      return isDifferent ? newLeaveDays : prev;
    });
  }, [suggestedLeaves, processSuggestedLeaves]);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading authentication...</Typography>
      </Box>
    );
  }

  if (!user || !token || !user.id || !isPrivilegedRole) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Admin Leave Roster
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {isLoadingRoster && (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading roster data...</Typography>
        </Box>
      )}
      <StyledCard>
        <CardHeader title="Filters & Calendar" />
        <CardContent>
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid item xs={12} sm={2}>
              <Typography variant="subtitle1">Month</Typography>
              <Select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} fullWidth size="small">
                {months.map((month, index) => (<MenuItem key={index} value={index + 1}>{month}</MenuItem>))}
              </Select>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Typography variant="subtitle1">Year</Typography>
              <Select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} fullWidth size="small">
                {years.map((year) => (<MenuItem key={year} value={year}>{year}</MenuItem>))}
              </Select>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Typography variant="subtitle1">Department</Typography>
              <Select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                fullWidth
                size="small"
                displayEmpty
                renderValue={(selected) => selected || "Select Department"}
              >
                <MenuItem value="" disabled>Select Department</MenuItem>
                {departments.map((dept) => (
                  <MenuItem key={dept} value={dept}>{dept}</MenuItem>
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
                displayEmpty
                disabled={!selectedDepartment || selectedDepartment === "All"}
                renderValue={(selected) => selected || "Select Directorate"}
              >
                <MenuItem value="" disabled>Select Directorate</MenuItem>
                {directorates.map((dir) => (
                  <MenuItem key={dir} value={dir}>{dir}</MenuItem>
                ))}
              </Select>
            </Grid>
          </Grid>
        </CardContent>
      </StyledCard>

      <StyledCard>
        <CardHeader title={`Leave Roster Calendar - ${months[selectedMonth - 1]} ${selectedYear}`} />
        <CardContent>
          <Box sx={{ overflowX: "auto" }}>
            <StyledTable>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ position: "sticky", left: 0, backgroundColor: "#f5f5f5", zIndex: 1, minWidth: 150 }}>Employee</TableCell>
                  {getDaysArray().map((day) => (
                    <TableCell key={day.toISOString()} sx={{ textAlign: "center", minWidth: 40, padding: "8px" }}>
                      {format(day, "d")}<br /><span style={{ fontSize: "0.75rem" }}>{format(day, "EEE")}</span>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.userId}>
                      <TableCell sx={{ position: "sticky", left: 0, backgroundColor: "#fff", zIndex: 1, minWidth: 150 }}>
                        {employee.name} ({employee.role})
                      </TableCell>
                      {getDaysArray().map((day) => {
                        const dayKey = `${employee.userId}_${day.toISOString().split("T")[0]}`;
                        const dayInfo = employeeLeaveDays[dayKey] || {
                          code: "-",
                          color: day.getDay() === 0 || day.getDay() === 6 ? "#d3d3d3" : "transparent",
                          status: "",
                        };
                        return (
                          <TableCell
                            key={dayKey}
                            sx={{
                              textAlign: "center",
                              backgroundColor: dayInfo.color,
                              color: dayInfo.color === "transparent" ? "#000" : "#fff",
                              opacity: ["Suggested", "Counter-Suggested"].includes(dayInfo.status) ? 0.6 : 1,
                              border: ["Suggested", "Counter-Suggested"].includes(dayInfo.status) ? "1px dashed #000" : "none",
                              padding: "8px",
                            }}
                          >
                            {dayInfo.code}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={getDaysArray().length + 1} sx={{ textAlign: "center" }}>
                      No employees to display
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </StyledTable>
          </Box>
        </CardContent>
      </StyledCard>

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

      <StyledCard>
        <CardHeader title="Suggest Leave Period" />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="Employee"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                fullWidth
                size="small"
                required
              >
                <MenuItem value="">Select Employee</MenuItem>
                {employees.map((emp) => (
                  <MenuItem key={emp.userId} value={emp.userId}>
                    {emp.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
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
              <Button variant="contained" color="primary" onClick={() => setOpenDialog(true)} sx={{ mt: 1 }}>
                Suggest Period
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </StyledCard>

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
              {filteredSuggestedLeaves.length > 0 ? (
                filteredSuggestedLeaves.map((leave) => {
                  const suggestion = counterSuggestions[leave._id] || {
                    startDate: leave.startDate ? format(new Date(leave.startDate), "yyyy-MM-dd") : "",
                    endDate: leave.endDate ? format(new Date(leave.endDate), "yyyy-MM-dd") : "",
                    leaveType: leave.leaveType || "Annual Leave",
                  };
                  return (
                    <TableRow key={leave._id}>
                      <TableCell>{leave.employeeId?.name || "Unknown"}</TableCell>
                      <TableCell>{leave.startDate ? format(new Date(leave.startDate), "yyyy-MM-dd") : "N/A"}</TableCell>
                      <TableCell>{leave.endDate ? format(new Date(leave.endDate), "yyyy-MM-dd") : "N/A"}</TableCell>
                      <TableCell>{leave.leaveType || "N/A"}</TableCell>
                      <TableCell>{leave.status || "Pending"}</TableCell>
                      <TableCell>
                        <TextField
                          type="date"
                          value={suggestion.startDate}
                          onChange={(e) => setCounterSuggestions((prev) => ({
                            ...prev,
                            [leave._id]: { ...prev[leave._id], startDate: e.target.value },
                          }))}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <TextField
                          type="date"
                          value={suggestion.endDate}
                          onChange={(e) => setCounterSuggestions((prev) => ({
                            ...prev,
                            [leave._id]: { ...prev[leave._id], endDate: e.target.value },
                          }))}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Select
                          value={suggestion.leaveType}
                          onChange={(e) => setCounterSuggestions((prev) => ({
                            ...prev,
                            [leave._id]: { ...prev[leave._id], leaveType: e.target.value },
                          }))}
                          size="small"
                        >
                          {["Annual Leave", "Short Leave", "Emergency Leave", "Maternity Leave", "Terminal Leave", "Compassionate Leave", "Sports Leave", "Unpaid Leave"].map((type) => (
                            <MenuItem key={type} value={type}>{type}</MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => handleCounterSuggest(leave._id, leave.employeeId._id || leave.employeeId)}
                          disabled={!suggestion.startDate || !suggestion.endDate || !suggestion.leaveType}
                        >
                          Counter-Suggest
                        </Button>
                        <Button
                          variant="contained"
                          color="success"
                          onClick={() => handleUpdatePeriod(leave._id, "Confirmed")}
                          sx={{ ml: 1 }}
                          disabled={leave.status === "Confirmed"}
                        >
                          Approve
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: "center" }}>
                    No suggested leaves to display
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </StyledTable>
        </CardContent>
      </StyledCard>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Suggest Leave Period</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="Employee"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                fullWidth
                size="small"
                required
              >
                <MenuItem value="">Select Employee</MenuItem>
                {employees.map((emp) => (
                  <MenuItem key={emp.userId} value={emp.userId}>
                    {emp.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSuggestPeriod} variant="contained" color="primary">Suggest</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminLeaveRoster;