import React, { useState, useEffect } from 'react';

const Modal = ({ type, data, onClose, onSubmit, onWithdraw, onAccept, onDecline, onApprove, onReject, onCounterSuggest, onSuggest, setModal}) => {
  const [startDate, setStartDate] = useState(data.proposed_start_date?.slice(0, 10) || '');
  const [endDate, setEndDate] = useState(data.proposed_end_date?.slice(0, 10) || '');
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedDirectorate, setSelectedDirectorate] = useState('');
  const [directorates, setDirectorates] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [directorateDepartments, setDirectorateDepartments] = useState({});

  // Fetch employees and filter options for suggest modal
  useEffect(() => {
    if (type === 'suggest') {
      const fetchFilters = async () => {
        const res = await fetch('/api/leave-roster/filters', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const { directorates, departments, directorateDepartments } = await res.json();
        setDirectorates(directorates);
        setDepartments(departments);
        setDirectorateDepartments(
          directorateDepartments.reduce((acc, { _id, departments }) => ({ ...acc, [_id]: departments }), {})
        );
      };
      const fetchEmployees = async () => {
        const query = new URLSearchParams();
        if (selectedDirectorate) query.append('directorate', selectedDirectorate);
        if (selectedDepartment) query.append('department', selectedDepartment);
        const res = await fetch(`/api/users?${query.toString()}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const data = await res.json();
        setEmployees(data);
      };
      fetchFilters();
      fetchEmployees();
    }
  }, [type, selectedDirectorate, selectedDepartment]);

  const handleSubmit = () => {
    if (type === 'new' || type === 'edit') {
      onSubmit(data._id, startDate, endDate);
    } else if (type === 'counter-suggest') {
      onCounterSuggest(data._id, startDate, endDate);
    } else if (type === 'suggest') {
      onSuggest(employeeId, employeeName, startDate, endDate);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
        <h3 className="text-lg font-bold mb-4">
          {type === 'new' ? 'New Leave Request' :
           type === 'edit' ? 'Edit Leave Request' :
           type === 'counter-suggested' ? 'Counter-Suggested Leave' :
           type === 'admin-suggested' ? 'Admin Suggested Leave' :
           type === 'manage' ? 'Manage Leave Request' :
           type === 'suggest' ? 'Suggest Leave for Employee' : ''}
        </h3>
        {type === 'manage' ? (
          <div>
            <p>Employee: {data.employee_name} ({data.employee_id.department}, {data.employee_id.directorate})</p>
            <p>Start: {new Date(data.proposed_start_date).toLocaleDateString()}</p>
            <p>End: {new Date(data.proposed_end_date).toLocaleDateString()}</p>
            <div className="mt-4">
              <button className="bg-green-500 text-white px-4 py-2 rounded mr-2" onClick={() => onApprove(data._id)}>
                Approve
              </button>
              <button className="bg-red-500 text-white px-4 py-2 rounded mr-2" onClick={() => onReject(data._id)}>
                Reject
              </button>
              <button
              className="bg-orange-500 text-white px-4 py-2 rounded"
              onClick={() => setModal({ open: true, type: 'counter-suggest', data })}
               >
              Counter-Suggest
              </button>
            </div>
          </div>
        ) : type === 'counter-suggested' ? (
          <div>
            <p>Original: {new Date(data.proposed_start_date).toLocaleDateString()} to {new Date(data.proposed_end_date).toLocaleDateString()}</p>
            <p>Admin Suggested: {new Date(data.admin_suggested_start_date).toLocaleDateString()} to {new Date(data.admin_suggested_end_date).toLocaleDateString()}</p>
            <button className="bg-green-500 text-white px-4 py-2 rounded mr-2" onClick={() => onAccept(data._id)}>
              Accept
            </button>
            <button className="bg-red-500 text-white px-4 py-2 rounded" onClick={() => onWithdraw(data._id)}>
              Withdraw
            </button>
          </div>
        ) : type === 'admin-suggested' ? (
          <div>
            <p>Admin Suggested: {new Date(data.proposed_start_date).toLocaleDateString()} to {new Date(data.proposed_end_date).toLocaleDateString()}</p>
            <button className="bg-green-500 text-white px-4 py-2 rounded mr-2" onClick={() => onAccept(data._id)}>
              Accept
            </button>
            <button className="bg-red-500 text-white px-4 py-2 rounded" onClick={() => onDecline(data._id)}>
              Decline
            </button>
          </div>
        ) : (
          <div>
            {type === 'suggest' && (
              <>
                <select
                  value={selectedDirectorate}
                  onChange={(e) => {
                    setSelectedDirectorate(e.target.value);
                    setSelectedDepartment('');
                    setEmployeeId('');
                  }}
                  className="border p-2 w-full mb-2"
                >
                  <option value="">Select Directorate</option>
                  {directorates.map((dir) => (
                    <option key={dir} value={dir}>{dir}</option>
                  ))}
                </select>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="border p-2 w-full mb-2"
                  disabled={!selectedDirectorate}
                >
                  <option value="">Select Department</option>
                  {selectedDirectorate &&
                    directorateDepartments[selectedDirectorate]?.map((dep) => (
                      <option key={dep} value={dep}>{dep}</option>
                    ))}
                </select>
                <select
                  value={employeeId}
                  onChange={(e) => {
                    const emp = employees.find((emp) => emp._id === e.target.value);
                    setEmployeeId(e.target.value);
                    setEmployeeName(emp?.name || '');
                  }}
                  className="border p-2 w-full mb-2"
                  disabled={!selectedDepartment}
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>{emp.name}</option>
                  ))}
                </select>
              </>
            )}
            <label className="block mb-2">
              Start Date:
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border p-2 w-full"
              />
            </label>
            <label className="block mb-2">
              End Date:
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border p-2 w-full"
              />
            </label>
            <button className="bg-blue-500 text-white px-4 py-2 rounded mr-2" onClick={handleSubmit}>
              Submit
            </button>
            {type === 'edit' && (
              <button className="bg-red-500 text-white px-4 py-2 rounded" onClick={() => onWithdraw(data._id)}>
                Withdraw
              </button>
            )}
          </div>
        )}
        <button className="bg-gray-500 text-white px-4 py-2 rounded mt-4" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default Modal;