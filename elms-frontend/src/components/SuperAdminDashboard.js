import React, { useState, useEffect, useContext, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/apiClient";
import { io } from "socket.io-client";
import {
  Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell, Button, Alert, Drawer, List, ListItem, ListItemText,
  IconButton, AppBar, Toolbar, Box, TableContainer, Chip, Divider, TextField, Grid, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Input, Select, MenuItem, FormControlLabel, Checkbox, Collapse
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import EditIcon from "@mui/icons-material/Edit";
import LockIcon from "@mui/icons-material/Lock";
import DeleteIcon from "@mui/icons-material/Delete";
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
  const [profiles, setProfiles] = useState([]);
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
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterDirectorate, setFilterDirectorate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const localToken = localStorage.getItem("token");
  const effectiveToken = authState?.token || localToken;
  const effectiveUser = authState?.user || JSON.parse(localStorage.getItem("user") || "{}");

  const profileMap = useMemo(() => {
    const map = {};
    profiles.forEach(profile => {
      map[profile.userId] = profile;
    });
    return map;
  }, [profiles]);

  const departments = useMemo(() => [...new Set(profiles.map(p => p.department).filter(Boolean))], [profiles]);
  const directorates = useMemo(() => [...new Set(profiles.map(p => p.directorate).filter(Boolean))], [profiles]);

  const filteredUsers = useMemo(() => {
    let result = [...users];
    if (searchTerm) {
      result = result.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterDepartment) {
      result = result.filter(user => profileMap[user._id]?.department === filterDepartment);
    }
    if (filterDirectorate) {
      result = result.filter(user => profileMap[user._id]?.directorate === filterDirectorate);
    }
    result.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "department") return (profileMap[a._id]?.department || "").localeCompare(profileMap[b._id]?.department || "");
      if (sortBy === "directorate") return (profileMap[a._id]?.directorate || "").localeCompare(profileMap[b._id]?.directorate || "");
      return 0;
    });

    return result;
  }, [users, profiles, searchTerm, filterDepartment, filterDirectorate, sortBy]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

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

  const fetchProfiles = async () => {
    try {
      const response = await apiClient.get("/api/users/profiles", {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      setProfiles(response.data);
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
      await Promise.all([fetchUsers(), fetchProfiles(), fetchStats(), fetchLeaves(), fetchAuditLogs()]);
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

  const handleDeleteUser = async (userId) => {
    try {
      await apiClient.delete(`/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      fetchUsers();
      fetchProfiles();
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
      fetchProfiles();
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
      fetchProfiles();
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

      setTimeout(() => {
        setPasswordDialogOpen(false);
        setNewPassword("");
        setSelectedUser(null);
        setPasswordChangeMessage({ type: "", text: "" });
        setMessage({ type: "success", text: "Password updated successfully" });
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
    else if (section === "Add User") navigate("/add-user");
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
      case "RecommendedByDirector":
        return <Chip label="Recommended by Director" color="info" size="small" />;
      case "RecommendedByDepartmental":
        return <Chip label="Recommended by Departmental" color="info" size="small" />;
      case "Pending":
      default:
        return <Chip label="Pending" color="warning" size="small" />;
    }
  };

  const menuItems = ["User Management", "Add User","Leave Analytics", "Audit Logs", "Logout"];

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
                  Users
                </Typography>
                <Box sx={{ mb: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
                  <TextField
                    label="Search by Name or Email"
                    variant="outlined"
                    size="small"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    sx={{ minWidth: 200 }}
                  />
                  <Select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    displayEmpty
                    size="small"
                    sx={{ minWidth: 150 }}
                  >
                    <MenuItem value="name">Sort by Name</MenuItem>
                    <MenuItem value="department">Sort by Department</MenuItem>
                    <MenuItem value="directorate">Sort by Directorate</MenuItem>
                  </Select>
                  <Select
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                    displayEmpty
                    size="small"
                    sx={{ minWidth: 150 }}
                  >
                    <MenuItem value="">All Departments</MenuItem>
                    {departments.map((dept) => (
                      <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                    ))}
                  </Select>
                  <Select
                    value={filterDirectorate}
                    onChange={(e) => setFilterDirectorate(e.target.value)}
                    displayEmpty
                    size="small"
                    sx={{ minWidth: 150 }}
                  >
                    <MenuItem value="">All Directorates</MenuItem>
                    {directorates.map((dir) => (
                      <MenuItem key={dir} value={dir}>{dir}</MenuItem>
                    ))}
                  </Select>
                  <StyledButton variant="contained" color="secondary" onClick={() => setImportDialogOpen(true)}>
                    Import Users
                  </StyledButton>
                </Box>
                <TableContainer sx={{ boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)", borderRadius: 2, border: "1px solid #e0e0e0", bgcolor: "#fff" }}>
                  <Table stickyHeader sx={{ minWidth: "100%", tableLayout: "auto" }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>Email</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>Role</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>Department</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>Directorate</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                          <React.Fragment key={user._id}>
                            <TableRow
                              hover
                              onClick={() => setExpandedUserId(expandedUserId === user._id ? null : user._id)}
                              sx={{
                                "&:hover": { bgcolor: "#f0f0f0" },
                                cursor: "pointer",
                                borderBottom: "1px solid #e0e0e0",
                              }}
                            >
                              <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>{user.name}</TableCell>
                              <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>{user.email}</TableCell>
                              <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>{user.role}</TableCell>
                              <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>{profileMap[user._id]?.department || "—"}</TableCell>
                              <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>{profileMap[user._id]?.directorate || "—"}</TableCell>
                              <TableCell sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1 }}>
                                {expandedUserId === user._id ? <ExpandLessIcon sx={{ color: "#718096" }} /> : <ExpandMoreIcon sx={{ color: "#718096" }} />}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={6} sx={{ padding: 0, borderBottom: "1px solid #e0e0e0" }}>
                                <Collapse in={expandedUserId === user._id} timeout="auto" unmountOnExit>
                                  <Box
                                    sx={{
                                      p: 3,
                                      bgcolor: "#f7fafc",
                                      border: "1px solid #e2e8f0",
                                      borderRadius: 2,
                                      mx: 2,
                                      mb: 2,
                                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
                                    }}
                                  >
                                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: "#2d3748", mb: 3 }}>
                                      User Details
                                    </Typography>
                                    <Grid container spacing={2}>
                                      <Grid item xs={12} sm={6}>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Email:</strong> {profileMap[user._id]?.email || user.email}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Role:</strong> {profileMap[user._id]?.role || user.role}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Department:</strong> {profileMap[user._id]?.department || "—"}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Directorate:</strong> {profileMap[user._id]?.directorate || "—"}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Chief Officer Name:</strong> {profileMap[user._id]?.chiefOfficerName || "—"}
                                        </Typography>
                                      </Grid>
                                      <Grid item xs={12} sm={6}>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Person Number:</strong> {profileMap[user._id]?.personNumber || "—"}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Director Name:</strong> {profileMap[user._id]?.directorName || "—"}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Departmental Head Name:</strong> {profileMap[user._id]?.departmentalHeadName || "—"}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>HR Director Name:</strong> {profileMap[user._id]?.HRDirectorName || "—"}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Profile Picture URL:</strong> {profileMap[user._id]?.profilePicture || "—"}
                                        </Typography>
                                      </Grid>
                                    </Grid>
                                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3, gap: 2 }}>
                                      <Button
                                        variant="outlined"
                                        color="primary"
                                        startIcon={<EditIcon />}
                                        onClick={() => {
                                          setEditProfile(user);
                                          setEditProfileDialogOpen(true);
                                        }}
                                      >
                                        Edit Profile
                                      </Button>
                                      <Button
                                        variant="outlined"
                                        color="primary"
                                        startIcon={<LockIcon />}
                                        onClick={() => {
                                          setSelectedUser(user);
                                          setPasswordDialogOpen(true);
                                        }}
                                      >
                                        Change Password
                                      </Button>
                                      <Button
                                        variant="contained"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => handleDeleteUser(user._id)}
                                      >
                                        Delete
                                      </Button>
                                    </Box>
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 4, color: "#718096", fontStyle: "italic" }}>
                            No users found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
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
              <TableContainer sx={{ boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)", borderRadius: 2, border: "1px solid #e0e0e0", bgcolor: "#fff" }}>
                <Table stickyHeader sx={{ minWidth: "100%", tableLayout: "auto" }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>
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
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>
                        Employee Name
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>
                        Leave Type
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>
                        Status
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>
                        Start Date
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>
                        End Date
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaves.length > 0 ? (
                      leaves.map((leave) => (
                        <TableRow key={leave._id} hover sx={{ "&:hover": { bgcolor: "#f0f0f0" }, borderBottom: "1px solid #e0e0e0" }}>
                          <TableCell sx={{ px: 3, py: 2 }}>
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
                          <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>{leave.employeeName}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>{leave.leaveType}</TableCell>
                          <TableCell sx={{ px: 3, py: 2 }}>{getStatusChip(leave)}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>
                            {new Date(leave.startDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>
                            {new Date(leave.endDate).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4, color: "#718096", fontStyle: "italic" }}>
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
              <TableContainer sx={{ boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)", borderRadius: 2, border: "1px solid #e0e0e0", bgcolor: "#fff" }}>
                <Table stickyHeader sx={{ minWidth: "100%", tableLayout: "auto" }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>Action</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>User ID</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>Details</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f7fafc", whiteSpace: "nowrap", px: 3, py: 2 }}>Timestamp</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditLogs.length > 0 ? (
                      auditLogs.map((log) => (
                        <TableRow key={log._id} hover sx={{ "&:hover": { bgcolor: "#f0f0f0" }, borderBottom: "1px solid #e0e0e0" }}>
                          <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>{log.action}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>{log.userId}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>{log.details}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>
                            {new Date(log.timestamp).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4, color: "#718096", fontStyle: "italic" }}>
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

      {/* Dialog for Editing Profile */}
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
                  <option value="Director">Director</option>
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
                  label="Directorate"
                  value={editProfile.directorate}
                  onChange={(e) => setEditProfile({ ...editProfile, directorate: e.target.value })}
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
                  label="Person Number"
                  value={editProfile.personNumber}
                  onChange={(e) => setEditProfile({ ...editProfile, personNumber: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Director Name"
                  value={editProfile.directorName}
                  onChange={(e) => setEditProfile({ ...editProfile, directorName: e.target.value })}
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


      {/* Dialog for Importing Users */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)}>
        <DialogTitle>Import Users</DialogTitle>
        <DialogContent>
          <Input
            type="file"
            onChange={(e) => setImportFile(e.target.files[0])}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleImportUsers} color="primary">Import</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for Changing Password */}
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
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleChangePassword} color="primary">Change</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SuperAdminDashboard;