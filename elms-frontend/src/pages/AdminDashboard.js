import { useState, useEffect, useContext, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import apiClient from "../utils/apiClient";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
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
  ListItemIcon,
  IconButton,
  AppBar,
  Toolbar,
  Modal,
  Box,
  TableContainer,
  Chip,
  Tooltip,
  Divider,
  TextField,
  Grid,
  Avatar,
  CircularProgress,
  Input,
  Checkbox,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  Select,
  FormControl,
  InputLabel,
  Pagination,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import DownloadIcon from "@mui/icons-material/Download";
import HistoryIcon from "@mui/icons-material/History";
import BarChartIcon from "@mui/icons-material/BarChart";
import ListAltIcon from "@mui/icons-material/ListAlt";
import PersonIcon from "@mui/icons-material/Person";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";
import SearchIcon from "@mui/icons-material/Search";
import { styled } from "@mui/system";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { io } from "socket.io-client";
import { ProfileTable } from "./Profile";
import LeaveRoster from "../components/LeaveRoster";
import { CSVLink } from "react-csv";
// Date-fns setup for react-big-calendar
const locales = {
  "en-US": require("date-fns/locale/en-US"),
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Helper function to calculate the next working day (assuming Mon-Fri workweek)
const calculateNextWorkingDay = (date) => {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const dayOfWeek = nextDay.getDay();
  if (dayOfWeek === 0) nextDay.setDate(nextDay.getDate() + 1); // Move to Monday
  else if (dayOfWeek === 6) nextDay.setDate(nextDay.getDate() + 2); // Move to Monday
  return nextDay.toISOString();
};

// Validation helper functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhoneNumber = (phoneNumber) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
};


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
    top: 64,
  },
}));

const StyledButton = styled(Button) ({
borderRadius: 6,
  textTransform: "none",
  padding: "8px 16px",
  transition: "all 0.3s ease",
  "&:hover": { transform: "translateY(-2px)", boxShadow: "0 4px 8px rgba(0,0,0,0.1)" },
});

const StyledStatsCard = styled(Paper)(({ theme }) => ({
  p: 3,
  textAlign: "center",
  transition: "transform 0.2s, box-shadow 0.2s",
  "&:hover": {
    transform: "scale(1.03)",
    boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
  },
}));

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "90%",
  maxWidth: 800,
  bgcolor: "background.paper",
  borderRadius: 8,
  boxShadow: 24,
  p: 4,
  maxHeight: "85vh",
  overflowY: "auto",
};


// Helper functions
const getRowBackgroundColor = (leave) => {
  switch (leave.status) {
    case "Approved": return "#e8f5e9";
    case "Rejected": return "#ffebee";
    case "Pending": return "#fff3e0";
    default: return "transparent";
  }
};

const filterLeavesByPendingActions = (leaves, isShortLeave, userRole, showPendingActionsOnly, specificRoleFilter) => {
  let filteredLeaves = leaves;
  if (showPendingActionsOnly) {
    filteredLeaves = leaves.filter((leave) => {
      if (userRole === "Supervisor" && isShortLeave) return leave.status === "Pending";
      if (userRole === "SectionalHead" && !isShortLeave) return leave.status === "Pending";
      if (userRole === "DepartmentalHead" && !isShortLeave) return leave.status === "RecommendedBySectional";
      if (userRole === "HRDirector") {
        return isShortLeave
          ? leave.status === "RecommendedBySectional"
          : leave.status === "RecommendedByDepartmental";
      }
      if (userRole === "Admin") return true;
      return false;
    });
  }
  if (specificRoleFilter && specificRoleFilter !== "All") {
    filteredLeaves = filteredLeaves.filter((leave) => {
      if (specificRoleFilter === "Supervisor" && isShortLeave) return leave.status === "Pending";
      if (specificRoleFilter === "SectionalHead" && !isShortLeave) return leave.status === "Pending";
      if (specificRoleFilter === "DepartmentalHead" && !isShortLeave) return leave.status === "RecommendedBySectional";
      if (specificRoleFilter === "HRDirector") {
        return isShortLeave
          ? leave.status === "RecommendedBySectional"
          : leave.status === "RecommendedByDepartmental";
      }
      return true;
    });
  }
  return filteredLeaves;
};


