import { useState, useEffect } from "react";
import apiClient from "../utils/apiClient";
import { io } from "socket.io-client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";

const LeaveRoster = () => {
  const [roster, setRoster] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [employeesLeaves, setEmployeesLeaves] = useState([]);
  const [newPeriod, setNewPeriod] = useState({
    startDate: "",
    endDate: "",
    leaveType: "Annual Leave",
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [error, setError] = useState(null);
  const [user, setUser ] = useState(JSON.parse(localStorage.getItem("user")) || {});
  
  
const fetchUserProfile = async () => {
    try {
      const response = await apiClient.get(`/api/profile/${user.id}`);
      const updatedUser = { ...user, sector: response.data.sector };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch user profile");
    }
  };

  const fetchRoster = async () => {
    try {
      const response = await apiClient.get(`/api/leave-roster/${user.id}`);
      console.log('Roster response:', response.data);
      setRoster(response.data);
    } catch (err) {
      console.error('Error fetching roster:', err.response?.data || err.message);
      setError(err.response?.data?.error || "Failed to fetch roster");
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await apiClient.get(`/api/users/sector`);
      setEmployees(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch employees");
    }
  };

 const fetchEmployeesLeaves = async () => {
  try {
    const monthString = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
    const endpoint = user.role === "Admin"
      ? `/api/leaves/approved?month=${monthString}`
      : `/api/leaves/approved?sector=${user.sector}&month=${monthString}`;
    const response = await apiClient.get(endpoint);
    setEmployeesLeaves(response.data);
  } catch (err) {
    setError(err.response?.data?.error || "Failed to fetch leaves for roster");
  }
};

  const handleSuggestPeriod = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post(`/api/leave-roster/suggest/${user.id}`, newPeriod);
      fetchRoster();
      setNewPeriod({ startDate: "", endDate: "", leaveType: "Annual Leave" });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to suggest period");
    }
  };

  const handleUpdatePeriod = async (periodId, status) => {
    try {
      await apiClient.patch(`/api/leave-roster/update-period/${roster._id}/${periodId}`, { status });
      fetchRoster();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update period");
    }
  };

  const handleApplyLeave = async (periodId) => {
    try {
      await apiClient.post(`/api/leave-roster/apply-from-roster/${roster._id}/${periodId}`);
      fetchRoster();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to apply leave");
    }
  };

  useEffect(() => {
    if (!user.sector) {
      fetchUserProfile();
    } else {
      fetchRoster();
      fetchEmployees();
      fetchEmployeesLeaves();
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io("http://localhost:5000", {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => console.log("WebSocket connected"));
    socket.on("rosterUpdate", (data) => {
      if (data.employeeId === user.id) fetchRoster();
    });
    socket.on("leaveStatusUpdate", () => {
      fetchEmployeesLeaves();
    });

    return () => socket.disconnect();
  }, [user.id]);

  useEffect(() => {
    fetchEmployeesLeaves();
  }, [selectedMonth, selectedYear, user.sector]); 


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
      case "Compassionate": return "C";
      case "Maternity Leave": return "P";
      case "Terminal": return "T";
      case "Sports": return "S";
      case "Unpaid": return "U";
      default: return "";
    }
  };

  const getLeaveColor = (leaveType) => {
    switch (leaveType) {
      case "Annual Leave":
      case "Short Leave": return "#28a745"; // Green
      case "Emergency Leave":
      case "Compassionate": return "#ffc107"; // Amber
      case "Maternity Leave": return "#007bff"; // Blue
      case "Terminal": return "#ff6347"; // Tomato Red
      case "Sports": return "#20b2aa"; // Light Sea Green
      case "Unpaid": return "#a9a9a9"; // Dark Gray
      default: return "transparent";
    }
  };

  const getEmployeeLeaveDays = (employeeLeaves, days) => {
    const leaveDays = {};
    days.forEach((day, index) => {
      leaveDays[index + 1] = { code: "", color: "transparent" };
      if (isWeekend(day)) {
        leaveDays[index + 1] = { code: "", color: "#d3d3d3" }; // Gray for weekends
      }
    });

    employeeLeaves.forEach((leave) => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const leaveDaysInterval = eachDayOfInterval({ start, end });
      leaveDaysInterval.forEach((leaveDay) => {
        const dayOfMonth = leaveDay.getDate();
        if (leaveDay.getMonth() + 1 === selectedMonth && leaveDay.getFullYear() === selectedYear) {
          leaveDays[dayOfMonth] = {
            code: getLeaveCode(leave.leaveType),
            color: getLeaveColor(leave.leaveType),
          };
        }
      });
    });

    return leaveDays;
  };

  // Group leaves by employee
  const groupedLeaves = user.role === "Admin"
    ? employeesLeaves.reduce((acc, leave) => {
        if (!acc[leave.employeeName]) {
          acc[leave.employeeName] = [];
        }
        acc[leave.employeeName].push(leave);
        return acc;
      }, {})
    : employeesLeaves.reduce((acc, leave) => {
        if (!acc[leave.employeeName]) {
          acc[leave.employeeName] = [];
        }
        acc[leave.employeeName].push(leave);
        return acc;
      }, {});

  if (!roster) return <div className="p-6">Loading...</div>;

 return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Leave Roster for {user.role === "Admin" ? "All Employees" : `${user.sector || "undefined"} Sector`}</h2>
      {error && <div className="text-red-500 mb-4">{error}</div>}

      {/* Calendar View */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-2">Leave Roster Calendar - {months[selectedMonth - 1]} {selectedYear}</h3>
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
                employees.map((employee) => (
                  <tr key={employee._id} className="border">
                    <td className="border p-2 sticky left-0 bg-white min-w-[150px]">
                      {employee.name} 
                    </td>
                    {getDaysArray().map((_, index) => (
                      <td
                        key={index}
                        className="border p-2 text-center min-w-[40px]"
                        style={{ backgroundColor: "transparent", color: "#000" }}
                      >
                        -
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={getDaysArray().length + 1} className="border p-2 text-center">
                    No employees found in this sector
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Key */}
       <div className="mt-4">
          <h4 className="text-lg font-semibold mb-2">Legend</h4>
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
          </div>
        </div>
      </div>

      {/* Suggest Leave Period */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-2">Suggest Leave Period</h3>
        <form onSubmit={handleSuggestPeriod} className="grid grid-cols-3 gap-4">
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
              <option value="Terminal">Terminal</option>
              <option value="Compassionate">Compassionate</option>
              <option value="Sports">Sports</option>
              <option value="Unpaid">Unpaid</option>
              </select>
          </div>
          <div className="col-span-3">
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
              Suggest Period
            </button>
          </div>
        </form>
      </div>

      {/* Roster Periods */}
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
              {roster.periods.map((period) => (
                <tr key={period._id} className="border">
                  <td className="border p-2">{new Date(period.startDate).toLocaleDateString()}</td>
                  <td className="border p-2">{new Date(period.endDate).toLocaleDateString()}</td>
                  <td className="border p-2">{period.leaveType}</td>
                  <td className="border p-2">{period.status}</td>
                  <td className="border p-2">{period.suggestedBy}</td>
                  <td className="border p-2">
                    {period.status === "Suggested" && ["Supervisor", "SectionalHead", "DepartmentalHead", "HRDirector", "Admin"].includes(user.role) && (
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
                    {period.status === "Confirmed" && user.id === roster.employeeId._id.toString() && (
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
    </div>
  );
};

export default LeaveRoster;