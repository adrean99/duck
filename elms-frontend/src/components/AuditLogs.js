import React, { useState, useEffect, useContext } from "react";
import apiClient from "../utils/apiClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Box,
  TextField,
  Button,
  Pagination,
  Grid,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  CircularProgress,
  Alert,
  TableContainer
} from "@mui/material";
import { AuthContext } from "../context/AuthContext";

const AuditLogs = () => {
  const { user } = useContext(AuthContext);
  console.log("Current user from Authcontext:", user);
  const { authState} = useContext(AuthContext);
  const [auditLogs, setAuditLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [filters, setFilters] = useState({
    action: "",
    userId: "",
    userRole: "",
    additionalDataSearch: "",
    startDate: "",
    endDate: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/api/audit-logs", {
        params: { ...filters, page, limit },
      });
      setAuditLogs(response.data.auditLogs);
      setTotal(response.data.total);
    } catch (err) {
      setError("Failed to fetch audit logs. Please try again.");
      console.error("Error fetching audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [page]);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleReset = () => {
    setFilters({
      action: "",
      userId: "",
      userRole: "",
      additionalDataSearch: "",
      startDate: "",
      endDate: ""
    });
    setPage(1);
  };

  if (!authState.user || !["HRDirector", "Admin"].map(r => r.toLowerCase()).includes(authState.user.role?.toLowerCase())) {
    return <Typography variant="h6" color="error">You are not authorized to view this page.</Typography>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Audit Logs</Typography>
      <Box component="form" sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Action"
              name="action"
              value={filters.action}
              onChange={handleFilterChange}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="User ID"
              name="userId"
              value={filters.userId}
              onChange={handleFilterChange}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>User Role</InputLabel>
              <Select
                name="userRole"
                value={filters.userRole}
                onChange={handleFilterChange}
                label="User Role"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="Admin">Admin</MenuItem>
                <MenuItem value="HRDirector">HR Director</MenuItem>
                <MenuItem value="Director">Director</MenuItem>
                <MenuItem value="DepartmentalHead">Departmental Head</MenuItem>
                <MenuItem value="Employee">Employee</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Search Additional Data"
              name="additionalDataSearch"
              value={filters.additionalDataSearch}
              onChange={handleFilterChange}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="End Date"
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="contained" color="primary" onClick={fetchAuditLogs}>
                Apply Filters
              </Button>
              <Button variant="outlined" onClick={handleReset}>
                Reset
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer sx={{ maxHeight: 440 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Action</TableCell>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>User Name</TableCell>
                  <TableCell>User Role</TableCell>
                  <TableCell>Additional Data</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{log.userName}</TableCell>
                    <TableCell>{log.userRole}</TableCell>
                    <TableCell>{JSON.stringify(log.additionalData)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Pagination
            count={Math.ceil(total / limit)}
            page={page}
            onChange={(e, value) => setPage(value)}
            sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}
          />
        </>
      )}
    </Box>
  );
};

export default AuditLogs;