const MainContent = styled(Box)(({ theme }) => ({
  marginTop: 64,
  height: "calc(100vh - 64px)",
  width: "100%",
  overflow: "auto",
  background: "linear-gradient(135deg, #f5f7fa 0%, #e4e9f0 100%)",
}));
/*  
const ProfileForm = ({
  profile,
  isEditingProfile,
  setIsEditingProfile,
  formData,
  formErrors,
  handleInputChange,
  handleProfileUpdate,
}) => {
 return (
            <>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
                Admin Profile
              </Typography>
              <Divider sx={{ mb: 3 }} />
              {isEditingProfile ? (
                <Box component="form" sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        fullWidth
                        error={!!formErrors.name}
                        helperText={formErrors.name}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        fullWidth
                        error={!!formErrors.email}
                        helperText={formErrors.email}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Department"
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        fullWidth
                        error={!!formErrors.department}
                        helperText={formErrors.department}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Phone Number"
                        name="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={handleInputChange}
                        fullWidth
                        error={!!formErrors.phoneNumber}
                        helperText={formErrors.phoneNumber}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Input
                        type="file"
                        name="profilePicture"
                        onChange={handleInputChange}
                        fullWidth
                        inputProps={{ accept: "image/*" }}
                      />
                      {formData.profilePicture && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Selected file: {formData.profilePicture.name}
                        </Typography>
                      )}
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Chief Officer Name"
                        name="chiefOfficerName"
                        value={formData.chiefOfficerName}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Supervisor Name"
                        name="supervisorName"
                        value={formData.supervisorName}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Person Number"
                        name="personNumber"
                        value={formData.personNumber}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Sector"
                        name="sector"
                        value={formData.sector}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Sectional Head Name"
                        name="sectionalHeadName"
                        value={formData.sectionalHeadName}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="Departmental Head Name"
                        name="departmentalHeadName"
                        value={formData.departmentalHeadName}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        label="HR Director Name"
                        name="HRDirectorName"
                        value={formData.HRDirectorName}
                        onChange={handleInputChange}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                  <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
                    <StyledButton variant="contained" color="primary" onClick={handleProfileUpdate}>
                      Save
                    </StyledButton>
                    <StyledButton
                      variant="outlined"
                      color="secondary"
                      onClick={() => setIsEditingProfile(false)}
                    >
                      Cancel
                    </StyledButton>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                    <Avatar
                      src={profile?.profilePicture || ""}
                      alt={profile?.name || "Admin"}
                      sx={{ width: 80, height: 80 }}
                    />
                    <Typography variant="h6">{profile?.name || "N/A"}</Typography>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" sx={{ color: "#555" }}>
                        <strong>Email:</strong> {profile?.email || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" sx={{ color: "#555" }}>
                        <strong>Department:</strong> {profile?.department || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" sx={{ color: "#555" }}>
                        <strong>Phone Number:</strong> {profile?.phoneNumber || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" sx={{ color: "#555" }}>
                        <strong>Chief Officer:</strong> {profile?.chiefOfficerName || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" sx={{ color: "#555" }}>
                        <strong>Supervisor:</strong> {profile?.supervisorName || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" sx={{ color: "#555" }}>
                        <strong>Person Number:</strong> {profile?.personNumber || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" sx={{ color: "#555" }}>
                        <strong>Sector:</strong> {profile?.sector || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" sx={{ color: "#555" }}>
                        <strong>Sectional Head:</strong> {profile?.sectionalHeadName || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" sx={{ color: "#555" }}>
                        <strong>Departmental Head:</strong> {profile?.departmentalHeadName || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body1" sx={{ color: "#555" }}>
                        <strong>HR Director:</strong> {profile?.HRDirectorName || "N/A"}
                      </Typography>
                    </Grid>
                  </Grid>
                  <StyledButton
                    variant="contained"
                    color="primary"
                    onClick={() => setIsEditingProfile(true)}
                    sx={{ mt: 3, width: "fit-content" }}
                  >
                    Edit Profile
                  </StyledButton>
                </Box>
              )}
            </>
  );
          }; 
*/
const LeaveCalendar = ({
  calendarError,
  isFetchingEvents,
  fetchLeaveEvents,
  events,
  setSelectedEvent,
  
}) => {
  return (
            <>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
                Leave Calendar
              </Typography>
              <Divider sx={{ mb: 3 }} />
              
              {calendarError ? (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <Typography variant="body1" sx={{ color: "#f44336" }}>
                    {calendarError}
                  </Typography>
                  <StyledButton
                    variant="contained"
                    color="primary"
                    onClick={fetchLeaveEvents}
                    disabled={isFetchingEvents}
                  >
                    {isFetchingEvents ? <CircularProgress size={24} /> : "Retry"}
                  </StyledButton>
                </Box>
              ) : (
                <Box sx={{ height: "calc(100% - 80px)" }}>
                  <Calendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: "100%", width: "100%" }}
                    onSelectEvent={(event) => setSelectedEvent(event)}
                    eventPropGetter={(event) => ({
                      style: event.style,
                    })}
                  />
                </Box>
              )}
            </>
          );
        };



