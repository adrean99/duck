import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/apiClient";
import { io } from "socket.io-client";
import {
  Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell, Button, Alert, Drawer, List, ListItem, ListItemText,
  IconButton, AppBar, Toolbar, Box, TableContainer, Chip, Divider, TextField, Grid, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Input, Select, MenuItem, FormControlLabel, Checkbox
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { styled } from "@mui/system";

// Styled components
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: "#1976d2",
  width: "100%",
  position: "fixed",
  top: 0,
  zIndex: 1201,
}));

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  "& .MuiDrawer-paper": {
    width: 250,
    backgroundColor: "#f5f5f5",
    height: "100%",
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: 6,
  textTransform: "none",
  padding: "8px 16px",
}));

const MainContent = styled(Box)(({ theme }) => ({
  marginTop: "64px", 
  height: "calc(100vh - 64px)", 
  width: "100%",
  overflow: "auto", 
  boxSizing: "border-box",
}));

const ContentPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  height: "100%",
  width: "100%",
  borderRadius: 0,
  boxSizing: "border-box",
  overflow: "auto", 
}));

const SuperAdminDashboard = () => {
  const { authState, logout } = useContext(AuthContext);
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    name: "",
    role: "Employee",
    department: "",
    sector: "",
    chiefOfficerName: "",
    supervisorName: "",
    personNumber: "",
    sectionalHeadName: "",
    departmentalHeadName: "",
    HRDirectorName: "",
    profilePicture: ""
  });
  const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0, pending: 0 });
  const [leaves, setLeaves] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchParams, setSearchParams] = useState({ employeeName: "", leaveType: "", status: "" });
  const [auditFilters, setAuditFilters] = useState({ action: "", userId: "", startDate: "", endDate: "" });
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("User Management");
  const [socket, setSocket] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editProfile, setEditProfile] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editProfileDialogOpen, setEditProfileDialogOpen] = useState(false);
  const [selectedLeaves, setSelectedLeaves] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [passwordChangeMessage, setPasswordChangeMessage] = useState({ type: "", text: "" });

  const localToken = localStorage.getItem("token");
  const effectiveToken = authState?.token || localToken;
  const effectiveUser = authState?.user || JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // WebSocket connection
  useEffect(() => {
    if (!effectiveToken) {
      navigate("/login");
      return;
    }

    const newSocket = io("http://localhost:5000", {
      auth: { token: effectiveToken },
      transports: ["websocket"],
    });

    setSocket(newSocket);

    newSocket.on("connect", () => console.log("WebSocket connected"));
    newSocket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      setMessage({ type: "error", text: "Failed to connect to real-time updates" });
    });
    newSocket.on("leaveStatusUpdate", () => fetchLeaves());
    newSocket.on("auditLogUpdate", () => fetchAuditLogs());

    return () => newSocket.disconnect();
  }, [effectiveToken]);

  // Fetch data
  const fetchUsers = async () => {
    try {
      const response = await apiClient.get("/api/users", {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      setUsers(response.data);
    } catch (error) {
      const errorMessage = error.response?.data?.error || "An error occurred";
      setMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get("/api/leaves/stats", {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      setStats(response.data);
    } catch (error) {
      const errorMessage = error.response?.data?.error || "An error occurred";
      setMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
    }
  };

  const fetchLeaves = async () => {
    try {
      const query = new URLSearchParams(searchParams).toString();
      const response = await apiClient.get(`/api/leaves/search?${query}`, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      setLeaves(response.data);
    } catch (error) {
      const errorMessage = error.response?.data?.error || "An error occurred";
      setMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const query = new URLSearchParams(auditFilters).toString();
      const response = await apiClient.get(`/api/audit-logs?${query}`, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      setAuditLogs(response.data);
    } catch (error) {
      const errorMessage = error.response?.data?.error || "An error occurred";
      setMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
    }
  };

  useEffect(() => {
    if (!effectiveToken || effectiveUser.role !== "Admin") {
      navigate("/login");
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([fetchUsers(), fetchStats(), fetchLeaves(), fetchAuditLogs()]);
      setIsLoading(false);
    };

    fetchData();
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [searchParams]);

  useEffect(() => {
    fetchAuditLogs();
  }, [auditFilters]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post("/api/users/add-user", newUser, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      fetchUsers();
      setNewUser({
        email: "", password: "", name: "", role: "Employee", department: "", sector: "", chiefOfficerName: "",
        supervisorName: "", personNumber: "", sectionalHeadName: "", departmentalHeadName: "", HRDirectorName: "", profilePicture: ""
      });
      setMessage({ type: "success", text: "User added successfully" });
      await apiClient.post("/api/audit-logs", {
        action: "ADD_USER",
        userId: effectiveUser.id,
        details: `Added user: ${newUser.email}`
      }, { headers: { Authorization: `Bearer ${effectiveToken}` } });
    } catch (error) {
      const errorMessage = error.response?.data?.error || "An error occurred";
      setMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await apiClient.delete(`/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      fetchUsers();
      setMessage({ type: "success", text: "User deleted successfully" });
      await apiClient.post("/api/audit-logs", {
        action: "DELETE_USER",
        userId: effectiveUser.id,
        details: `Deleted user: ${userId}`
      }, { headers: { Authorization: `Bearer ${effectiveToken}` } });
    } catch (error) {
      const errorMessage = error.response?.data?.error || "An error occurred";
      setMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
    }
  };

  const handleUpdateProfile = async () => {
    try {
      await apiClient.put(`/api/users/${editProfile._id}`, editProfile, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      fetchUsers();
      setEditProfileDialogOpen(false);
      setMessage({ type: "success", text: "Profile updated successfully" });
      await apiClient.post("/api/audit-logs", {
        action: "UPDATE_PROFILE",
        userId: effectiveUser.id,
        details: `Updated profile for user: ${editProfile.email}`
      }, { headers: { Authorization: `Bearer ${effectiveToken}` } });
    } catch (error) {
      const errorMessage = error.response?.data?.error || "An error occurred";
      setMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
    }
  };

  const handleImportUsers = async () => {
    if (!importFile) {
      setMessage({ type: "error", text: "Please select a file to import" });
      return;
    }
    const formData = new FormData();
    formData.append("file", importFile);
    try {
      await apiClient.post("/api/users/import-users", formData, {
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
          "Content-Type": "multipart/form-data"
        }
      });
      fetchUsers();
      setImportDialogOpen(false);
      setMessage({ type: "success", text: "Users imported successfully" });
      await apiClient.post("/api/audit-logs", {
        action: "IMPORT_USERS",
        userId: effectiveUser.id,
        details: `Imported users from file`
      }, { headers: { Authorization: `Bearer ${effectiveToken}` } });
    } catch (error) {
      const errorMessage = error.response?.data?.error || "An error occurred";
      setMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword) {
      setPasswordChangeMessage({ type: "error", text: "Please enter a new password" });
      return;
    }
    try {
      await apiClient.post(`/api/users/change-password/${selectedUser._id}`, { newPassword }, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      setPasswordChangeMessage({ type: "success", text: "Password updated successfully" });
      await apiClient.post("/api/audit-logs", {
        action: "CHANGE_PASSWORD",
        userId: effectiveUser.id,
        details: `Changed password for user: ${selectedUser.email}`
      }, { headers: { Authorization: `Bearer ${effectiveToken}` } });

      // Delay closing the dialog to show the success message
      setTimeout(() => {
        setPasswordDialogOpen(false);
        setNewPassword("");
        setSelectedUser(null);
        setPasswordChangeMessage({ type: "", text: "" });
        setMessage({ type: "success", text: "Password updated successfully" }); // Also show in main dashboard
      }, 1500);
    } catch (error) {
      const errorMessage = error.response?.data?.error || "An error occurred";
      setPasswordChangeMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
    }
  };

  const handleBulkAction = async (action) => {
    try {
      await apiClient.post("/api/leaves/bulk-action", {
        leaveIds: selectedLeaves,
        action
      }, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      fetchLeaves();
      setSelectedLeaves([]);
      setMessage({ type: "success", text: `Leaves ${action.toLowerCase()} successfully` });
      await apiClient.post("/api/audit-logs", {
        action: `BULK_${action.toUpperCase()}_LEAVES`,
        userId: effectiveUser.id,
        details: `Performed bulk ${action.toLowerCase()} on ${selectedLeaves.length} leaves`
      }, { headers: { Authorization: `Bearer ${effectiveToken}` } });
    } catch (error) {
      const errorMessage = error.response?.data?.error || "An error occurred";
      setMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
    }
  };

  const toggleDrawer = (open) => () => {
    setDrawerOpen(open);
  };

  const handleMenuClick = (section) => {
    if (section === "Logout") handleLogout();
    else {
      setActiveSection(section);
      setDrawerOpen(false);
    }
  };

  const getStatusChip = (leave) => {
    const status = leave.status || "Pending";
    switch (status) {
      case "Approved":
        return <Chip label="Approved" color="success" size="small" />;
      case "Rejected":
        return <Chip label="Rejected" color="error" size="small" />;
      case "RecommendedBySectional":
        return <Chip label="Recommended by Sectional" color="info" size="small" />;
      case "RecommendedByDepartmental":
        return <Chip label="Recommended by Departmental" color="info" size="small" />;
      case "Pending":
      default:
        return <Chip label="Pending" color="warning" size="small" />;
    }
  };

  const menuItems = ["User Management", "Leave Analytics", "Audit Logs", "Logout"];

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  return (
    <>
      <StyledAppBar position="fixed">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={toggleDrawer(true)} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Admin Exclusive Dashboard
          </Typography>
          <Typography variant="subtitle1" sx={{ color: "#fff" }}>
            {effectiveUser.role}
          </Typography>
        </Toolbar>
      </StyledAppBar>

      <StyledDrawer anchor="left" open={drawerOpen} onClose={toggleDrawer(false)}>
        <Toolbar />
        <List>
          {menuItems.map((item) => (
            <ListItem
              button
              key={item}
              onClick={() => handleMenuClick(item)}
              sx={{
                "&:hover": { bgcolor: "#e0e0e0" },
                bgcolor: activeSection === item ? "#d0d0d0" : "inherit",
              }}
            >
              <ListItemText primary={item} />
            </ListItem>
          ))}
        </List>
      </StyledDrawer>

      <MainContent>
        <ContentPaper elevation={3}>
          {message.text && (
            <Alert severity={message.type} sx={{ mb: 3, borderRadius: 2 }}>
              {message.text}
            </Alert>
          )}

          {activeSection === "User Management" && (
            <>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
                User Management
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <Box sx={{ mb: 4, maxWidth: "100%", overflowX: "auto" }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Add New User
                </Typography>
                <Box component="form" onSubmit={handleAddUser} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        fullWidth
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        fullWidth
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Name"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        fullWidth
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Role"
                        select
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        fullWidth
                        SelectProps={{ native: true }}
                      >
                        <option value="Employee">Employee</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="SectionalHead">Sectional Head</option>
                        <option value="DepartmentalHead">Departmental Head</option>
                        <option value="HRDirector">HR Director</option>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Department"
                        value={newUser.department}
                        onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                        fullWidth
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Sector"
                        value={newUser.sector}
                        onChange={(e) => setNewUser({ ...newUser, sector: e.target.value })}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Chief Officer Name"
                        value={newUser.chiefOfficerName}
                        onChange={(e) => setNewUser({ ...newUser, chiefOfficerName: e.target.value })}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Supervisor Name"
                        value={newUser.supervisorName}
                        onChange={(e) => setNewUser({ ...newUser, supervisorName: e.target.value })}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Person Number"
                        value={newUser.personNumber}
                        onChange={(e) => setNewUser({ ...newUser, personNumber: e.target.value })}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Sectional Head Name"
                        value={newUser.sectionalHeadName}
                        onChange={(e) => setNewUser({ ...newUser, sectionalHeadName: e.target.value })}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Departmental Head Name"
                        value={newUser.departmentalHeadName}
                        onChange={(e) => setNewUser({ ...newUser, departmentalHeadName: e.target.value })}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="HR Director Name"
                        value={newUser.HRDirectorName}
                        onChange={(e) => setNewUser({ ...newUser, HRDirectorName: e.target.value })}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Profile Picture URL"
                        value={newUser.profilePicture}
                        onChange={(e) => setNewUser({ ...newUser, profilePicture: e.target.value })}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                  <StyledButton type="submit" variant="contained" color="primary" sx={{ mt: 2, width: "fit-content" }}>
                    Add User
                  </StyledButton>
                </Box>
              </Box>

              <Typography variant="h6" sx={{ mb: 2 }}>
                Users
              </Typography>
              <Box sx={{ mb: 2 }}>
                <StyledButton variant="contained" color="secondary" onClick={() => setImportDialogOpen(true)}>
                  Import Users
                </StyledButton>
              </Box>
              <TableContainer sx={{ maxHeight: "40vh", overflow: "auto" }}>
                <Table stickyHeader sx={{ minWidth: "100%", tableLayout: "auto" }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Department</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.length > 0 ? (
                      users.map((user) => (
                        <TableRow key={user._id} hover sx={{ "&:hover": { bgcolor: "#f0f0f0" } }}>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{user.name}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{user.email}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{user.role}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{user.department || "N/A"}</TableCell>
                          <TableCell>
                            <StyledButton
                              variant="outlined"
                              color="primary"
                              onClick={() => {
                                setEditProfile(user);
                                setEditProfileDialogOpen(true);
                              }}
                              sx={{ mr: 1 }}
                            >
                              Edit Profile
                            </StyledButton>
                            <StyledButton
                              variant="outlined"
                              color="primary"
                              onClick={() => {
                                setSelectedUser(user);
                                setPasswordDialogOpen(true);
                              }}
                              sx={{ mr: 1 }}
                            >
                              Change Password
                            </StyledButton>
                            <StyledButton
                              variant="outlined"
                              color="error"
                              onClick={() => handleDeleteUser(user._id)}
                            >
                              Delete
                            </StyledButton>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {activeSection === "Leave Analytics" && (
            <>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
                Leave Analytics
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Statistics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <Paper sx={{ p: 2, bgcolor: "#f5f5f5" }}>
                      <Typography variant="subtitle1">Total Leaves</Typography>
                      <Typography variant="h6">{stats.total}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Paper sx={{ p: 2, bgcolor: "#d4edda" }}>
                      <Typography variant="subtitle1">Approved</Typography>
                      <Typography variant="h6">{stats.approved}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Paper sx={{ p: 2, bgcolor: "#f8d7da" }}>
                      <Typography variant="subtitle1">Rejected</Typography>
                      <Typography variant="h6">{stats.rejected}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Paper sx={{ p: 2, bgcolor: "#fff3cd" }}>
                      <Typography variant="subtitle1">Pending</Typography>
                      <Typography variant="h6">{stats.pending}</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>

              <Typography variant="h6" sx={{ mb: 2 }}>
                Search Leave Requests
              </Typography>
              <Box sx={{ mb: 4 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Employee Name"
                      value={searchParams.employeeName}
                      onChange={(e) => setSearchParams({ ...searchParams, employeeName: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Leave Type"
                      select
                      value={searchParams.leaveType}
                      onChange={(e) => setSearchParams({ ...searchParams, leaveType: e.target.value })}
                      fullWidth
                      SelectProps={{ native: true }}
                    >
                      <option value="">All</option>
                      <option value="Short Leave">Short Leave</option>
                      <option value="Annual Leave">Annual Leave</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Status"
                      select
                      value={searchParams.status}
                      onChange={(e) => setSearchParams({ ...searchParams, status: e.target.value })}
                      fullWidth
                      SelectProps={{ native: true }}
                    >
                      <option value="">All</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </TextField>
                  </Grid>
                </Grid>
              </Box>
              {selectedLeaves.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <StyledButton
                    variant="contained"
                    color="success"
                    onClick={() => handleBulkAction("APPROVE")}
                    sx={{ mr: 1 }}
                  >
                    Approve Selected
                  </StyledButton>
                  <StyledButton
                    variant="contained"
                    color="error"
                    onClick={() => handleBulkAction("REJECT")}
                  >
                    Reject Selected
                  </StyledButton>
                </Box>
              )}
              <TableContainer sx={{ maxHeight: "40vh", overflow: "auto" }}>
                <Table stickyHeader sx={{ minWidth: "100%", tableLayout: "auto" }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>
                        <Checkbox
                          checked={selectedLeaves.length === leaves.length && leaves.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLeaves(leaves.map(leave => leave._id));
                            } else {
                              setSelectedLeaves([]);
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>
                        Employee Name
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>
                        Leave Type
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>
                        Status
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>
                        Start Date
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>
                        End Date
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaves.length > 0 ? (
                      leaves.map((leave) => (
                        <TableRow key={leave._id} hover sx={{ "&:hover": { bgcolor: "#f0f0f0" } }}>
                          <TableCell>
                            <Checkbox
                              checked={selectedLeaves.includes(leave._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLeaves([...selectedLeaves, leave._id]);
                                } else {
                                  setSelectedLeaves(selectedLeaves.filter(id => id !== leave._id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.employeeName}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.leaveType}</TableCell>
                          <TableCell>{getStatusChip(leave)}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>
                            {new Date(leave.startDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>
                            {new Date(leave.endDate).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          No leave requests found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {activeSection === "Audit Logs" && (
            <>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
                Audit Logs
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <Box sx={{ mb: 4 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Action"
                      value={auditFilters.action}
                      onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="User ID"
                      value={auditFilters.userId}
                      onChange={(e) => setAuditFilters({ ...auditFilters, userId: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Start Date"
                      type="date"
                      value={auditFilters.startDate}
                      onChange={(e) => setAuditFilters({ ...auditFilters, startDate: e.target.value })}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="End Date"
                      type="date"
                      value={auditFilters.endDate}
                      onChange={(e) => setAuditFilters({ ...auditFilters, endDate: e.target.value })}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
              </Box>
              <TableContainer sx={{ maxHeight: "50vh", overflow: "auto" }}>
                <Table stickyHeader sx={{ minWidth: "100%", tableLayout: "auto" }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Action</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>User ID</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Details</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Timestamp</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditLogs.length > 0 ? (
                      auditLogs.map((log) => (
                        <TableRow key={log._id} hover sx={{ "&:hover": { bgcolor: "#f0f0f0" } }}>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{log.action}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{log.userId}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{log.details}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>
                            {new Date(log.timestamp).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          No audit logs found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </ContentPaper>
      </MainContent>

      {/* Edit Profile Dialog */}
      <Dialog open={editProfileDialogOpen} onClose={() => setEditProfileDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent>
          {editProfile && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Name"
                  value={editProfile.name}
                  onChange={(e) => setEditProfile({ ...editProfile, name: e.target.value })}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Email"
                  value={editProfile.email}
                  onChange={(e) => setEditProfile({ ...editProfile, email: e.target.value })}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Role"
                  select
                  value={editProfile.role}
                  onChange={(e) => setEditProfile({ ...editProfile, role: e.target.value })}
                  fullWidth
                  SelectProps={{ native: true }}
                >
                  <option value="Employee">Employee</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="SectionalHead">Sectional Head</option>
                  <option value="DepartmentalHead">Departmental Head</option>
                  <option value="HRDirector">HR Director</option>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Department"
                  value={editProfile.department}
                  onChange={(e) => setEditProfile({ ...editProfile, department: e.target.value })}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Sector"
                  value={editProfile.sector}
                  onChange={(e) => setEditProfile({ ...editProfile, sector: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Chief Officer Name"
                  value={editProfile.chiefOfficerName}
                  onChange={(e) => setEditProfile({ ...editProfile, chiefOfficerName: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Supervisor Name"
                  value={editProfile.supervisorName}
                  onChange={(e) => setEditProfile({ ...editProfile, supervisorName: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Person Number"
                  value={editProfile.personNumber}
                  onChange={(e) => setEditProfile({ ...editProfile, personNumber: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Sectional Head Name"
                  value={editProfile.sectionalHeadName}
                  onChange={(e) => setEditProfile({ ...editProfile, sectionalHeadName: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Departmental Head Name"
                  value={editProfile.departmentalHeadName}
                  onChange={(e) => setEditProfile({ ...editProfile, departmentalHeadName: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="HR Director Name"
                  value={editProfile.HRDirectorName}
                  onChange={(e) => setEditProfile({ ...editProfile, HRDirectorName: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Profile Picture URL"
                  value={editProfile.profilePicture}
                  onChange={(e) => setEditProfile({ ...editProfile, profilePicture: e.target.value })}
                  fullWidth
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditProfileDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateProfile} variant="contained" color="primary">
            Update Profile
          </Button>
        </DialogActions>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)}>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          {passwordChangeMessage.text && (
            <Alert severity={passwordChangeMessage.type} sx={{ mb: 2 }}>
              {passwordChangeMessage.text}
            </Alert>
          )}
          <TextField
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleChangePassword} variant="contained" color="primary">
            Update Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Users Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)}>
        <DialogTitle>Import Users</DialogTitle>
        <DialogContent>
          <Input
            type="file"
            accept=".csv"
            onChange={(e) => setImportFile(e.target.files[0])}
            fullWidth
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleImportUsers} variant="contained" color="primary">
            Import
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SuperAdminDashboard;