import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/apiClient";
import { io } from "socket.io-client";
import {
  Paper,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Alert,
  Drawer,
  List,
  ListItem,
  ListItemText,
  IconButton,
  AppBar,
  Toolbar,
  Box,
  TableContainer,
  Chip,
  Divider,
  TextField,
  Grid,
  CircularProgress,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { styled } from "@mui/system";

// Styled components for custom styling
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
}));

const SuperAdminDashboard= () => {
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
  });
  const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0, pending: 0 });
  const [leaves, setLeaves] = useState([]);
  const [searchParams, setSearchParams] = useState({
    employeeName: "",
    leaveType: "",
    status: "",
  });
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("User Management");
  const [socket, setSocket] = useState(null);

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

    return () => newSocket.disconnect();
  }, [effectiveToken]);

  // Fetch data
  const fetchUsers = async () => {
    try {
      const response = await apiClient.get("/api/users/users", {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      setUsers(response.data);
    }catch (error) {
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
    }catch (error) {
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

  useEffect(() => {
    if (!effectiveToken || effectiveUser.role !== "Admin") {
      navigate("/login");
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([fetchUsers(), fetchStats(), fetchLeaves()]);
      setIsLoading(false);
    };

    fetchData();
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [searchParams]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post("/api/users/add-user", newUser, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      fetchUsers();
      setNewUser({ email: "", password: "", name: "", role: "Employee", department: "" });
      setMessage({ type: "success", text: "User added successfully" });
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

  const menuItems = ["User Management", "Leave Analytics", "Logout"];

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
        <Paper elevation={3} sx={{ p: 4, height: "100%", width: "100%", borderRadius: 0, boxSizing: "border-box" }}>
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
              <Box sx={{ mb: 8 }}>
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
              <TableContainer sx={{ height: "calc(100% - 300px)", overflow: "auto" }}>
                <Table stickyHeader sx={{ width: "100%", tableLayout: "auto" }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Department</TableCell>
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
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
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
              <Box sx={{ mb: 8 }}>
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
              <TableContainer sx={{ height: "calc(100% - 300px)", overflow: "auto" }}>
                <Table stickyHeader sx={{ width: "100%", tableLayout: "auto" }}>
                  <TableHead>
                    <TableRow>
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
                        <TableCell colSpan={5} align="center">
                          No leave requests found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Paper>
      </MainContent>
    </>
  );
};

export default SuperAdminDashboard;