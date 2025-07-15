import { useState, useEffect, useContext, useCallback, useRef } from "react";
import apiClient from "../utils/apiClient";
import { io } from "socket.io-client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { AuthContext } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const LeaveRoster = ({ selectedDirectorate, selectedDepartment }) => {
  const { user, setUser, token, isLoading } = useContext(AuthContext);
  const socketRef = useRef(null);
  const [roster, setRoster] = useState(null);
  const [rosterData, setRosterData] = useState([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [directorateRosters, setDirectorateRosters] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeesLeaves, setEmployeesLeaves] = useState([]);
  const [newPeriod, setNewPeriod] = useState({
    startDate: "",
    endDate: "",
    leaveType: "Annual Leave",
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  console.log('AuthContext value:', { user, setUser, token, isLoading });
  console.log('User details:', JSON.stringify(user, null, 2));

  const getUserId = () => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        return decoded.id;
      } catch (err) {
        console.error('Error decoding token:', err);
      }
    }
    return user?.userId || user?.id || user?._id?.toString();
  };

  const isPrivilegedRole = ['Admin', 'Director', 'DepartmentalHead'].includes(user?.role);

  const fetchRoster = useCallback(async () => {
    try {
      const userId = getUserId();
      if (!userId || userId === 'unknown') {
        throw new Error("Invalid user ID");
      }
      const response = await apiClient.get(`/api/leave-roster/employee/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.message === "No leave roster found for this employee") {
        setRoster(null);
        setShowCreateForm(true);
      } else {
        setRoster(response.data);
        setShowCreateForm(false);
      }
    } catch (err) {
      console.error("Error fetching roster:", err);
      setError(err.response?.data?.error || "Failed to fetch roster");
      setShowCreateForm(true);
    }
  }, [user, token]);

  const fetchRosterData = useCallback(async () => {
    setIsLoadingRoster(true);
    try {
      const directorate = user?.directorate;
      if (!directorate || directorate === 'Unknown') {
        throw new Error("Valid directorate is required");
      }
      const response = await apiClient.get(`/api/leave-roster/directorate/${directorate}`, {
        params: { department: selectedDepartment || undefined },
        headers: { Authorization: `Bearer ${token}` },
      });
      setRosterData(response.data);
    } catch (error) {
      console.error("Error fetching roster data:", error);
      setError(error.response?.data?.error || "Failed to fetch roster data");
    } finally {
      setIsLoadingRoster(false);
    }
  }, [user, token, selectedDepartment]);

  const fetchUserProfile = useCallback(async () => {
    const userId = getUserId();
    if (!userId || userId === 'unknown') {
      setError("Cannot fetch profile: User ID is missing or invalid");
      console.error("fetchUserProfile skipped: missing or invalid user.id", { user });
      return;
    }
    try {
      const response = await apiClient.get(`/api/profiles/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setError(error.response?.data?.error || "Failed to fetch user profile");
    }
  }, [user, token, setUser]);

  const fetchDirectorateRosters = useCallback(async () => {
    try {
      const directorate = user?.directorate;
      if (!isPrivilegedRole && (!directorate || directorate === 'Unknown')) {
        throw new Error("Valid directorate is required");
      }
      const response = await apiClient.get(
        isPrivilegedRole ? '/api/leave-roster/all' : `/api/leave-roster/directorate/${directorate}`,
        {
          params: { department: selectedDepartment || undefined },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setDirectorateRosters(response.data);
    } catch (error) {
      console.error("Error fetching directorate rosters:", error);
      setError(error.response?.data?.error || "Failed to fetch directorate rosters");
    }
  }, [user, token, selectedDepartment, isPrivilegedRole]);


  const fetchEmployees = useCallback(async () => {
    try {
      const directorate = user?.directorate;
      if (!directorate || directorate === 'Unknown') {
        throw new Error("Valid directorate is required");
      }
      const query = { directorate };
      if (selectedDepartment && selectedDepartment !== 'undefined') {
        query.department = selectedDepartment;
      }
      const response = await apiClient.get('/api/users', {
        params: query,
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmployees(response.data.filter(emp => emp.directorate === user.directorate));
    } catch (error) {
      console.error("Error fetching employees:", error);
      setError(error.response?.data?.error || "Failed to fetch employees");
    }
  }, [user, token, selectedDepartment]);

  const fetchEmployeesLeaves = useCallback(async () => {
    try {
      const directorate = user?.directorate;
      if (!directorate && !["Admin"].includes(user?.role)) {
        throw new Error("Valid directorate or Admin role required");
      }
      const monthString = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
      const query = { month: monthString, directorate };
      if (selectedDepartment && selectedDepartment !== 'undefined') {
        query.department = selectedDepartment;
      }
      const response = await apiClient.get('/api/leaves/approved', {
        params: query,
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmployeesLeaves(response.data.filter(leave => leave.employeeId.directorate === user.directorate));
    } catch (error) {
      console.error("Error fetching employees leaves:", error);
      setError(error.response?.data?.error || "Failed to fetch employees leaves");
    }
  }, [user, token, selectedMonth, selectedYear, selectedDepartment]);

  const handleSuggestPeriod = async (e) => {
    e.preventDefault();
    try {
      const userId = getUserId();
      const response = await apiClient.post(`/api/leave-roster/suggest/${userId}`, newPeriod, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const newRoster = response.data.roster;
      const newPeriodData = newRoster.periods[newRoster.periods.length - 1];
      const newLeave = {
        _id: newRoster._id,
        employeeId: newRoster.employeeId._id,
        employeeName: newRoster.employeeId.name,
        startDate: newPeriodData.startDate,
        endDate: newPeriodData.endDate,
        leaveType: newPeriodData.leaveType,
        status: newPeriodData.status,
        directorate: user.directorate,
      };
      socketRef.current.emit("leaveSuggested", newLeave);
      fetchRoster();
      fetchDirectorateRosters();
      setNewPeriod({ startDate: "", endDate: "", leaveType: "Annual Leave" });
    } catch (err) {
      console.error("Error suggesting period:", err);
      setError(err.response?.data?.error || "Failed to suggest period");
    }
  };

  const handleUpdatePeriod = async (periodId, status) => {
    try {
      await apiClient.patch(`/api/leave-roster/update-period/${roster._id}/${periodId}`, { status }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchRoster();
      fetchDirectorateRosters();
    } catch (err) {
      console.error("Error updating period:", err);
      setError(err.response?.data?.error || "Failed to update period");
    }
  };

  const handleApplyLeave = async (periodId) => {
    try {
      await apiClient.post(`/api/leave-roster/apply-from-roster/${roster._id}/${periodId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchRoster();
      fetchDirectorateRosters();
      fetchEmployeesLeaves();
    } catch (err) {
      console.error("Error applying leave:", err);
      setError(err.response?.data?.error || "Failed to apply leave");
    }
  };

  useEffect(() => {
    if (isLoading) return;
    const userId = getUserId();
    if (!user || !token || !userId || userId === 'unknown') {
      setError("Please log in to access the leave roster");
      console.error("Socket.io initialization skipped: missing user, token, or valid user ID", { user, token, userId });
      return;
    }

    socketRef.current = io('http://localhost:5000', {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      console.log('Socket.io connected:', socketRef.current.id);
      if (user.directorate && user.directorate !== 'Unknown') {
        socketRef.current.emit('join', `directorate:${user.directorate}`);
        console.log(`Joined room: directorate:${user.directorate}`);
      } else if (user.role === 'Admin') {
        socketRef.current.emit('join', 'admin-room');
        console.log('Joined room: admin-room');
      }
    });

    socketRef.current.on('rosterUpdate', (data) => {
      console.log('Received rosterUpdate:', data);
      if (data.directorate === user?.directorate) {
        fetchDirectorateRosters();
        if (data.employeeId === userId) fetchRoster();
      }
    });

    socketRef.current.on('leaveStatusUpdate', (data) => {
      console.log('Received leaveStatusUpdate:', data);
      if (data.employeeId.directorate === user?.directorate) {
        fetchEmployeesLeaves();
      }
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Socket.io connection error:', err.message);
      setError(`Socket.io connection failed: ${err.message}`);
    });

    socketRef.current.on('error', (err) => {
      console.error('Socket.io error:', err.message);
      setError(`Socket.io error: ${err.message}`);
    });

    if (user.directorate && user.directorate !== 'Unknown') {
      fetchRoster();
      fetchRosterData();
      fetchDirectorateRosters();
      fetchEmployees();
      fetchEmployeesLeaves();
    } else if (user.role === 'Admin') {
      fetchRoster();
      fetchRosterData();
      fetchDirectorateRosters();
      fetchEmployees();
      fetchEmployeesLeaves();
    } else {
      fetchUserProfile();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        console.log('Socket.io disconnected');
      }
    };
  }, [
    user,
    token,
    isLoading,
    selectedDepartment,
    fetchRoster,
    fetchRosterData,
    fetchDirectorateRosters,
    fetchEmployees,
    fetchEmployeesLeaves,
    fetchUserProfile,
    setUser,
  ]);

  useEffect(() => {
    if (!user?.directorate) return;
    fetchEmployeesLeaves();
    fetchDirectorateRosters();
  }, [selectedMonth, selectedYear, user, selectedDepartment, fetchEmployeesLeaves, fetchDirectorateRosters]);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
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

  const getEmployeeLeaveDays = (employeeLeaves, suggestedLeaves, days, employeeId) => {
    const leaveDays = {};
    days.forEach((day, index) => {
      leaveDays[index + 1] = { code: "", color: isWeekend(day) ? "#d3d3d3" : "transparent", status: "" };
    });

    const filteredEmployeeLeaves = employeeLeaves.filter(leave => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      return start.getMonth() + 1 === selectedMonth && start.getFullYear() === selectedYear &&
             end.getMonth() + 1 === selectedMonth && end.getFullYear() === selectedYear;
    });

    filteredEmployeeLeaves.forEach((leave) => {
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

    if (suggestedLeaves && suggestedLeaves.length > 0) {
      const filteredSuggestedLeaves = suggestedLeaves.filter(period => {
        const start = new Date(period.startDate);
        const end = new Date(period.endDate);
        return period.status === "Suggested" &&
               start.getMonth() + 1 === selectedMonth && start.getFullYear() === selectedYear &&
               end.getMonth() + 1 === selectedMonth && end.getFullYear() === selectedYear;
      });

      filteredSuggestedLeaves.forEach((period) => {
        const start = new Date(period.startDate);
        const end = new Date(period.endDate);
        const leaveDaysInterval = eachDayOfInterval({ start, end });
        leaveDaysInterval.forEach((leaveDay) => {
          const dayOfMonth = leaveDay.getDate();
          if (leaveDay.getMonth() + 1 === selectedMonth && leaveDay.getFullYear() === selectedYear && !isWeekend(leaveDay)) {
            leaveDays[dayOfMonth] = {
              code: getLeaveCode(period.leaveType),
              color: getLeaveColor(period.leaveType),
              status: "Suggested",
            };
          }
        });
      });
    }

    return leaveDays;
  };

  const groupedLeaves = employeesLeaves.reduce((acc, leave) => {
    if (!acc[leave.employeeName]) acc[leave.employeeName] = [];
    acc[leave.employeeName].push(leave);
    return acc;
  }, {});

  if (isLoading) {
    return <div className="p-6">Loading authentication...</div>;
  }

  if (!user || !token || !getUserId() || getUserId() === 'unknown') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">
        Leave Roster for {user.role === "Admin" ? "All Employees" : `${user.directorate} Directorate`}
      </h2>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      {isLoadingRoster && <div className="p-6">Loading roster data...</div>}

      {showCreateForm && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-2">No Leave Roster Found - Suggest a Period</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-700">Start Date</label>
              <input
                type="date"
                value={newPeriod.startDate}
                onChange={(e) => setNewPeriod({ ...newPeriod, startDate: e.target.value })}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700">End Date</label>
              <input
                type="date"
                value={newPeriod.endDate}
                onChange={(e) => setNewPeriod({ ...newPeriod, endDate: e.target.value })}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700">Leave Type</label>
              <select
                value={newPeriod.leaveType}
                onChange={(e) => setNewPeriod({ ...newPeriod, leaveType: e.target.value })}
                className="w-full p-2 border rounded"
              >
                <option value="Annual Leave">Annual Leave</option>
                <option value="Short Leave">Short Leave</option>
                <option value="Emergency Leave">Emergency Leave</option>
                <option value="Maternity Leave">Maternity Leave</option>
                <option value="Terminal Leave">Terminal Leave</option>
                <option value="Compassionate Leave">Compassionate Leave</option>
                <option value="Sports Leave">Sports Leave</option>
                <option value="Unpaid Leave">Unpaid Leave</option>
              </select>
            </div>
            <div className="col-span-3">
              <button onClick={handleSuggestPeriod} className="bg-blue-500 text-white px-4 py-2 rounded">
                Suggest Period
              </button>
            </div>
          </div>
        </div>
      )}

      {roster && (
        <>
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-2">
              Leave Roster Calendar - {months[selectedMonth - 1]} {selectedYear}
            </h3>
            <div className="flex gap-4 mb-4">
              <div>
                <label className="block text-gray-700">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-40 p-2 border rounded"
                >
                  {months.map((month, index) => (
                    <option key={index} value={index + 1}>{month}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-40 p-2 border rounded"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border p-2 sticky left-0 bg-gray-200 z-10 min-w-[150px]">Employee</th>
                    {getDaysArray().map((day, index) => (
                      <th key={index} className="border p-2 min-w-[40px] text-center">
                        {day.getDate()}
                        <div className="text-xs">{format(day, "EEE")}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.length > 0 ? (
                    employees.map((employee) => {
                      const employeeLeaves = groupedLeaves[employee.name] || [];
                      const employeeRoster = directorateRosters.find(r => r.employeeId._id.toString() === employee._id.toString());
                      const suggestedLeaves = employeeRoster ? employeeRoster.periods : [];
                      const leaveDays = getEmployeeLeaveDays(employeeLeaves, suggestedLeaves, getDaysArray(), employee._id);

                      return (
                        <tr key={employee._id} className="border">
                          <td className="border p-2 sticky left-0 bg-white min-w-[150px]">
                            {employee.name} ({employee.department})
                          </td>
                          {getDaysArray().map((day, index) => {
                            const dayInfo = leaveDays[index + 1];
                            return (
                              <td
                                key={index}
                                className="border p-2 text-center min-w-[40px]"
                                style={{
                                  backgroundColor: dayInfo.color,
                                  color: dayInfo.color === "transparent" ? "#000" : "#fff",
                                  opacity: dayInfo.status === "Suggested" ? 0.6 : 1,
                                  border: dayInfo.status === "Suggested" ? "1px dashed #000" : "none",
                                }}
                              >
                                {dayInfo.code || "-"}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={getDaysArray().length + 1} className="border p-2 text-center">
                        No employees found in {user.directorate} directorate
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <h4 className="text-lg font-semibold mb-2">Key</h4>
              <div className="flex gap-4 flex-wrap">
                <div className="flex items-center">
                  <div className="w-5 h-5 mr-2" style={{ backgroundColor: "#28a745" }}></div>
                  <span>Vacation Leave (L)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 mr-2" style={{ backgroundColor: "#ffc107" }}></div>
                  <span>Compassionate Leave (C)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 mr-2" style={{ backgroundColor: "#007bff" }}></div>
                  <span>Maternity or Paternity (P)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 mr-2" style={{ backgroundColor: "#ff6347" }}></div>
                  <span>Terminal Leave (T)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 mr-2" style={{ backgroundColor: "#20b2aa" }}></div>
                  <span>Sports Leave (S)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 mr-2" style={{ backgroundColor: "#a9a9a9" }}></div>
                  <span>Unpaid Leave (U)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 mr-2" style={{ backgroundColor: "#d3d3d3" }}></div>
                  <span>Weekend</span>
                </div>
                <div className="flex items-center">
                  <div className="w-5 h-5 mr-2 border border-dashed border-black opacity-60" style={{ backgroundColor: "transparent" }}></div>
                  <span>Suggested Leave (Pending)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-2">Suggest Leave Period</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-700">Start Date</label>
                <input
                  type="date"
                  value={newPeriod.startDate}
                  onChange={(e) => setNewPeriod({ ...newPeriod, startDate: e.target.value })}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700">End Date</label>
                <input
                  type="date"
                  value={newPeriod.endDate}
                  onChange={(e) => setNewPeriod({ ...newPeriod, endDate: e.target.value })}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700">Leave Type</label>
                <select
                  value={newPeriod.leaveType}
                  onChange={(e) => setNewPeriod({ ...newPeriod, leaveType: e.target.value })}
                  className="w-full p-2 border rounded"
                >
                  <option value="Annual Leave">Annual Leave</option>
                  <option value="Short Leave">Short Leave</option>
                  <option value="Emergency Leave">Emergency Leave</option>
                  <option value="Maternity Leave">Maternity Leave</option>
                  <option value="Terminal Leave">Terminal Leave</option>
                  <option value="Compassionate Leave">Compassionate Leave</option>
                  <option value="Sports Leave">Sports Leave</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                </select>
              </div>
              <div className="col-span-3">
                <button onClick={handleSuggestPeriod} className="bg-blue-500 text-white px-4 py-2 rounded">
                  Suggest Period
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-2">Leave Periods</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border p-2">Start Date</th>
                    <th className="border p-2">End Date</th>
                    <th className="border p-2">Leave Type</th>
                    <th className="border p-2">Status</th>
                    <th className="border p-2">Suggested By</th>
                    <th className="border p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roster?.periods?.map((period) => (
                    <tr key={period._id} className="border">
                      <td className="border p-2">{new Date(period.startDate).toLocaleDateString()}</td>
                      <td className="border p-2">{new Date(period.endDate).toLocaleDateString()}</td>
                      <td className="border p-2">{period.leaveType}</td>
                      <td className="border p-2">{period.status}</td>
                      <td className="border p-2">{period.suggestedBy}</td>
                      <td className="border p-2">
                        {period.status === "Suggested" && ["Director", "HRDirector", "Admin"].includes(user.role) && (
                          <>
                            <button
                              onClick={() => handleUpdatePeriod(period._id, "Confirmed")}
                              className="bg-green-500 text-white px-2 py-1 rounded mr-2"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => handleUpdatePeriod(period._id, "Rejected")}
                              className="bg-red-500 text-white px-2 py-1 rounded"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {period.status === "Confirmed" && user.userId === roster.employeeId._id.toString() && (
                          <button
                            onClick={() => handleApplyLeave(period._id)}
                            className="bg-blue-500 text-white px-2 py-1 rounded"
                          >
                            Apply Leave
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LeaveRoster;