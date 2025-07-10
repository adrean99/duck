import { useState, useEffect, useContext, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import apiClient from "../utils/apiClient";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import {
  Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell, Button, Alert, Drawer,
  List, ListItem, ListItemText, ListItemIcon, IconButton, AppBar, Toolbar, Modal, Box,
  TableContainer, Chip, Tooltip, Divider, TextField, Grid, CircularProgress, Input,
  Checkbox, Menu, MenuItem, Collapse, Select, FormControl, InputLabel, Pagination, LinearProgress
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
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
import AdminLeaveRoster from "../components/AdminLeaveRoster";
import AuditLogs from "../components/AuditLogs";
import FilterListIcon from "@mui/icons-material/FilterList";
import SortIcon from "@mui/icons-material/Sort";
import DownloadIcon from "@mui/icons-material/Download";
import AssessmentIcon from "@mui/icons-material/Assessment";

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
/*
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
*/
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

const StyledButton = styled(Button)({
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

const MainContent = styled(Box)(({ theme }) => ({
  marginTop: 64, height: "calc(100vh - 64px)", width: "100%", overflow: "auto",
  background: "linear-gradient(135deg, #f5f7fa 0%, #e4e9f0 100%)",
}));

/*
// Helper functions
const getRowBackgroundColor = (leave) => {
  switch (leave.status) {
    case "Approved": return "#e8f5e9";
    case "Rejected": return "#ffebee";
    case "Pending": return "#fff3e0";
    default: return "transparent";
  }
};
*/
const getRowBackgroundColor = (leave) => ({
  "Approved": "#e8f5e9", "Rejected": "#ffebee", "Pending": "#fff3e0", default: "transparent",
}[leave.status] || "transparent");

const filterLeavesByPendingActions = (leaves, isShortLeave, userRole, showPendingActionsOnly, specificRoleFilter) => {
  let filteredLeaves = leaves;
  if (showPendingActionsOnly) {
    filteredLeaves = leaves.filter((leave) => {
      if (!leave.currentApprover) return false; // Skip if no current approver (e.g., already approved/rejected)
      if (userRole === "Admin") return true; // Admins see all pending
      if (isShortLeave) {
        // Short Leave: Director or HRDirector can act
        return (userRole === "Director" || userRole === "HRDirector") && leave.currentApprover === userRole;
      } else {
        // Annual Leave: Follow Director → DepartmentalHead → HRDirector
        return leave.currentApprover === userRole;
      }
    });
  }
  
  if (specificRoleFilter && specificRoleFilter !== "All") {
    filteredLeaves = filteredLeaves.filter((leave) => {
      if (isShortLeave) {
        return (specificRoleFilter === "Director" || specificRoleFilter === "HRDirector") && leave.currentApprover === specificRoleFilter;
      } else {
        return leave.currentApprover === specificRoleFilter;
      }
    });
  }
  return filteredLeaves;
};

const getProgress = (leave) => {
  if (leave.status === "Approved" || leave.status === "Rejected") return 100;
  if (!leave?.currentApprover) return 0;
  const approvals = leave.approvals || [];
  if (["Approved", "Rejected"].includes(leave.status)) return 100;
  let progress = 0;
  if (approvals.some(a => a.approverRole === "Director" && a.status === "Approved")) progress = 33;
  if (approvals.some(a => a.approverRole === "DepartmentalHead" && a.status === "Approved")) progress = 66;
  if (approvals.some(a => a.approverRole === "HRDirector" && a.status === "Approved")) progress = 100;
  return progress;
};



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
  setLeaves,
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
  handleDeleteClick,
  directorates,
  departments,
  isActionLoading,
  socket,
}) => {
  const [expandedLeaveId, setExpandedLeaveId] = useState(null);
  const [sortAnchorEl, setSortAnchorEl] = useState(null); // For sort menu
  const [progressMap, setProgressMap] = useState({});

  useEffect(() => {
    if (socket) {
      socket.on('leaveUpdate', (data) => {
        //setLeaves((prevLeaves) =>
          //prevLeaves.map((leave) =>
            //leave._id === data.leaveId ? { ...leave, status: data.status, progress: data.progress, currentApprover: data.currentApprover } : leave
          //)
        //);
      //});
      setProgressMap((prev) => ({ ...prev, [data.leaveId]: data.progress || 0 }));
        setSelectedLeaves((prev) => prev.filter(id => id !== data.leaveId)); // Deselect if updated
      });
      return () => {
        socket.off('leaveUpdate');
      };
    }
  }, [socket.setSelectedLeaves]);
/*
  const filteredLeaves = useMemo(() => {
    return filterLeavesByPendingActions(leaves, isShortLeave, userRole, showPendingActionsOnly, specificRoleFilter).filter(
      (leave) =>
        (!filterParams.status || leave.status === filterParams.status) &&
        (!filterParams.startDate || new Date(leave.startDate) >= new Date(filterParams.startDate)) &&
        (!filterParams.endDate || new Date(leave.endDate) <= new Date(filterParams.endDate)) &&
        (!filterParams.employeeName ||
          leave.employeeName.toLowerCase().includes(filterParams.employeeName.toLowerCase())) &&
        (!filterParams.directorate || leave.directorate === filterParams.directorate) &&
        (!filterParams.department || leave.department === filterParams.department)
    );
  }, [leaves, isShortLeave, userRole, showPendingActionsOnly, specificRoleFilter, filterParams]);
*/

const filteredLeaves = useMemo(() =>
    filterLeavesByPendingActions(leaves, isShortLeave, userRole, showPendingActionsOnly, specificRoleFilter).filter(
      (leave) => !filterParams.status || leave.status === filterParams.status ||
        !filterParams.startDate || new Date(leave.startDate) >= new Date(filterParams.startDate) ||
        !filterParams.endDate || new Date(leave.endDate) <= new Date(filterParams.endDate) ||
        !filterParams.employeeName || leave.employeeName.toLowerCase().includes(filterParams.employeeName.toLowerCase()) ||
        !filterParams.directorate || leave.directorate === filterParams.directorate ||
        !filterParams.department || leave.department === filterParams.department
    ), [leaves, isShortLeave, userRole, showPendingActionsOnly, specificRoleFilter, filterParams]);

  const sortedLeaves = useMemo(() =>
    [...filteredLeaves].sort((a, b) => {
      const aValue = sortColumn === "startDate" ? new Date(a[sortColumn]) : a[sortColumn];
      const bValue = sortColumn === "startDate" ? new Date(b[sortColumn]) : b[sortColumn];
      return sortDirection === "asc" ? (aValue < bValue ? -1 : aValue > bValue ? 1 : 0) : (aValue > bValue ? -1 : aValue < bValue ? 1 : 0);
    }), [filteredLeaves, sortColumn, sortDirection]);

    const paginatedLeaves = sortedLeaves.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleSortMenuOpen = (event) => setSortAnchorEl(event.currentTarget);
  const handleSortMenuClose = () => setSortAnchorEl(null);
  const applySort = (column, direction) => {
    handleSort(column);
    if (sortColumn === column && sortDirection === "asc" && direction === "asc") handleSort(column);
    handleSortMenuClose();
  };
/*
 const paginatedLeaves = [...(isShortLeave ? shortLeaves : annualLeaves)]
    .filter((leave) => {
      const matchesDirectorate = !filterParams.directorate || leave.directorate === filterParams.directorate;
      const matchesDepartment = !filterParams.department || leave.department === filterParams.department;
      const matchesPending = !showPendingActionsOnly || (leave.currentApprover && leave.status === "Pending");
      return matchesDirectorate && matchesDepartment && matchesPending;
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      if (sortColumn === "startDate") {
        return sortDirection === "asc"
          ? new Date(aValue) - new Date(bValue)
          : new Date(bValue) - new Date(aValue);
      }
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    })
    .slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
*/
  
/*
const getProgress = (leave) => {
  if (!leave || !leave.currentApprover) return 0;
  const approvals = leave.approvals || [];
  const approvalSequence = ["Director", "DepartmentalHead", "HRDirector"];
  const currentIndex = approvalSequence.indexOf(leave.currentApprover);

  if (leave.status === "Approved" || leave.status === "Rejected") return 100;
  if (currentIndex === -1) return 0; // All approvals complete or invalid state

  // Calculate progress based on completed approvals
  let progress = 0;
  if (approvals.some(a => a.approverRole === "Director" && a.status === "Approved")) progress = 33;
  if (approvals.some(a => a.approverRole === "DepartmentalHead" && a.status === "Approved")) progress = 66;
  if (approvals.some(a => a.approverRole === "HRDirector" && a.status === "Approved")) progress = 100;

  return progress;
};
*/
  // Handle export to CSV
  const handleExport = () => {
    const headers = [
      "ID",
      "Employee Name",
      "Days Applied",
      "Start Date",
      "End Date",
      "Status",
      "Progress (%)",
      "Person Number",
      "Department",
      "Directorate",
      "Reason",
      "Address While Away",
      "Email",
      "Phone",
      "Leave Balance BF",
      "Current Year Leave",
      "Total Leave Days",
      "Leave Taken This Year",
      "Leave Balance Due",
      "Director Name",
      "Director Recommendation",
      "Director Date",
      "Departmental Head Name",
      "Departmental Head Recommendation",
      "Departmental Head Date",
      "HR Director Name",
      "HR Director Recommendation",
      "HR Director Date",
    ];

    const rows = filteredLeaves.map((leave) => [
      leave._id,
      leave.employeeName,
      leave.daysApplied,
      new Date(leave.startDate).toLocaleDateString(),
      new Date(leave.endDate).toLocaleDateString(),
      leave.status,
      Math.round(getProgress(leave)),
      leave.personNumber || "N/A",
      leave.department || "N/A",
      leave.directorate || "N/A",
      leave.reason || "N/A",
      leave.addressWhileAway || "N/A",
      leave.emailAddress || "N/A",
      leave.phoneNumber || "N/A",
      leave.leaveBalanceBF || 0,
      leave.currentYearLeave || 0,
      leave.totalLeaveDays || "N/A",
      leave.leaveTakenThisYear || 0,
      leave.leaveBalanceDue || "N/A",
      leave.directorName || "N/A",
      leave.directorRecommendation || "Pending",
      leave.directorDate ? new Date(leave.directorDate).toLocaleString() : "N/A",
      leave.departmentalHeadName || "N/A",
      leave.departmentalHeadRecommendation || "Pending",
      leave.departmentalHeadDate ? new Date(leave.departmentalHeadDate).toLocaleString() : "N/A",
      leave.HRDirectorName || "N/A",
      leave.HRDirectorRecommendation || "Pending",
      leave.HRDirectorDate ? new Date(leave.HRDirectorDate).toLocaleString() : "N/A",
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${isShortLeave ? "short_leaves" : "annual_leaves"}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
/*
  // Sort menu handlers
  const handleSortMenuOpen = (event) => {
    setSortAnchorEl(event.currentTarget);
  };

  const handleSortMenuClose = () => {
    setSortAnchorEl(null);
  };

  const applySort = (column, direction) => {
    handleSort(column);
    handleSort(column); // Call twice to toggle direction if same column
    if (sortColumn === column && sortDirection === "asc" && direction === "asc") {
      handleSort(column); // Toggle to desc if already asc
    }
    handleSortMenuClose();
  };
*/
  return (
    <>
      <Typography
        variant="h5"
        sx={{
          mb: 4,
          fontWeight: 700,
          color: "#2d3748",
          fontFamily: "'Roboto', sans-serif",
        }}
      >
        {isShortLeave ? "Short Leave Requests" : "Annual Leave Requests"}
      </Typography>

      {(userRole === "HRDirector" || userRole === "Admin") && (
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Directorate</InputLabel>
                <Select
                  value={filterParams.directorate}
                  onChange={(e) => setFilterParams({ ...filterParams, directorate: e.target.value })}
                  label="Directorate"
                >
                  <MenuItem value="">All Directorates</MenuItem>
                  {Array.isArray(directorates) && directorates.length > 0 ? directorates.map((dir) => (
                    <MenuItem key={dir} value={dir}>{dir}</MenuItem>
                  )) : <MenuItem value="" disabled>No Directorates Available</MenuItem>}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  value={filterParams.department}
                  onChange={(e) => setFilterParams({ ...filterParams, department: e.target.value })}
                  label="Department"
                >
                 <MenuItem value="">All Departments</MenuItem>
                  {Array.isArray(departments) && departments.length > 0 ? departments.map((dept) => (
                    <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                  )) : <MenuItem value="" disabled>No Departments Available</MenuItem>}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
      )}

      <Box sx={{ mb: 3, display: "flex", gap: 2 }}>
        <Button
          variant={showPendingActionsOnly ? "contained" : "outlined"}
          color="primary"
          startIcon={<FilterListIcon />}
          onClick={() => setShowPendingActionsOnly(!showPendingActionsOnly)}
          sx={{
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 500,
            bgcolor: showPendingActionsOnly ? "#1976d2" : "transparent",
            color: showPendingActionsOnly ? "#fff" : "#1976d2",
            "&:hover": {
              bgcolor: showPendingActionsOnly ? "#1565c0" : "#e3f2fd",
            },
            px: 3,
          }}
        >
          {showPendingActionsOnly ? "Show All Leaves" : "Show Pending Leaves"}
        </Button>

        <Button
          variant="outlined"
          color="primary"
          startIcon={<SortIcon />}
          onClick={handleSortMenuOpen}
          sx={{
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 500,
            borderColor: "#1976d2",
            color: "#1976d2",
            "&:hover": {
              borderColor: "#1565c0",
              bgcolor: "#e3f2fd",
            },
            px: 3,
          }}
        >
          Sort Leaves</Button>
        <Menu anchorEl={sortAnchorEl} open={Boolean(sortAnchorEl)} onClose={handleSortMenuClose} PaperProps={{ sx: { mt: 1, boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)", borderRadius: 2 } }}>
          {["employeeName", "startDate", "status"].map((column) => ["asc", "desc"].map((dir) => (
            <MenuItem key={`${column}-${dir}`} onClick={() => applySort(column, dir)}>
              {`${column === "employeeName" ? "Employee Name" : column === "startDate" ? "Start Date" : "Status"} (${dir === "asc" ? "A-Z" : "Z-A"})`}
            </MenuItem>
          )))}
        </Menu>

        <Button
          variant="outlined"
          color="primary"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          sx={{
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 500,
            borderColor: "#1976d2",
            color: "#1976d2",
            "&:hover": {
              borderColor: "#1565c0",
              bgcolor: "#e3f2fd",
            },
            px: 3,
          }}
        >
          Export Leaves
        </Button>
      </Box>

      {selectedLeaves.length > 0 && (
        <Box
          sx={{
            mb: 3,
            display: "flex",
            gap: 2,
            position: "sticky",
            top: 0,
            bgcolor: "#fafafa",
            zIndex: 1,
            p: 1,
            borderRadius: 2,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
          }}
        >
          <Button
            variant="contained"
            color="success"
            onClick={() => handleBulkAction("approve")}
            disabled={isActionLoading || selectedLeaves.length === 0}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              bgcolor: "#38a169",
              "&:hover": { bgcolor: "#2f855a" },
              px: 3,
            }}
          >
           {isActionLoading ? <CircularProgress size={24} /> : "Approve Selected"}
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => handleBulkAction("reject")}
            disabled={isActionLoading || selectedLeaves.length === 0}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              borderColor: "#e53e3e",
              color: "#e53e3e",
              "&:hover": { borderColor: "#c53030", color: "#c53030", bgcolor: "#fefcbf" },
              px: 3,
            }}
          >
            {isActionLoading ? <CircularProgress size={24} /> : "Reject Selected"}
          </Button>
        </Box>
      )}

      <TableContainer
        sx={{
          maxHeight: 500,
          overflowX: "auto",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
          borderRadius: 2,
          border: "1px solid #e0e0e0",
          bgcolor: "#fff",
        }}
      >
        <Table stickyHeader sx={{ minWidth: "1200px" }}>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 700,
                  bgcolor: "#f7fafc",
                  color: "#2d3748",
                  borderBottom: "2px solid #e0e0e0",
                  px: 3,
                  py: 2,
                }}
              >
                <Checkbox
                  checked={paginatedLeaves.length > 0 && selectedLeaves.length === paginatedLeaves.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedLeaves(paginatedLeaves.map((l) => l._id));
                    else setSelectedLeaves([]);
                  }}
                  aria-label="Select all leaves"
                  sx={{ color: "#718096", "&.Mui-checked": { color: "#1976d2" } }}
                />
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 700,
                  bgcolor: "#f7fafc",
                  color: "#2d3748",
                  borderBottom: "2px solid #e0e0e0",
                  px: 3,
                  py: 2,
                }}
                onClick={() => handleSort("employeeName")}
              >
                Employee {sortColumn === "employeeName" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 700,
                  bgcolor: "#f7fafc",
                  color: "#2d3748",
                  borderBottom: "2px solid #e0e0e0",
                  px: 3,
                  py: 2,
                }}
              >
                Days
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 700,
                  bgcolor: "#f7fafc",
                  color: "#2d3748",
                  borderBottom: "2px solid #e0e0e0",
                  px: 3,
                  py: 2,
                }}
                onClick={() => handleSort("startDate")}
              >
                Start Date {sortColumn === "startDate" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 700,
                  bgcolor: "#f7fafc",
                  color: "#2d3748",
                  borderBottom: "2px solid #e0e0e0",
                  px: 3,
                  py: 2,
                }}
              >
                End Date
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 700,
                  bgcolor: "#f7fafc",
                  color: "#2d3748",
                  borderBottom: "2px solid #e0e0e0",
                  px: 3,
                  py: 2,
                }}
                onClick={() => handleSort("status")}
              >
                Status {sortColumn === "status" && (sortDirection === "asc" ? "↑" : "↓")}
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: 700,
                  bgcolor: "#f7fafc",
                  color: "#2d3748",
                  borderBottom: "2px solid #e0e0e0",
                  px: 3,
                  py: 2,
                }}
              >
                Progress
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedLeaves.length > 0 ? (
              paginatedLeaves.map((leave) => (
                <>
                  <TableRow
                    key={leave._id}
                    hover
                    onClick={() => setExpandedLeaveId(expandedLeaveId === leave._id ? null : leave._id)}
                    sx={{
                      "&:hover": { bgcolor: "#edf2f7" },
                      bgcolor: isActiveLeave(leave) ? "#e6fffa" : "inherit",
                      transition: "background-color 0.3s ease",
                      cursor: "pointer",
                      borderBottom: "1px solid #e0e0e0",
                    }}
                  >
                    <TableCell sx={{ px: 3, py: 2 }}>
                      <Checkbox
                        checked={selectedLeaves.includes(leave._id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedLeaves([...selectedLeaves, leave._id]);
                          else setSelectedLeaves(selectedLeaves.filter((id) => id !== leave._id));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select leave ${leave._id}`}
                        sx={{ color: "#718096", "&.Mui-checked": { color: "#1976d2" } }}
                      />
                    </TableCell>
                    <TableCell sx={{ px: 3, py: 2, color: "#4a5568" }}>{leave.employeeName}</TableCell>
                    <TableCell sx={{ px: 3, py: 2, color: "#4a5568" }}>{leave.daysApplied}</TableCell>
                    <TableCell sx={{ px: 3, py: 2, color: "#4a5568" }}>
                      {new Date(leave.startDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell sx={{ px: 3, py: 2, color: "#4a5568" }}>
                      {new Date(leave.endDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1 }}>
                      <Tooltip title={leave.status}>
                        {getStatusChip(leave)}
                      </Tooltip>
                      {expandedLeaveId === leave._id ? (
                        <ExpandLessIcon sx={{ color: "#718096" }} />
                      ) : (
                        <ExpandMoreIcon sx={{ color: "#718096" }} />
                      )}
                    </TableCell>
                    <TableCell sx={{ px: 3, py: 2 }}>
  <Box sx={{ display: "flex", alignItems: "center" }}>
    <Box sx={{ width: "100%", mr: 1 }}>
      <LinearProgress
        variant="determinate"
        value={progressMap[leave._id] || getProgress(leave)} // Use state-based progress if available
        sx={{
          "& .MuiLinearProgress-bar": {
            bgcolor: "#1976d2",
          },
        }}
      />
    </Box>
    <Box sx={{ minWidth: 35 }}>
      <Typography variant="body2" sx={{ color: "#718096" }}>
        {`${Math.round(progressMap[leave._id] || getProgress(leave))}%`}
      </Typography>
    </Box>
  </Box>
</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ padding: 0, borderBottom: "1px solid #e0e0e0" }}>
                      <Collapse in={expandedLeaveId === leave._id} timeout="auto" unmountOnExit>
                        <Box
                          sx={{
                            p: 3,
                            bgcolor: "linear-gradient(145deg, #f7fafc, #edf2f7)",
                            border: "1px solid #e2e8f0",
                            borderRadius: 2,
                            mx: 2,
                            mb: 2,
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
                          }}
                        >
                          <Typography
                            variant="h6"
                            gutterBottom
                            sx={{ fontWeight: 600, color: "#2d3748", mb: 3 }}
                          >
                            Leave Details
                          </Typography>
                          <Box sx={{ mb: 3 }}>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 500, color: "#4a5568", mb: 1 }}
                            >
                              Employee Information
                            </Typography>
                            <Grid container spacing={3}>
                              <Grid item xs={12} sm={6}>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>ID:</strong> {leave._id}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Employee:</strong> {leave.employeeName}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Person Number:</strong> {leave.personNumber || "N/A"}
                                </Typography>
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Department:</strong> {leave.department || "N/A"}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Directorate:</strong> {leave.directorate || "N/A"}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Box>
                          <Box sx={{ mb: 3 }}>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 500, color: "#4a5568", mb: 1 }}
                            >
                              Leave Details
                            </Typography>
                            <Grid container spacing={3}>
                              <Grid item xs={12} sm={6}>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Days Applied:</strong> {leave.daysApplied}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Start Date:</strong>{" "}
                                  {new Date(leave.startDate).toLocaleDateString()}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>End Date:</strong>{" "}
                                  {new Date(leave.endDate).toLocaleDateString()}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Reason:</strong> {leave.reason || "N/A"}
                                </Typography>
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Address While Away:</strong>{" "}
                                  {leave.addressWhileAway || "N/A"}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Email:</strong> {leave.emailAddress || "N/A"}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Phone:</strong> {leave.phoneNumber || "N/A"}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Box>
                          <Box sx={{ mb: 3 }}>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 500, color: "#4a5568", mb: 1 }}
                            >
                              Leave Balance
                            </Typography>
                            <Grid container spacing={3}>
                              <Grid item xs={12} sm={6}>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Leave Balance BF:</strong> {leave.leaveBalanceBF || 0}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Current Year Leave:</strong> {leave.currentYearLeave || 0}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Total Leave Days:</strong> {leave.totalLeaveDays || "N/A"}
                                </Typography>
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Leave Taken This Year:</strong>{" "}
                                  {leave.leaveTakenThisYear || 0}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Leave Balance Due:</strong> {leave.leaveBalanceDue || "N/A"}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Box>
                          <Box sx={{ mb: 3 }}>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 500, color: "#4a5568", mb: 1 }}
                            >
                               Approvals
                            </Typography>
                            <Grid container spacing={3}>
                              <Grid item xs={12} sm={4}>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Director:</strong> {leave.directorName || "N/A"}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Recommendation:</strong>{" "}
                                  {leave.directorRecommendation || "Pending"}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Date:</strong>{" "}
                                  {leave.directorDate
                                    ? new Date(leave.directorDate).toLocaleString()
                                    : "N/A"}
                                </Typography>
                              </Grid>
                              <Grid item xs={12} sm={4}>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Departmental Head:</strong> {leave.departmentalHeadName || "N/A"}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Recommendation:</strong>{" "}
                                  {leave.departmentalHeadRecommendation || "Pending"}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Date:</strong>{" "}
                                  {leave.departmentalHeadDate
                                    ? new Date(leave.departmentalHeadDate).toLocaleString()
                                    : "N/A"}
                                </Typography>
                              </Grid>
                              <Grid item xs={12} sm={4}>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>HR Director:</strong> {leave.HRDirectorName || "N/A"}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Recommendation:</strong>{" "}
                                  {leave.HRDirectorRecommendation || "Pending"}
                                </Typography>
                                <Typography sx={{ color: "#718096", mb: 1 }}>
                                  <strong>Date:</strong>{" "}
                                  {leave.HRDirectorDate
                                    ? new Date(leave.HRDirectorDate).toLocaleString()
                                    : "N/A"}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Box>
                          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3, gap: 2 }}>
                          <Button
                              variant="contained"
                              color="success"
                              onClick={() => handleAction(leave._id, "approve")}
                              disabled={isActionLoading}
                              sx={{ 
                                borderRadius: 2,
                                  textTransform: "none",
                                  fontWeight: 500,
                                  px: 3, 
                                }}
                                >
                                 {isActionLoading ? <CircularProgress size={24} /> : "approve"}
                          </Button>
                          <Button
                              variant="outlined"
                                color="error"
                               onClick={() => handleAction(leave._id, "reject")}
                               disabled={isActionLoading}
                                sx={{
                                  borderRadius: 2,
                                  textTransform: "none",
                                  fontWeight: 500,
                                  px: 3,
                                 }}
                                 >
                                  {isActionLoading ? <CircularProgress size={24} /> : "reject"}
                           </Button>
                           </Box>
                          {(userRole === "HRDirector" || userRole === "Admin") && (
                            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
                              <Button
                                variant="contained"
                                color="error"
                                onClick={() => handleDeleteClick(leave._id)}
                                sx={{
                                  borderRadius: 2,
                                  textTransform: "none",
                                  fontWeight: 500,
                                  bgcolor: "#e53e3e",
                                  "&:hover": { bgcolor: "#c53030" },
                                  px: 3,
                                }}
                              >
                                Delete
                              </Button>
                            </Box>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  align="center"
                  sx={{ py: 4, color: "#718096", fontStyle: "italic" }}
                >
                  {showPendingActionsOnly
                    ? "No pending actions for your role"
                    : `No ${isShortLeave ? "short" : "annual"} leave requests found`}
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
        sx={{
          mt: 3,
          display: "flex",
          justifyContent: "center",
          "& .MuiPaginationItem-root": {
            color: "#4a5568",
            "&.Mui-selected": {
              bgcolor: "#1976d2",
              color: "#fff",
              "&:hover": { bgcolor: "#1565c0" },
            },
          },
        }}
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
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showPendingActionsOnly, setShowPendingActionsOnly] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    department: "",
    phoneNumber: "",
    profilePicture: null,
    chiefOfficerName: "",
    personNumber: "",
    email: "",
    directorate: "",
    directorName: "",
    departmentalHeadName: "",
    HRDirectorName: "",
  });
  const [users, setUsers] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [searchParams, setSearchParams] = useState({
    employeeName: "",
    leaveType: "",
    status: "",
  });
  const [selectedLeaves, setSelectedLeaves] = useState([]);
  const [specificRoleFilter, setSpecificRoleFilter] = useState("All");
  const [filterParams, setFilterParams] = useState({
    status: "",
    startDate: "",
    endDate: "",
    employeeName: "",
    directorate: "",
    department: "",
  });
  const [sortColumn, setSortColumn] = useState("startDate");
  const [sortDirection, setSortDirection] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [directorates, setDirectorates] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [expandedLeaveId, setExpandedLeaveId] = useState(null);
  const [messageActive, setMessageActive] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMap, setProgressMap] = useState({});
  const localToken = localStorage.getItem("token");
  const effectiveToken = token || localToken;
  const effectiveUser = user || JSON.parse(localStorage.getItem("user") || "{}");
  const [socket,setSocket] = useState(null);


   useEffect(() => {
  const fetchMetadata = async () => {
      try {
        const response = await apiClient.get("/api/metadata");
        console.log("Metadata response:", response.data);
        setDepartments(response.data.departments || []);
        setDirectorates(response.data.directorates || []);
      } catch (error) {
        console.error("Error fetching metadata:", error);
        setDepartments([]);
        setDirectorates([]);
      }
    };
    fetchMetadata();
  }, []);

  const fetchLeaves = useCallback(async (leaveType) => {
    try {
      let query = `leaveType=${leaveType}`;
     if (effectiveUser.role === "Director" && profile?.directorate) query += `&directorate=${profile.directorate}`;
      else if (effectiveUser.role === "DepartmentalHead" && profile?.department) query += `&department=${profile.department}`;

      const res = await apiClient.get(`/api/leaves/admin/leaves?${query}`, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
        timeout: 5000,
      });
      console.log(`Fetched ${leaveType} leaves:`, res.data);
      if (leaveType === "Short Leave") setShortLeaves(Array.isArray(res.data) ? res.data : []);
      else setAnnualLeaves(Array.isArray(res.data) ? res.data : []);
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
    }
  }, [effectiveToken, effectiveUser, profile]);

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
        personNumber: res.data.personNumber || "",
        email: res.data.email || "",
        directorate: res.data.directorate || "",
        directorName: res.data.directorName || "",
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
        ? "Users endpoint not found (404). Check backend route setup for /api/users."
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
/*
  const fetchOptions = async () => {
    setIsFetchingOptions(true);
    try {
      const [directoratesResp, deptsResp] = await Promise.all([
        apiClient.get("/api/directorates"),
        apiClient.get("/api/departments-directorates"),
      ]);
      setDirectorates(directoratesResp.data);
      setDepartments(deptsResp.data);
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Failed to fetch options";
      setMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
    } finally {
      setIsFetchingOptions(false);
    }
  };
*/
  const getStatusCounts = (leaves) => {
    const counts = {
      Total: { total: leaves.length, Annual: 0, Short: 0 },
      Pending: { total: 0, Annual: 0, Short: 0 },
      Approved: { total: 0, Annual: 0, Short: 0 },
      Rejected: { total: 0, Annual: 0, Short: 0 },
      RecommendedByDirector: { total: 0, Annual: 0, Short: 0 },
      RecommendedByDepartmental: { total: 0, Annual: 0, Short: 0 },
    };

    leaves.forEach((leave) => {
      const leaveTypeKey = leave.leaveType === "Annual Leave" ? "Annual" : "Short";
      if (counts.hasOwnProperty(leave.status)) {
        counts[leave.status].total++;
        counts[leave.status][leaveTypeKey]++;
      }
      counts.Total[leaveTypeKey]++;
    });

    return counts;
  };

  const statusCounts = useMemo(() => getStatusCounts(leaves), [leaves]);

  useEffect(() => {
    if (!effectiveToken) {
      navigate("/login");
      return;
    }

    const socketInstance = io("http://localhost:5000", {
      auth: { token: effectiveToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on("connect", () => {
      console.log("WebSocket connected");
    });
/*
    if (selectedDirectorate) {
      socket.emit('subscribe', { room: `directorate_${selectedDirectorate}` });
    }

    socketInstance.on('rosterUpdate', (data) => {
      if ((data.directorate === selectedDirectorate || !selectedDirectorate) && (data.department === selectedDepartment || !selectedDepartment)) {
        // Handle roster updates if needed
      }
    });
*/
    socketInstance.on('leaveUpdate', (data) => {
      console.log("Received leaveUpdate: ", data)
   setProgressMap((prev) => ({ ...prev, [data.leaveId]: data.progress || 0 }));
    setShortLeaves((prev) =>
      prev.map((leave) => (leave._id === data.leaveId ? { ...leave, status: data.status, progress: data.progress || 0, currentApprover: data.currentApprover } : leave))
    );
    setAnnualLeaves((prev) =>
      prev.map((leave) => (leave._id === data.leaveId ? { ...leave, status: data.status, progress: data.progress || 0, currentApprover: data.currentApprover } : leave))
    );
    setLeaves((prev) =>
        prev.map((leave) =>
          leave._id === data.leaveId
            ? { ...leave, status: data.status, progress: data.progress || 0, currentApprover: data.currentApprover }
            : leave
        )
      );
  });

    socketInstance.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      setMessage({ type: "error", text: "Failed to connect to real-time updates" });
      addNotification("Failed to connect to real-time updates", "error");
      setMessageActive(true);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("WebSocket disconnected. Reason:", reason);
    });

    setSocket(socketInstance);

    Promise.all([fetchLeaves("Short Leave"), fetchLeaves("Annual Leave"), fetchLeaveEvents()]);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    if (message.text) {
      setMessageActive(true);
      const timer = setTimeout(() => setMessageActive(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (!effectiveToken || !effectiveUser || !effectiveUser?.role) {
      navigate("/login");
      return;
    }

    console.log("Current role:", effectiveUser.role);

    const allowedRoles = ["Admin", "Director", "DepartmentalHead", "HRDirector"];
    console.log(`User role '${effectiveUser.role}' is allowed?`, allowedRoles.includes(effectiveUser.role));
    if (!allowedRoles.includes(effectiveUser.role)) {
      setMessage({ type: "error", text: `Access restricted to roles: ${allowedRoles.join(", ")}` });
      addNotification(`Access restricted to roles: ${allowedRoles.join(", ")}`, "error");
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([fetchLeaves("Short Leave"),fetchLeaves("Annual Leave"), fetchProfile(), fetchLeaveEvents(), fetchStats(), fetchUsers()]);
      setIsLoading(false);
      setIsAuthReady(true);
    };

    fetchData();
  }, []);

  const handleAction = async (leaveId, action) => {
  setIsActionLoading(true);
  try {
    console.log(`handleAction called: leaveId=${leaveId}, action=${action}`);
    const response = await apiClient.get(`/api/leaves/admin/leaves?leaveType=Annual Leave`);
    const leaves = response.data;
    const leave = [...shortLeaves, ...annualLeaves].find((l) => l._id === leaveId);
    if (!leave) {
      throw new Error("Leave not found");
    }
    console.log("Leave state:", { currentApprover: leave.currentApprover, status: leave.status, directorDate: leave.directorDate });
    if (effectiveUser.role !== leave.currentApprover && effectiveUser.role !== "Admin") {
      throw new Error("Not your turn to approve");
    }
    const actionMap = {
      approve: "Approved",
      reject: "Rejected",
    };
    const normalizedAction = actionMap[action.toLowerCase()];
    if (!normalizedAction) {
      throw new Error("Invalid action. Must be 'approve' or 'reject'");
    }

    const updates = {
        status: normalizedAction,
        comment: `${normalizedAction.toLowerCase()}ed by ${effectiveUser.role}`,
      };

    const patchResponse = await apiClient.patch(`/api/leaves/approve/${leaveId}`, updates);
    if (patchResponse.data?.error) {
      throw new Error(patchResponse.data.error);
    }
    const updatedLeave = patchResponse.data;
    setMessage({ type: "success", text: `Leave ${normalizedAction.toLowerCase()}d successfully` });
    setMessageActive(true);
    const { progress } = patchResponse.data;
   setProgressMap((prev) => ({ ...prev, [leaveId]: progress || 0 })); // Update progress bar
   // Update both short and annual leaves with the full response
    setShortLeaves((prev) => prev.map(l => l._id === leaveId ? updatedLeave : l));
    setAnnualLeaves((prev) => prev.map(l => l._id === leaveId ? updatedLeave : l));
    await Promise.all([fetchLeaves("Short Leave"), fetchLeaves("Annual Leave"), fetchLeaveEvents()]);
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message || "Failed to update leave - unknown error";
    console.error("Error in handleAction:", {
      message: errorMessage,
      status: error.response?.status,
      fullError: error,
    });
    setMessage({ type: "error", text: errorMessage });
    setMessageActive(true);
    if (error.response?.status === 401) {
      setMessage({ type: "error", text: "Unauthorized - logging out" });
      logout();
      navigate("/login");
    } else if (error.response?.status === 403) {
      setMessage({ type: "error", text: "You do not have permission to perform this action" });
    }
    await Promise.all([fetchLeaves("Short Leave"), fetchLeaves("Annual Leave")]);
  } finally {
    setIsActionLoading(false);
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
      case "Pending":
      default:
        return <Chip label="Pending" color="warning" size="small" />;
    }
  };

  /*const validateForm = () => {
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
  */

  const handleBulkAction = async (action) => {
  if (selectedLeaves.length === 0) {
    setMessage({ type: "warning", text: "No leaves selected" });
    setMessageActive(true);
    return;
  }
  const confirm = window.confirm(`Are you sure you want to ${action.toLowerCase()} ${selectedLeaves.length} leave(s)?`);
  if (!confirm) return;

  setIsActionLoading(true);
  const errors = [];
  try {
    console.log(`handleBulkAction called: action=${action}, selectedLeaves=${selectedLeaves}`);

   const actionMap = {
      approve: "Approved",
      reject: "Rejected",
    };
    const normalizedAction = actionMap[action.toLowerCase()];
    if (!normalizedAction) {
      throw new Error("Invalid action. Must be 'approve' or 'reject'");
    }

    await Promise.all(
      selectedLeaves.map(async (leaveId) => {
        try {
          const leave = [...shortLeaves, ...annualLeaves].find((l) => l._id === leaveId);
          if (!leave) {
            throw new Error(`Leave ${leaveId.slice(-6)} not found`);
          }
          console.log("Leave state:", { currentApprover: leave.currentApprover, status: leave.status, directorDate: leave.directorDate });
          if (leave.currentApprover && effectiveUser.role !== leave.currentApprover && effectiveUser.role !== "Admin") {
            throw new Error(`Leave ${leaveId.slice(-6)}: Not your turn to approve`);
          }
          if (effectiveUser.role === "Director" && (leave.directorRecommendation || leave.directorDate)) {
            throw new Error(`Leave ${leaveId.slice(-6)}: Director has already approved or rejected this leave`);
          }
          const response = await apiClient.patch(`/api/leaves/approve/${leaveId}`, {
            status: normalizedAction,
            comment: `${normalizedAction.toLowerCase()}ed via bulk action`,
          });
          if (response.data?.error) {
            throw new Error(response.data.error);
          }
        } catch (error) {
          const errorMessage = error.response?.data?.error || error.message || `Failed to ${action.toLowerCase()} leave ${leaveId.slice(-6)}`;
          console.error(`Error processing leave ${leaveId}:`, errorMessage);
          errors.push(errorMessage);
        }
      })
    );
    if (errors.length > 0) {
      setMessage({ type: "error", text: `Some actions failed: ${errors.join("; ")}` });
    } else {
      setMessage({ type: "success", text: `${normalizedAction}ed ${selectedLeaves.length} leaves successfully` });
    }
    setSelectedLeaves([]);
    await Promise.all([fetchLeaves("Short Leave"), fetchLeaves("Annual Leave"), fetchLeaveEvents()]);
  } catch (error) {
    console.error("Unexpected error in handleBulkAction:", error);
    setMessage({ type: "error", text: "An unexpected error occurred during bulk action" });
  } finally {
    setIsActionLoading(false);
    setMessageActive(true);
  }
};

  const handleSort = (column) => {
    setSortColumn(column);
    setSortDirection(sortColumn === column && sortDirection === "asc" ? "desc" : "asc");
  };

  const handleEditClick = (leave) => {
    console.log("Edit:", leave);
  };

   const handleDeleteClick = async (leaveId) => {
    const confirm = window.confirm("Are you sure you want to delete this leave?");
    if (confirm) {
      try {
        await apiClient.delete(`/api/leaves/approve/${leaveId}`, {
          headers: { Authorization: `Bearer ${effectiveToken}` },
        });
        setMessage({ type: "success", text: "Leave deleted successfully" });
        addNotification("Leave deleted successfully", "success");
        await Promise.all([fetchLeaves("Short Leave"), fetchLeaves("Annual Leave"), fetchLeaveEvents()]);
      } catch (error) {
        const errorMessage = error.response?.data?.error || "Failed to delete leave";
        setMessage({ type: "error", text: errorMessage });
        addNotification(errorMessage, "error");
      }
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
    { label: "Audit Logs", icon: <AssessmentIcon /> },
    { label: "Logout", icon: <LogoutIcon /> },
  ];

  if (isLoading  || !isAuthReady) {
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

      <MainContent sx={{ height: "100vh", overflowY: "auto" }}>
        <Paper elevation={3} sx={{ p: 6, minHeight: "100%", width: "100%", borderRadius: 0, boxSizing: "border-box", bgcolor: "#fafafa" }}>
          {messageActive && (
            <Alert severity={message.type} sx={{ mb: 6, borderRadius: 2 }}>
              {message.text}
            </Alert>
          )}

          {activeSection === "Leave Analytics" && (
            <>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  mb: 2,
                  color: "#2d3748",
                  fontFamily: "'Roboto', sans-serif",
                }}
              >
                Leave Analytics
              </Typography>
              <Divider sx={{ mb: 4, borderColor: "#e0e0e0" }} />

              <Grid container spacing={3} sx={{ mb: 6 }}>
                <Grid item xs={12} sm={3}>
                  <StyledStatsCard elevation={3} sx={{ bgcolor: "#e0f7fa", borderRadius: 2, p: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 500, color: "#4a5568", mb: 1 }}>
                      Total Leaves
                    </Typography>
                    <Typography variant="h4" sx={{ color: "#2d3748", fontWeight: 700, mb: 1 }}>
                      {statusCounts.Total.total}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#718096" }}>
                      Annual: {statusCounts.Total.Annual} | Short: {statusCounts.Total.Short}
                    </Typography>
                  </StyledStatsCard>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <StyledStatsCard elevation={3} sx={{ bgcolor: "#d4edda", borderRadius: 2, p: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 500, color: "#4a5568", mb: 1 }}>
                      Approved
                    </Typography>
                    <Typography variant="h4" sx={{ color: "#2d3748", fontWeight: 700, mb: 1 }}>
                      {statusCounts.Approved.total}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#718096" }}>
                      Annual: {statusCounts.Approved.Annual} | Short: {statusCounts.Approved.Short}
                    </Typography>
                  </StyledStatsCard>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <StyledStatsCard elevation={3} sx={{ bgcolor: "#f8d7da", borderRadius: 2, p: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 500, color: "#4a5568", mb: 1 }}>
                      Rejected
                    </Typography>
                    <Typography variant="h4" sx={{ color: "#2d3748", fontWeight: 700, mb: 1 }}>
                      {statusCounts.Rejected.total}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#718096" }}>
                      Annual: {statusCounts.Rejected.Annual} | Short: {statusCounts.Rejected.Short}
                    </Typography>
                  </StyledStatsCard>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <StyledStatsCard elevation={3} sx={{ bgcolor: "#fff3cd", borderRadius: 2, p: 2 }}>
                    <Typography variant="h6"sx={{ fontWeight: 500, color: "#4a5568", mb: 1 }}>
                      Pending
                    </Typography>
                    <Typography variant="h4" sx={{ color: "#2d3748", fontWeight: 700, mb: 1 }}>
                      {statusCounts.Pending.total}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#718096" }}>
                      Annual: {statusCounts.Pending.Annual} | Short: {statusCounts.Pending.Short}
                    </Typography>
                  </StyledStatsCard>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <StyledStatsCard elevation={3} sx={{ bgcolor: "#e6e6fa", borderRadius: 2, p: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 500, color: "#4a5568", mb: 1 }}>
                      Recommended by Director
                    </Typography>
                    <Typography variant="h4" sx={{ color: "#2d3748", fontWeight: 700, mb: 1 }}>
                      {statusCounts.RecommendedByDirector.total}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#718096" }}>
                      Annual: {statusCounts.RecommendedByDirector.Annual} | Short: {statusCounts.RecommendedByDirector.Short}
                    </Typography>
                  </StyledStatsCard>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <StyledStatsCard elevation={3} sx={{ bgcolor: "#f0e68c", borderRadius: 2, p: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 500, color: "#4a5568", mb: 1 }}>
                      Recommended by Departmental
                    </Typography>
                    <Typography variant="h4" sx={{ color: "#2d3748", fontWeight: 700, mb: 1 }}>
                      {statusCounts.RecommendedByDepartmental.total}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#718096" }}>
                      Annual: {statusCounts.RecommendedByDepartmental.Annual} | Short: {statusCounts.RecommendedByDepartmental.Short}
                    </Typography>
                  </StyledStatsCard>
                </Grid>
              </Grid>

              <Typography
                variant="h6"
                sx={{
                  mb: 3,
                  fontWeight: 600,
                  color: "#2d3748",
                  fontFamily: "'Roboto', sans-serif",
                }}
              >
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
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 2,
                          "& fieldset": { borderColor: "#e0e0e0" },
                          "&:hover fieldset": { borderColor: "#b0bec5" },
                        },
                        "& .MuiInputLabel-root": { color: "#4a5568" },
                      }}
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
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 2,
                          "& fieldset": { borderColor: "#e0e0e0" },
                          "&:hover fieldset": { borderColor: "#b0bec5" },
                        },
                        "& .MuiInputLabel-root": { color: "#4a5568" },
                      }}
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
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 2,
                          "& fieldset": { borderColor: "#e0e0e0" },
                          "&:hover fieldset": { borderColor: "#b0bec5" },
                        },
                        "& .MuiInputLabel-root": { color: "#4a5568" },
                      }}
                    >
                      <option value="">All</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      <option value="RecommendedByDirector">Recommended by Director</option>
                      <option value="RecommendedByDepartmental">Recommended by Departmental</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleSearch}
                      startIcon={<SearchIcon />}
                      fullWidth
                      sx={{
                        borderRadius: 2,
                        bgcolor: "#1976d2",
                        "&:hover": { bgcolor: "#1565c0" },
                        textTransform: "none",
                        fontWeight: 500,
                      }}
                    >
                      Search
                    </Button>
                  </Grid>
                </Grid>
              </Box>

              <TableContainer
                sx={{
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                  borderRadius: 2,
                  border: "1px solid #e0e0e0",
                  bgcolor: "#fff",
                }}
              >
                <Table stickyHeader sx={{ width: "100%", tableLayout: "auto" }}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          bgcolor: "#f7fafc",
                          color: "#2d3748",
                          borderBottom: "2px solid #e0e0e0",
                          whiteSpace: "nowrap",
                          px: 3,
                          py: 2,
                        }}
                      >
                        ID
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          bgcolor: "#f7fafc",
                          color: "#2d3748",
                          borderBottom: "2px solid #e0e0e0",
                          whiteSpace: "nowrap",
                          px: 3,
                          py: 2,
                        }}
                      >
                        Employee
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          bgcolor: "#f7fafc",
                          color: "#2d3748",
                          borderBottom: "2px solid #e0e0e0",
                          whiteSpace: "nowrap",
                          px: 3,
                          py: 2,
                        }}
                      >
                        Type
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          bgcolor: "#f7fafc",
                          color: "#2d3748",
                          borderBottom: "2px solid #e0e0e0",
                          whiteSpace: "nowrap",
                          px: 3,
                          py: 2,
                        }}
                      >
                        Days
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          bgcolor: "#f7fafc",
                          color: "#2d3748",
                          borderBottom: "2px solid #e0e0e0",
                          whiteSpace: "nowrap",
                          px: 3,
                          py: 2,
                        }}
                      >
                        Start Date
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          bgcolor: "#f7fafc",
                          color: "#2d3748",
                          borderBottom: "2px solid #e0e0e0",
                          whiteSpace: "nowrap",
                          px: 3,
                          py: 2,
                        }}
                      >
                        End Date
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          bgcolor: "#f7fafc",
                          color: "#2d3748",
                          borderBottom: "2px solid #e0e0e0",
                          whiteSpace: "nowrap",
                          px: 3,
                          py: 2,
                        }}
                      >
                        Status
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaves.length > 0 ? (
                      leaves.map((leave) => (
                        <>
                          <TableRow
                            key={leave._id}
                            hover
                            onClick={() => setExpandedLeaveId(expandedLeaveId === leave._id ? null : leave._id)}
                            sx={{
                              "&:hover": { bgcolor: "#edf2f7" },
                              bgcolor: isActiveLeave(leave) ? "#e6fffa" : "inherit",
                              cursor: "pointer",
                              borderBottom: "1px solid #e0e0e0",
                            }}
                          >
                            <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>
                              {leave._id.slice(-6)}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>
                              {leave.employeeName}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>
                              {leave.leaveType}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>
                              {leave.daysApplied}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>
                              {new Date(leave.startDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap", px: 3, py: 2, color: "#4a5568" }}>
                              {new Date(leave.endDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1 }}>
                              <Tooltip title={leave.status}>
                                {getStatusChip(leave)}
                              </Tooltip>
                              {expandedLeaveId === leave._id ? (
                                <ExpandLessIcon sx={{ color: "#718096" }} />
                              ) : (
                                <ExpandMoreIcon sx={{ color: "#718096" }} />
                              )}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={7} sx={{ padding: 0 }}>
                              <Collapse in={expandedLeaveId === leave._id} timeout="auto" unmountOnExit>
                                <Box
                                  sx={{
                                    p: 3,
                                    bgcolor: "linear-gradient(145deg, #f7fafc, #edf2f7)",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: 2,
                                    mx: 2,
                                    mb: 2,
                                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
                                  }}
                                >
                                  <Typography
                                    variant="h6"
                                    gutterBottom
                                    sx={{ fontWeight: 600, color: "#2d3748", mb: 3 }}
                                  >
                                    Leave Details
                                  </Typography>
                                  <Box sx={{ mb: 3 }}>
                                    <Typography
                                      variant="subtitle1"
                                      sx={{ fontWeight: 500, color: "#4a5568", mb: 1 }}
                                    >
                                      Employee Information
                                    </Typography>
                                    <Grid container spacing={3}>
                                      <Grid item xs={12} sm={6}>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>ID:</strong> {leave._id}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Employee:</strong> {leave.employeeName}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Person Number:</strong> {leave.personNumber || "N/A"}
                                        </Typography>
                                      </Grid>
                                      <Grid item xs={12} sm={6}>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Department:</strong> {leave.department || "N/A"}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Directorate:</strong> {leave.directorate || "N/A"}
                                        </Typography>
                                      </Grid>
                                    </Grid>
                                  </Box>
                                  <Box sx={{ mb: 3 }}>
                                    <Typography
                                      variant="subtitle1"
                                      sx={{ fontWeight: 500, color: "#4a5568", mb: 1 }}
                                    >
                                      Leave Details
                                    </Typography>
                                    <Grid container spacing={3}>
                                      <Grid item xs={12} sm={6}>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Days Applied:</strong> {leave.daysApplied}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Start Date:</strong>{" "}
                                          {new Date(leave.startDate).toLocaleDateString()}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>End Date:</strong>{" "}
                                          {new Date(leave.endDate).toLocaleDateString()}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Reason:</strong> {leave.reason || "N/A"}
                                        </Typography>
                                      </Grid>
                                      <Grid item xs={12} sm={6}>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Address While Away:</strong>{" "}
                                          {leave.addressWhileAway || "N/A"}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Email:</strong> {leave.emailAddress || "N/A"}
                                        </Typography>
                                        <Typography sx={{ color: "#718096", mb: 1 }}>
                                          <strong>Phone:</strong> {leave.phoneNumber || "N/A"}
                                        </Typography>
                                      </Grid>
                                    </Grid>
                                  </Box>
                                  {(effectiveUser.role === "HRDirector" || effectiveUser.role === "Admin") && (
                                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
                                      <Button
                                        variant="contained"
                                        color="error"
                                        onClick={() => handleDeleteClick(leave._id)}
                                        sx={{
                                          borderRadius: 2,
                                          textTransform: "none",
                                          fontWeight: 500,
                                          bgcolor: "#e53e3e",
                                          "&:hover": { bgcolor: "#c53030" },
                                          px: 3,
                                        }}
                                      >
                                        Delete
                                      </Button>
                                    </Box>
                                  )}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 4, color: "#718096", fontStyle: "italic" }}>
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
              directorates={directorates}
              departments={departments}
              socket={socket}
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
              directorates={directorates}
              departments={departments}
              socket={socket}
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
                isShortLeave={false}
                userRole={effectiveUser.role}
                showPendingActionsOnly={showPendingActionsOnly}
                setShowPendingActionsOnly={setShowPendingActionsOnly}
                handleAction={handleAction}
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
                directorates={directorates}
                departments={departments}
              />
            </>
          )}
        
          {activeSection === "Leave Roster" && (
           <AdminLeaveRoster /> 
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

          {activeSection === "Audit Logs" && (
           <AuditLogs /> 
          )}

        </Paper>
      </MainContent>

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