const LeaveTable = ({
  leaves,
  isShortLeave,
  userRole,
  showPendingActionsOnly,
  setShowPendingActionsOnly,
  handleAction,
  handleViewDetails,
  selectedLeaves,
  setSelectedLeaves,
  handleBulkAction,
  specificRoleFilter,
  setSpecificRoleFilter,
  filterParams,
  setFilterParams,
  sortColumn,
  sortDirection,
  handleSort,
  currentPage,
  setCurrentPage,
  rowsPerPage,
  isActiveLeave,
  getStatusChip,
  handleEditClick,
  handleDeleteClick,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [contextLeave, setContextLeave] = useState(null);

  const filteredLeaves = useMemo(() => {
    return filterLeavesByPendingActions(leaves, isShortLeave, userRole, showPendingActionsOnly, specificRoleFilter).filter(
      (leave) =>
        (!filterParams.status || leave.status === filterParams.status) &&
        (!filterParams.startDate || new Date(leave.startDate) >= new Date(filterParams.startDate)) &&
        (!filterParams.endDate || new Date(leave.endDate) <= new Date(filterParams.endDate)) &&
        (!filterParams.employeeName ||
          leave.employeeName.toLowerCase().includes(filterParams.employeeName.toLowerCase()))
    );
  }, [leaves, isShortLeave, userRole, showPendingActionsOnly, specificRoleFilter, filterParams]);

  const sortedLeaves = useMemo(() => {
    return [...filteredLeaves].sort((a, b) => {
      let valueA = sortColumn === "startDate" ? new Date(a.startDate) : a[sortColumn];
      let valueB = sortColumn === "startDate" ? new Date(b.startDate) : b[sortColumn];
      if (sortColumn === "employeeName") {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }
      if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredLeaves, sortColumn, sortDirection]);

  const paginatedLeaves = useMemo(() => {
    return sortedLeaves.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [sortedLeaves, currentPage, rowsPerPage]);

  const handleMenuOpen = (event, leave) => {
    setAnchorEl(event.currentTarget);
    setContextLeave(leave);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setContextLeave(null);
  };

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
        {isShortLeave ? "Short Leave Requests" : "Annual Leave Requests"}
      </Typography>
      <Box sx={{ mb: 2, display: "flex", gap: 2, alignItems: "center" }}>
        <StyledButton
          variant={showPendingActionsOnly ? "contained" : "outlined"}
          color="primary"
          onClick={() => setShowPendingActionsOnly(!showPendingActionsOnly)}
        >
          {showPendingActionsOnly ? "Show All" : "Show Pending Only"}
        </StyledButton>
        {userRole === "Admin" && (
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Filter Role</InputLabel>
            <Select
              value={specificRoleFilter}
              onChange={(e) => setSpecificRoleFilter(e.target.value)}
              label="Filter Role"
            >
              <MenuItem value="All">All Roles</MenuItem>
              <MenuItem value="Supervisor">Supervisor</MenuItem>
              <MenuItem value="SectionalHead">Sectional Head</MenuItem>
              <MenuItem value="DepartmentalHead">Departmental Head</MenuItem>
              <MenuItem value="HRDirector">HR Director</MenuItem>
            </Select>
          </FormControl>
        )}
        <StyledButton
          variant="outlined"
          onClick={() => setShowFilters(!showFilters)}
          startIcon={showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        >
          {showFilters ? "Hide Filters" : "Show Filters"}
        </StyledButton>
        <CSVLink
          data={sortedLeaves.map((leave) => ({
            ID: leave._id.slice(-6),
            Employee: leave.employeeName,
            Days: leave.daysApplied,
            StartDate: new Date(leave.startDate).toLocaleDateString(),
            Status: leave.status || "Pending",
          }))}
          filename={`${isShortLeave ? "short" : "annual"}-leaves.csv`}
        >
          <StyledButton variant="outlined" startIcon={<DownloadIcon />}>Export to CSV</StyledButton>
        </CSVLink>
      </Box>

      <Collapse in={showFilters}>
        <Box sx={{ mb: 3, p: 2, border: "1px solid #e0e0e0", borderRadius: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterParams.status}
                  onChange={(e) => setFilterParams({ ...filterParams, status: e.target.value })}
                  label="Status"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Approved">Approved</MenuItem>
                  <MenuItem value="Rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Start Date"
                type="date"
                value={filterParams.startDate}
                onChange={(e) => setFilterParams({ ...filterParams, startDate: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="End Date"
                type="date"
                value={filterParams.endDate}
                onChange={(e) => setFilterParams({ ...filterParams, endDate: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Employee Name"
                value={filterParams.employeeName}
                onChange={(e) => setFilterParams({ ...filterParams, employeeName: e.target.value })}
                fullWidth
              />
            </Grid>
          </Grid>
        </Box>
      </Collapse>

      {selectedLeaves.length > 0 && (
        <Box sx={{ mb: 2, display: "flex", gap: 2, position: "sticky", top: 0, bgcolor: "background.paper", zIndex: 1 }}>
          <StyledButton variant="contained" color="success" onClick={() => handleBulkAction("Approve")}>
            Approve Selected
          </StyledButton>
          <StyledButton variant="outlined" color="error" onClick={() => handleBulkAction("Reject")}>
            Reject Selected
          </StyledButton>
        </Box>
      )}

      <TableContainer sx={{ maxHeight: 500, overflowX: "auto" }}>
        <Table stickyHeader sx={{ minWidth: "1200px" }}>
          <TableHead>
            <TableRow>
              <TableCell>
                <Checkbox
                  checked={paginatedLeaves.length > 0 && selectedLeaves.length === paginatedLeaves.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedLeaves(paginatedLeaves.map((l) => l._id));
                    else setSelectedLeaves([]);
                  }}
                  aria-label="Select all leaves"
                />
              </TableCell>
              <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }} onClick={() => handleSort("employeeName")}>
                Employee {sortColumn === "employeeName" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableCell>
              <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Days</TableCell>
              <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }} onClick={() => handleSort("startDate")}>
                Start Date {sortColumn === "startDate" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableCell>
              <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>End Date</TableCell>
              <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }} onClick={() => handleSort("status")}>
                Status {sortColumn === "status" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableCell>
              <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedLeaves.length > 0 ? (
              paginatedLeaves.map((leave) => (
                <TableRow
                  key={leave._id}
                  hover
                  sx={{
                    "&:hover": { bgcolor: "#f0f0f0" },
                    bgcolor: getRowBackgroundColor(leave),
                    transition: "background-color 0.3s ease",
                  }}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedLeaves.includes(leave._id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedLeaves([...selectedLeaves, leave._id]);
                        else setSelectedLeaves(selectedLeaves.filter((id) => id !== leave._id));
                      }}
                      aria-label={`Select leave ${leave._id}`}
                    />
                  </TableCell>
                  <TableCell>{leave.employeeName}</TableCell>
                  <TableCell>{leave.daysApplied}</TableCell>
                  <TableCell>{new Date(leave.startDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(leave.endDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Tooltip title={leave.status}>
                      {getStatusChip(leave)}
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      aria-label="more actions"
                      onClick={(e) => handleMenuOpen(e, leave)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                    <Menu
                      anchorEl={anchorEl}
                      open={Boolean(anchorEl) && contextLeave?._id === leave._id}
                      onClose={handleMenuClose}
                    >
                      <MenuItem onClick={() => { handleViewDetails(leave); handleMenuClose(); }}>View Details</MenuItem>
                      {(userRole === "HRDirector" || userRole === "Admin") && (
                        <>
                          <MenuItem onClick={() => { handleEditClick(leave); handleMenuClose(); }}>Edit</MenuItem>
                          <MenuItem onClick={() => { handleDeleteClick(leave._id); handleMenuClose(); }}>Delete</MenuItem>
                        </>
                      )}
                    </Menu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {showPendingActionsOnly ? "No pending actions for your role" : `No ${isShortLeave ? "short" : "annual"} leave requests found`}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pagination
        count={Math.ceil(filteredLeaves.length / rowsPerPage)}
        page={currentPage}
        onChange={(e, page) => setCurrentPage(page)}
        sx={{ mt: 2, display: "flex", justifyContent: "center" }}
      />
    </>
  );
};


const AdminDashboard = () => {
  const { token, logout, user } = useContext(AuthContext);
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [shortLeaves, setShortLeaves] = useState([]);
  const [annualLeaves, setAnnualLeaves] = useState([]);
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0, pending: 0 });
  const [calendarError, setCalendarError] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingEvents, setIsFetchingEvents] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("Leave Analytics");
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showPendingActionsOnly, setShowPendingActionsOnly] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    department: "",
    phoneNumber: "",
    profilePicture: null,
    chiefOfficerName: "",
    supervisorName: "",
    personNumber: "",
    email: "",
    sector: "",
    sectionalHeadName: "",
    departmentalHeadName: "",
    HRDirectorName: "",
  });
  const [formErrors, setFormErrors] = useState({});
  // New state for search functionality on the main page
  const [users, setUsers] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [searchParams, setSearchParams] = useState({
    employeeName: "",
    leaveType: "",
    status: "",
  });
  const [selectedLeaves, setSelectedLeaves] = useState([]);
  const [specificRoleFilter, setSpecificRoleFilter] = useState("All");
  const [filterParams, setFilterParams] = useState({ status: "", startDate: "", endDate: "", employeeName: "" });
  const [sortColumn, setSortColumn] = useState("startDate");
  const [sortDirection, setSortDirection] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const localToken = localStorage.getItem("token");
  const effectiveToken = token || localToken;
  const effectiveUser = user || JSON.parse(localStorage.getItem("user") || "{}");

  const [socket, setSocket] = useState(null);

  const fetchLeaves = useCallback(async () => {
    try {
      const [shortRes, annualRes] = await Promise.all([
        apiClient.get("/api/leaves/admin/leaves?leaveType=Short%20Leave", {
          headers: { Authorization: `Bearer ${effectiveToken}` },
          timeout: 5000,
        }),
        apiClient.get("/api/leaves/admin/leaves?leaveType=Annual%20Leave", {
          headers: { Authorization: `Bearer ${effectiveToken}` },
          timeout: 5000,
        }),
      ]);
      setShortLeaves(Array.isArray(shortRes.data) ? shortRes.data : []);
      setAnnualLeaves(Array.isArray(annualRes.data) ? annualRes.data : []);
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Failed to fetch leaves";
      setMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
      if (error.response?.status === 401) {
        logout();
        navigate("/login");
      } else if (error.response?.status === 403) {
        setMessage({ type: "error", text: "You do not have permission to view leaves" });
        addNotification("You do not have permission to view leaves", "error");
      }
    } finally {
      setIsLoading(false);
    }
  }, [effectiveToken]);

  const fetchProfile = async () => {
    try {
      const res = await apiClient.get("/api/admin/profile", {
        headers: { Authorization: `Bearer ${effectiveToken}` },
        timeout: 5000,
      });
      setProfile(res.data);
      setFormData({
        name: res.data.name || "",
        department: res.data.department || "",
        phoneNumber: res.data.phoneNumber || "",
        profilePicture: null,
        chiefOfficerName: res.data.chiefOfficerName || "",
        supervisorName: res.data.supervisorName || "",
        personNumber: res.data.personNumber || "",
        email: res.data.email || "",
        sector: res.data.sector || "",
        sectionalHeadName: res.data.sectionalHeadName || "",
        departmentalHeadName: res.data.departmentalHeadName || "",
        HRDirectorName: res.data.HRDirectorName || "",
      });
    } catch (error) {
      const errorMsg = error.response
        ? `${error.response.status}: ${error.response.data.error || error.response.statusText}`
        : error.message;
      setMessage({ type: "error", text: `Failed to fetch profile: ${errorMsg}` });
      addNotification(`Failed to fetch profile: ${errorMsg}`, "error");
    }
  };

  const fetchLeaveEvents = async () => {
    setIsFetchingEvents(true);
    try {
      const res = await apiClient.get("/api/leaves/all", {
        headers: { Authorization: `Bearer ${effectiveToken}` },
        timeout: 5000,
      });
      const leaveEvents = res.data.map((leave) => ({
        title: `${leave.employeeName} - ${leave.leaveType} (${leave.status})`,
        start: new Date(leave.startDate),
        end: new Date(leave.endDate),
        allDay: true,
        style: {
          backgroundColor:
            leave.status === "Approved" ? "#4caf50" : leave.status === "Rejected" ? "#f44336" : "#ff9800",
          color: "#fff",
        },
      }));
      setEvents(leaveEvents);
      setCalendarError(null);
    } catch (error) {
      const errorMsg = error.response
        ? `${error.response.status}: ${error.response.data.error || error.response.statusText}`
        : error.message;
      setCalendarError(`Failed to fetch leave events: ${errorMsg}`);
      addNotification(`Failed to fetch leave events: ${errorMsg}`, "error");
    } finally {
      setIsFetchingEvents(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get("/api/leaves/stats", {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      setStats(response.data);
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Failed to fetch leave analytics";
      setMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await apiClient.get("/api/users", {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      setUsers(response.data);
    } catch (error) {
      const errorMessage = error.response?.data?.status === 404
      ? "Users endpoint not found (404). Check backend route setup for /api/users. Server logs may help."
      : error.response?.data?.error || `Access denied: Your role (${effectiveUser.role}) may not have permission.`;
      setMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
    }
  };

  const fetchSearchedLeaves = async () => {
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
    if (!effectiveToken) {
      navigate("/login");
      return;
    }

    const newSocket = io("http://localhost:5000", {
      auth: { token: effectiveToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("WebSocket connected");
    });

    newSocket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      setMessage({ type: "error", text: "Failed to connect to real-time updates" });
      addNotification("Failed to connect to real-time updates", "error");
    });

    newSocket.on("disconnect", (reason) => {
      console.log("WebSocket disconnected. Reason:", reason);
    });

    newSocket.on("leaveStatusUpdate", (updatedLeave) => {
      fetchLeaves();
      if (selectedLeave && selectedLeave._id === updatedLeave._id) {
        setSelectedLeave(updatedLeave);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [effectiveToken, navigate]);

  useEffect(() => {
  if (!effectiveToken || !effectiveUser || !effectiveUser?.role) {
    navigate("/login");
    return;
  }

  console.log("Current role:", effectiveUser.role);

    const allowedRoles = ["Admin", "Supervisor", "SectionalHead", "DepartmentalHead", "HRDirector"];
    console.log(`User role '${effectiveUser.role}' is allowed?`, allowedRoles.includes(effectiveUser.role));
    if (!allowedRoles.includes(effectiveUser.role)) {
      setMessage({ type: "error", text: `Access restricted to roles: ${allowedRoles.join(", ")}` });
      addNotification(`Access restricted to roles: ${allowedRoles.join(", ")}`, "error");
      return;
    }
    
    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([fetchLeaves(), fetchProfile(), fetchLeaveEvents(), fetchStats(), fetchUsers()]);
      setIsLoading(false);
    };

    fetchData();
  }, [effectiveToken]);

  const handleAction = async (leaveId, action) => {
    try {
      const leave = [...shortLeaves, ...annualLeaves].find((l) => l._id === leaveId);
      if (!leave) {
        setMessage({ type: "error", text: "Leave not found" });
        addNotification("Leave not found", "error");
        return;
      }

      const updates = {};
      const currentDate = new Date().toISOString();
      const isShortLeave = shortLeaves.some((l) => l._id === leaveId);

      if (effectiveUser.role === "Supervisor" && isShortLeave) {
        updates.sectionalHeadRecommendation = action;
        updates.sectionalHeadDate = currentDate;
        updates.status = action === "Recommended" ? "RecommendedBySectional" : "Pending";
      } else if (effectiveUser.role === "SectionalHead" && !isShortLeave) {
        updates.sectionalHeadRecommendation = action;
        updates.sectionalHeadDate = currentDate;
        updates.status = action === "Recommended" ? "RecommendedBySectional" : "Pending";
      } else if (effectiveUser.role === "DepartmentalHead" && !isShortLeave) {
        updates.departmentalHeadRecommendation = action;
        updates.departmentalHeadDate = currentDate;
        updates.departmentalHeadDaysGranted = leave.daysApplied;
        updates.departmentalHeadStartDate = leave.startDate;
        updates.departmentalHeadLastDate = leave.endDate;
        updates.departmentalHeadResumeDate = calculateNextWorkingDay(leave.endDate);
        updates.status = action === "Recommended" ? "RecommendedByDepartmental" : "RecommendedBySectional";
      } else if (effectiveUser.role === "HRDirector") {
        updates.approverRecommendation = action === "Approve" ? "Approved" : "Not Approved";
        updates.approverDate = currentDate;
        updates.status = action === "Approve" ? "Approved" : "Rejected";
        if (!leave.sectionalHeadRecommendation) {
          updates.sectionalHeadRecommendation = "Recommended";
          updates.sectionalHeadDate = currentDate;
        }
        if (!leave.departmentalHeadRecommendation && !isShortLeave) {
          updates.departmentalHeadRecommendation = "Recommended";
          updates.departmentalHeadDate = currentDate;
          updates.departmentalHeadDaysGranted = leave.daysApplied;
          updates.departmentalHeadStartDate = leave.startDate;
          updates.departmentalHeadLastDate = leave.endDate;
          updates.departmentalHeadResumeDate = calculateNextWorkingDay(leave.endDate);
        }
      } else if (effectiveUser.role === "Admin") {
        if (isShortLeave) {
          if (action === "Approve" || action === "Reject") {
            updates.approverRecommendation = action === "Approve" ? "Approved" : "Not Approved";
            updates.approverDate = currentDate;
            updates.status = action === "Approve" ? "Approved" : "Rejected";
            if (!leave.sectionalHeadRecommendation) {
              updates.sectionalHeadRecommendation = "Recommended";
              updates.sectionalHeadDate = currentDate;
            }
          } else {
            updates.sectionalHeadRecommendation = action;
            updates.sectionalHeadDate = currentDate;
            updates.status = action === "Recommended" ? "RecommendedBySectional" : "Pending";
          }
        } else {
          if (action === "Approve" || action === "Reject") {
            updates.approverRecommendation = action === "Approve" ? "Approved" : "Not Approved";
            updates.approverDate = currentDate;
            updates.status = action === "Approve" ? "Approved" : "Rejected";
            if (!leave.sectionalHeadRecommendation) {
              updates.sectionalHeadRecommendation = "Recommended";
              updates.sectionalHeadDate = currentDate;
            }
            if (!leave.departmentalHeadRecommendation) {
              updates.departmentalHeadRecommendation = "Recommended";
              updates.departmentalHeadDate = currentDate;
              updates.departmentalHeadDaysGranted = leave.daysApplied;
              updates.departmentalHeadStartDate = leave.startDate;
              updates.departmentalHeadLastDate = leave.endDate;
              updates.departmentalHeadResumeDate = calculateNextWorkingDay(leave.endDate);
            }
          } else if (action === "Recommended" || action === "Not Recommended") {
            if (!leave.sectionalHeadRecommendation) {
              updates.sectionalHeadRecommendation = action;
              updates.sectionalHeadDate = currentDate;
              updates.status = action === "Recommended" ? "RecommendedBySectional" : "Pending";
            } else if (!leave.departmentalHeadRecommendation) {
              updates.departmentalHeadRecommendation = action;
              updates.departmentalHeadDate = currentDate;
              updates.departmentalHeadDaysGranted = leave.daysApplied;
              updates.departmentalHeadStartDate = leave.startDate;
              updates.departmentalHeadLastDate = leave.endDate;
              updates.departmentalHeadResumeDate = calculateNextWorkingDay(leave.endDate);
              updates.status = action === "Recommended" ? "RecommendedByDepartmental" : "RecommendedBySectional";
            }
          }
        }
      }
      if (Object.keys(updates).length === 0) {
        setMessage({ type: "error", text: "Not authorized to perform this action" });
        addNotification("Not authorized to perform this action", "error");
        return;
      }

      await apiClient.patch(`/api/leaves/admin/leaves/${leaveId}`, updates, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });

      setMessage({ type: "success", text: `Leave ${action.toLowerCase()} successfully` });
      addNotification(`Leave ${action.toLowerCase()} successfully`, "success");
   } catch (error) {
    const errorMessage = error.response?.data?.error || "Failed to update leave";
    setMessage({ type: "error", text: errorMessage });
    addNotification(errorMessage, "error");
    if (error.response?.status === 401) {
      logout();
      navigate("/login");
    } else if (error.response?.status === 403) {
      setMessage({ type: "error", text: "You do not have permission to perform this action" });
      addNotification("You do not have permission to perform this action", "error");
    }
  }
};

  const handleLogout = () => {
    logout();
    navigate("/login");
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

  const handleViewDetails = (leave) => {
    setSelectedLeave(leave);
  };

  const handleCloseModal = () => {
    setSelectedLeave(null);
  };

  const handleCloseEventModal = () => {
    setSelectedEvent(null);
  };

  const isActiveLeave = (leave) => {
    const today = new Date();
    return (
      leave.approverRecommendation === "Approved" &&
      new Date(leave.startDate) <= today &&
      new Date(leave.endDate) >= today
    );
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

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "profilePicture") {
      setFormData({ ...formData, [name]: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    setFormErrors({ ...formErrors, [name]: "" });
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name) errors.name = "Name is required";
    if (!formData.email) {
      errors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      errors.email = "Invalid email format";
    }
    if (formData.phoneNumber && !validatePhoneNumber(formData.phoneNumber)) {
      errors.phoneNumber = "Invalid phone number format (e.g., +1234567890)";
    }
    if (!formData.department) errors.department = "Department is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProfileUpdate = async () => {
    if (!validateForm()) {
      setMessage({ type: "error", text: "Please fix the errors in the form" });
      addNotification("Please fix the errors in the form", "error");
      return;
    }

    try {
      const formDataToSend = new FormData();
      Object.keys(formData).forEach((key) => {
        if (key === "profilePicture" && formData[key]) {
          formDataToSend.append(key, formData[key]);
        } else if (formData[key]) {
          formDataToSend.append(key, formData[key]);
        }
      });

      const res = await apiClient.put("/api/admin/profile", formDataToSend, {
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
          "Content-Type": "multipart/form-data",
        },
        timeout: 5000,
      });
      setProfile(res.data.profile);
      setIsEditingProfile(false);
      setMessage({ type: "success", text: "Profile updated successfully" });
      addNotification("Profile updated successfully", "success");
    } catch (error) {
      const errorMsg = error.response
        ? `${error.response.status}: ${error.response.data.error || error.response.statusText}`
        : error.message;
      setMessage({ type: "error", text: `Failed to update profile: ${errorMsg}` });
      addNotification(`Failed to update profile: ${errorMsg}`, "error");
    }
  };


  const handleBulkAction = async (action) => {
  if (selectedLeaves.length === 0) {
    setMessage({ type: "warning", text: "No leaves selected" });
    return;
  }
  const confirm = window.confirm(`Are you sure you want to ${action.toLowerCase()} ${selectedLeaves.length} leave(s)?`);
  if (!confirm) return;

  try {
    await Promise.all(selectedLeaves.map((leaveId) =>
      apiClient.patch(`/api/leaves/admin/leaves/${leaveId}`, {
        approverRecommendation: action === "Approve" ? "Approved" : "Not Approved",
        approverDate: new Date().toISOString(),
        status: action === "Approve" ? "Approved" : "Rejected",
      }, { headers: { Authorization: `Bearer ${effectiveToken}` } })
    ));
    setMessage({ type: "success", text: `${action}ed ${selectedLeaves.length} leaves successfully` });
    setSelectedLeaves([]);
    await Promise.all([fetchLeaves(), fetchLeaveEvents()]);
 } catch (error) {
    const errorMessage = error.response?.data?.error || `Failed to ${action.toLowerCase()} leaves`;
    setMessage({ type: "error", text: errorMessage });
    addNotification(errorMessage, "error");
    if (error.response?.status === 401) {
      logout();
      navigate("/login");
    } else if (error.response?.status === 403) {
      setMessage({ type: "error", text: "You do not have permission to perform this action" });
      addNotification("You do not have permission to perform this action", "error");
    }
  }
};

const handleSort = (column) => {
  setSortColumn(column);
  setSortDirection(sortColumn === column && sortDirection === "asc" ? "desc" : "asc");
};

const handleEditClick = (leave) => {
  // Implement edit logic (e.g., open edit modal)
  console.log("Edit:", leave);
};

const handleDeleteClick = (leaveId) => {
  // Implement delete logic with confirmation
  const confirm = window.confirm("Are you sure you want to delete this leave?");
  if (confirm) {
    // Call API to delete
    console.log("Delete:", leaveId);
  }
};
  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setSearchParams({ ...searchParams, [name]: value });
  };

  const handleSearch = () => {
    fetchSearchedLeaves();
  };

  const menuItems = [
    { label: "Leave Analytics", icon: <BarChartIcon /> },
    { label: "Short Leave Requests", icon: <ListAltIcon /> },
    { label: "Annual Leave Requests", icon: <ListAltIcon /> },
    { label: "Approval Workflow", icon: <SettingsIcon /> },
    { label: "Leave Roster", icon: <PeopleIcon /> },
    { label: "Profile", icon: <PersonIcon /> },
    { label: "Calendar", icon: <CalendarTodayIcon /> },
    { label: "Logout", icon: <LogoutIcon /> },
  ];

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  if (!effectiveToken) {
    navigate("/login");
    return null;
  }

  return (
    <>
      <StyledAppBar position="fixed">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={toggleDrawer(true)} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Admin Dashboard
          </Typography>
          <Typography variant="subtitle1" sx={{ color: "#fff" }}>
            {effectiveUser.role}
          </Typography>
        </Toolbar>
      </StyledAppBar>

      <StyledDrawer anchor="left" open={drawerOpen} onClose={toggleDrawer(false)}>
        <List>
          {menuItems.map((item) => (
            <ListItem
              button
              key={item.label}
              onClick={() => handleMenuClick(item.label)}
              sx={{
                "&:hover": { bgcolor: "#e0e0e0" },
                bgcolor: activeSection === item.label ? "#d0d0d0" : "inherit",
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
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

          {activeSection === "Leave Analytics" && (
            <>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold", fontFamily: "'Roboto', sans-serif", color: "#333" }}>
                Leave Analytics
              </Typography>
              <Divider sx={{ mb: 4 }} />
              {/* Enhanced Stats Section */}
              <Grid container spacing={3} sx={{ mb: 5 }}>
                <Grid item xs={12} sm={3}>
                  <StyledStatsCard elevation={2} sx={{ bgcolor: "#e0e0e0" }}>
                    <Typography variant="h6" sx={{ fontWeight: "medium", color: "#555" }}>Total Leaves</Typography>
                    <Typography variant="h4" sx={{ color: "#333" }}>{stats.total}</Typography>
                  </StyledStatsCard>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <StyledStatsCard elevation={2} sx={{ bgcolor: "#c8e6c9" }}>
                    <Typography variant="h6" sx={{ fontWeight: "medium", color: "#555" }}>Approved</Typography>
                    <Typography variant="h4" sx={{ color: "#333" }}>{stats.approved}</Typography>
                  </StyledStatsCard>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <StyledStatsCard elevation={2} sx={{ bgcolor: "#ffcdd2" }}>
                    <Typography variant="h6" sx={{ fontWeight: "medium", color: "#555" }}>Rejected</Typography>
                    <Typography variant="h4" sx={{ color: "#333" }}>{stats.rejected}</Typography>
                  </StyledStatsCard>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <StyledStatsCard elevation={2} sx={{ bgcolor: "#ffe082" }}>
                    <Typography variant="h6" sx={{ fontWeight: "medium", color: "#555" }}>Pending</Typography>
                    <Typography variant="h4" sx={{ color: "#333" }}>{stats.pending}</Typography>
                  </StyledStatsCard>
                </Grid>
              </Grid>

              {/* Search Leaves Section */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: "medium", color: "#333" }}>
                Search Leaves
              </Typography>
              <Box sx={{ mb: 4 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Employee Name"
                      name="employeeName"
                      value={searchParams.employeeName}
                      onChange={handleSearchChange}
                      fullWidth
                      select
                      SelectProps={{ native: true }}
                      variant="outlined"
                    >
                      <option value="">Select Employee</option>
                      {users.map((user) => (
                        <option key={user._id} value={user.name}>
                          {user.name}
                        </option>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Leave Type"
                      name="leaveType"
                      value={searchParams.leaveType}
                      onChange={handleSearchChange}
                      fullWidth
                      select
                      SelectProps={{ native: true }}
                      variant="outlined"
                    >
                      <option value="">All</option>
                      <option value="Short Leave">Short Leave</option>
                      <option value="Annual Leave">Annual Leave</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Status"
                      name="status"
                      value={searchParams.status}
                      onChange={handleSearchChange}
                      fullWidth
                      select
                      SelectProps={{ native: true }}
                      variant="outlined"
                    >
                      <option value="">All</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      <option value="RecommendedBySectional">Recommended by Sectional</option>
                      <option value="RecommendedByDepartmental">Recommended by Departmental</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <StyledButton
                      variant="contained"
                      color="primary"
                      onClick={handleSearch}
                      startIcon={<SearchIcon />}
                      fullWidth
                    >
                      Search
                    </StyledButton>
                  </Grid>
                </Grid>
              </Box>

              {/* Search Results Table */}
              <TableContainer sx={{ maxHeight: "40vh", overflow: "auto" }}>
                <Table stickyHeader sx={{ width: "100%", tableLayout: "auto" }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>ID</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Employee</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Days</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Start Date</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>End Date</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", whiteSpace: "nowrap" }}>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaves.length > 0 ? (
                      leaves.map((leave) => (
                        <TableRow
                          key={leave._id}
                          hover
                          sx={{
                            "&:hover": { bgcolor: "#f0f0f0" },
                            bgcolor: isActiveLeave(leave) ? "#e0f7fa" : "inherit",
                          }}
                        >
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{leave._id.slice(-6)}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.employeeName}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.leaveType}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{leave.daysApplied}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{new Date(leave.startDate).toLocaleDateString()}</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{new Date(leave.endDate).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Tooltip title={leave.status}>
                              {getStatusChip(leave)}
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() => handleViewDetails(leave)}
                              variant="outlined"
                              size="small"
                              sx={{ borderRadius: 1 }}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          No leaves found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          

  {activeSection === "Short Leave Requests" && (
    <LeaveTable
      leaves={shortLeaves}
      isShortLeave={true}
      userRole={effectiveUser.role}
      showPendingActionsOnly={showPendingActionsOnly}
      setShowPendingActionsOnly={setShowPendingActionsOnly}
      handleAction={handleAction}
      handleViewDetails={handleViewDetails}
      selectedLeaves={selectedLeaves}
      setSelectedLeaves={setSelectedLeaves}
      handleBulkAction={handleBulkAction}
      specificRoleFilter={specificRoleFilter}
      setSpecificRoleFilter={setSpecificRoleFilter}
      filterParams={filterParams}
      setFilterParams={setFilterParams}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      handleSort={handleSort}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
      rowsPerPage={rowsPerPage}
      isActiveLeave={isActiveLeave}
      getStatusChip={getStatusChip}
      handleEditClick={handleEditClick}    
      handleDeleteClick={handleDeleteClick}
    />
  )}

  {activeSection === "Annual Leave Requests" && (
    <LeaveTable
      leaves={annualLeaves}
      isShortLeave={false}
      userRole={effectiveUser.role}
      showPendingActionsOnly={showPendingActionsOnly}
      setShowPendingActionsOnly={setShowPendingActionsOnly}
      handleAction={handleAction}
      handleViewDetails={handleViewDetails}
      selectedLeaves={selectedLeaves}
      setSelectedLeaves={setSelectedLeaves}
      handleBulkAction={handleBulkAction}
      specificRoleFilter={specificRoleFilter}
      setSpecificRoleFilter={setSpecificRoleFilter}
      filterParams={filterParams}
      setFilterParams={setFilterParams}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      handleSort={handleSort}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
      rowsPerPage={rowsPerPage}
      isActiveLeave={isActiveLeave}
      getStatusChip={getStatusChip}
      handleEditClick={handleEditClick}    
      handleDeleteClick={handleDeleteClick}
    />
  )}

  

 {activeSection === "Approval Workflow" && (
  <>
    <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
      Approval Workflow
    </Typography>
    <Divider sx={{ mb: 3 }} />
    <LeaveTable
      leaves={[...shortLeaves, ...annualLeaves]}
      isShortLeave={false} // Can be adjusted based on context
      userRole={effectiveUser.role}
      showPendingActionsOnly={showPendingActionsOnly}
      setShowPendingActionsOnly={setShowPendingActionsOnly}
      handleAction={handleAction}
      handleViewDetails={handleViewDetails}
      selectedLeaves={selectedLeaves}
      setSelectedLeaves={setSelectedLeaves}
      handleBulkAction={handleBulkAction}
      specificRoleFilter={specificRoleFilter}
      setSpecificRoleFilter={setSpecificRoleFilter}
      filterParams={filterParams}
      setFilterParams={setFilterParams}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      handleSort={handleSort}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
      rowsPerPage={rowsPerPage}
      isActiveLeave={isActiveLeave}
      getStatusChip={getStatusChip}
      handleEditClick={handleEditClick}    
      handleDeleteClick={handleDeleteClick}

    />
  </>
)}

          {activeSection === "Leave Roster" && (
            <>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
                Leave Roster
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <LeaveRoster />
            </>
          )}
         
          {activeSection === "Profile" && (
            <>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
                Admin Profile
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <ProfileTable profile={profile} />
            </>
          )}

          

    {activeSection === "Calendar" && (
      <LeaveCalendar
        calendarError={calendarError}
        isFetchingEvents={isFetchingEvents}
        fetchLeaveEvents={fetchLeaveEvents}
        events={events}
        setSelectedEvent={setSelectedEvent}
      />
    )}
  </Paper>
</MainContent>

       

      {/* Leave Details Modal */}
      <Modal open={!!selectedLeave} onClose={handleCloseModal}>
        <Box sx={modalStyle}>
          {selectedLeave && (
            <>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: "bold", mb: 3 }}>
                Leave Details
              </Typography>

              {/* Employee Information */}
              <Typography variant="h6" sx={{ fontWeight: "medium", mb: 2 }}>
                Employee Information
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>ID:</strong> {selectedLeave._id}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Employee:</strong> {selectedLeave.employeeName}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Person Number:</strong> {selectedLeave.personNumber || "N/A"}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Department:</strong> {selectedLeave.department}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Sector:</strong> {selectedLeave.sector || "N/A"}
                  </Typography>
                </Grid>
              </Grid>
              <Divider sx={{ mb: 3 }} />

              {/* Leave Details */}
              <Typography variant="h6" sx={{ fontWeight: "medium", mb: 2 }}>
                Leave Details
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Days Applied:</strong> {selectedLeave.daysApplied}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Start Date:</strong> {new Date(selectedLeave.startDate).toLocaleDateString()}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>End Date:</strong> {new Date(selectedLeave.endDate).toLocaleDateString()}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Reason:</strong> {selectedLeave.reason || "N/A"}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Address While Away:</strong> {selectedLeave.addressWhileAway || "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Email:</strong> {selectedLeave.emailAddress || "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Phone:</strong> {selectedLeave.phoneNumber || "N/A"}
                  </Typography>
                </Grid>
              </Grid>
              <Divider sx={{ mb: 3 }} />

              {/* Leave Balance */}
              <Typography variant="h6" sx={{ fontWeight: "medium", mb: 2 }}>
                Leave Balance
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Leave Balance BF:</strong> {selectedLeave.leaveBalanceBF || 0}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Current Year Leave:</strong> {selectedLeave.currentYearLeave || 0}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Total Leave Days:</strong> {selectedLeave.totalLeaveDays || "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Leave Taken This Year:</strong> {selectedLeave.leaveTakenThisYear || 0}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Leave Balance Due:</strong> {selectedLeave.leaveBalanceDue || "N/A"}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Leave Applied:</strong> {selectedLeave.leaveApplied || "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Leave Balance CF:</strong> {selectedLeave.leaveBalanceCF || "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Computed By:</strong> {selectedLeave.computedBy || "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Computed Date:</strong> {selectedLeave.computedDate ? new Date(selectedLeave.computedDate).toLocaleString() : "N/A"}
                  </Typography>
                </Grid>
              </Grid>
              <Divider sx={{ mb: 3 }} />

              {/* Approvals */}
              <Typography variant="h6" sx={{ fontWeight: "medium", mb: 2 }}>
                Approvals
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Sectional Head:</strong> {selectedLeave.sectionalHeadName || "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Sectional Recommendation:</strong>{" "}
                    {selectedLeave.status === "Approved" || selectedLeave.status === "Rejected"
                      ? selectedLeave.sectionalHeadRecommendation || "Recommended"
                      : selectedLeave.sectionalHeadRecommendation || "Pending"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Sectional Date:</strong>{" "}
                    {selectedLeave.sectionalHeadDate
                      ? new Date(selectedLeave.sectionalHeadDate).toLocaleString()
                      : selectedLeave.status === "Approved" || selectedLeave.status === "Rejected"
                      ? "Set during approval"
                      : "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Departmental Head:</strong> {selectedLeave.departmentalHeadName || "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Departmental Recommendation:</strong>{" "}
                    {selectedLeave.status === "Approved" || selectedLeave.status === "Rejected"
                      ? selectedLeave.departmentalHeadRecommendation || "Recommended"
                      : selectedLeave.departmentalHeadRecommendation || "Pending"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Departmental Date:</strong>{" "}
                    {selectedLeave.departmentalHeadDate
                      ? new Date(selectedLeave.departmentalHeadDate).toLocaleString()
                      : selectedLeave.status === "Approved" || selectedLeave.status === "Rejected"
                      ? "Set during approval"
                      : "N/A"}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Days Granted:</strong> {selectedLeave.departmentalHeadDaysGranted || "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Effective From:</strong>{" "}
                    {selectedLeave.departmentalHeadStartDate
                      ? new Date(selectedLeave.departmentalHeadStartDate).toLocaleDateString()
                      : "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Last Day:</strong>{" "}
                    {selectedLeave.departmentalHeadLastDate
                      ? new Date(selectedLeave.departmentalHeadLastDate).toLocaleDateString()
                      : "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Resume Date:</strong>{" "}
                    {selectedLeave.departmentalHeadResumeDate
                      ? new Date(selectedLeave.departmentalHeadResumeDate).toLocaleDateString()
                      : "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>HR Director:</strong> {selectedLeave.HRDirectorName || "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>HR Recommendation:</strong>{" "}
                    {selectedLeave.approverRecommendation || "Pending"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>HR Date:</strong>{" "}
                    {selectedLeave.approverDate
                      ? new Date(selectedLeave.approverDate).toLocaleString()
                      : "N/A"}
                  </Typography>
                  <Typography sx={{ mb: 1.5 }}>
                    <strong>Final Status:</strong> {selectedLeave.status}
                  </Typography>
                </Grid>
              </Grid>
              <Divider sx={{ mb: 3 }} />

              {/* Workflow Progress Section */}
              <Typography variant="h6" sx={{ fontWeight: "medium", mb: 2 }}>
                Workflow Progress
              </Typography>
              <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={12}>
                  {selectedLeave.status === "Pending" && (
                    <Typography sx={{ mb: 1.5, color: "#ff9800" }}>
                      Leave request submitted, awaiting Sectional Head recommendation.
                    </Typography>
                  )}
                  {(selectedLeave.sectionalHeadRecommendation || selectedLeave.status === "Approved" || selectedLeave.status === "Rejected") && (
                    <Typography sx={{ mb: 1.5, color: (selectedLeave.sectionalHeadRecommendation || selectedLeave.status === "Approved") === "Recommended" ? "#4caf50" : "#f44336" }}>
                      Sectional Head {selectedLeave.sectionalHeadRecommendation || "Recommended"} on{" "}
                      {selectedLeave.sectionalHeadDate
                        ? new Date(selectedLeave.sectionalHeadDate).toLocaleString()
                        : "Set during approval"}
                    </Typography>
                  )}
                  {(selectedLeave.departmentalHeadRecommendation || selectedLeave.status === "Approved" || selectedLeave.status === "Rejected") && (
                    <Typography sx={{ mb: 1.5, color: (selectedLeave.departmentalHeadRecommendation || selectedLeave.status === "Approved") === "Recommended" ? "#4caf50" : "#f44336" }}>
                      Departmental Head {selectedLeave.departmentalHeadRecommendation || "Recommended"} on{" "}
                      {selectedLeave.departmentalHeadDate
                        ? new Date(selectedLeave.departmentalHeadDate).toLocaleString()
                        : "Set during approval"}
                    </Typography>
                  )}
                  {selectedLeave.approverRecommendation && (
                    <Typography sx={{ mb: 1.5, color: selectedLeave.approverRecommendation === "Approved" ? "#4caf50" : "#f44336" }}>
                      HR Director {selectedLeave.approverRecommendation} on{" "}
                      {new Date(selectedLeave.approverDate).toLocaleString()}
                    </Typography>
                  )}
                  {selectedLeave.status === "Approved" && (
                    <Typography sx={{ mb: 1.5, color: "#4caf50" }}>
                      Leave request fully approved.
                    </Typography>
                  )}
                  {selectedLeave.status === "Rejected" && (
                    <Typography sx={{ mb: 1.5, color: "#f44336" }}>
                      Leave request rejected.
                    </Typography>
                  )}
                </Grid>
              </Grid>

              <Button onClick={handleCloseModal} variant="contained" color="primary" fullWidth sx={{ borderRadius: 1 }}>
                Close
              </Button>
            </>
          )}
        </Box>
      </Modal>

      {/* Event Details Modal */}
      <Modal open={!!selectedEvent} onClose={handleCloseEventModal}>
        <Box sx={modalStyle}>
          {selectedEvent && (
            <>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: "bold", mb: 3 }}>
                Event Details
              </Typography>
              <Typography sx={{ mb: 1.5 }}>
                <strong>Title:</strong> {selectedEvent.title}
              </Typography>
              <Typography sx={{ mb: 1.5 }}>
                <strong>Start:</strong> {selectedEvent.start.toLocaleDateString()}
              </Typography>
              <Typography sx={{ mb: 1.5 }}>
                <strong>End:</strong> {selectedEvent.end.toLocaleDateString()}
              </Typography>
              <Button onClick={handleCloseEventModal} variant="contained" color="primary" fullWidth sx={{ borderRadius: 1 }}>
                Close
              </Button>
            </>
          )}
        </Box>
      </Modal>
    </>
  );
};

export default AdminDashboard;