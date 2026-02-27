
/***********************
 * CONFIG
 ***********************/
const API_BASE = "https://startup-management-system-backend.onrender.com";
const token = localStorage.getItem("token");


if (!token) {
  alert("Session expired. Please login again.");
  window.location.href = "login.html";
}

/***********************
 * COMMON FETCH
 ***********************/
async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  return res.json();
}

/***********************
 * DASHBOARD SUMMARY
 ***********************/
async function loadDashboardSummary() {
  try {
    const data = await apiRequest(
      `${API_BASE}/api/admin/attendance/today`
    );

    document.getElementById("totalUsers").innerText =
      data.total_users ?? 0;

    document.getElementById("presentCount").innerText =
      data.present ?? 0;

    document.getElementById("absentCount").innerText =
      data.absent ?? 0;
    document.getElementById("checkedInCount").innerText =
      data.checked_in ?? 0;


  } catch (err) {
    console.error("Dashboard summary failed", err);
  }
}


/***********************
 * PROJECTS (DROPDOWN)
 ***********************/
async function loadAdminProjects() {
  try {
    const projects = await apiRequest(`${API_BASE}/api/admin/projects`);
    const select = document.getElementById("projectSelect");

    select.innerHTML =
      `<option value="">Select project context...</option>`;

    projects.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.project_name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load projects:", err.message);
  }
}
document.getElementById("projectSelect").addEventListener("change", e => {
  const projectId = e.target.value;

  if (!projectId) {
    document.getElementById("adminRoadmapSteps").innerHTML = "";
    document.getElementById("adminProgressBar").style.width = "0%";
    return;
  }

  // ✅ Load assigned members
  loadAdminProjectMembers(projectId);

  // ✅ Load roadmap progress
  loadRoadmapProgress(projectId);
});


async function loadTeamLeads() {
  try {
    const leads = await apiRequest(`${API_BASE}/api/admin/team-leads`);
    const select = document.getElementById("teamLeadSelect");

    select.innerHTML = `<option value="">Assign Lead...</option>`;

    leads.forEach(lead => {
      const opt = document.createElement("option");
      opt.value = lead.id;
      opt.textContent = `${lead.name} (${lead.user_id})`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load team leads:", err.message);
  }
}



loadTeamLeads();


/***********************
 * DELETE PROJECT
 ***********************/
async function deleteProject() {
  const projectId = document.getElementById("projectSelect").value;
  if (!projectId) return alert("Select a project first");

  if (!confirm("Delete this project?")) return;

  try {
    await apiRequest(
      `${API_BASE}/api/admin/projects/${projectId}`,
      { method: "DELETE" }
    );

    alert("Project deleted");
    loadAdminProjects();
  } catch (err) {
    alert(err.message);
  }
}

/***********************
 * CREATE TEAM LEAD
 ***********************/
async function createTeamLead() {
  const name = document.getElementById("tlName").value;
  const email = document.getElementById("tlEmail").value;
  const password = document.getElementById("tlPassword").value;

  try {
    const res = await apiRequest(
      `${API_BASE}/api/admin/create-team-lead`,
      {
        method: "POST",
        body: JSON.stringify({ name, email, password })
      }
    );

    alert(`Team Lead created: ${res.user_id}`);
  } catch (err) {
    alert(err.message);
  }
}

/***********************
 * CREATE TEAM MEMBER
 ***********************/
async function createTeamMember() {
  const name = document.getElementById("tmName").value;
  const email = document.getElementById("tmEmail").value;
  const password = document.getElementById("tmPassword").value;

  try {
    const res = await apiRequest(
      `${API_BASE}/api/admin/create-team-member`,
      {
        method: "POST",
        body: JSON.stringify({ name, email, password })
      }
    );

    alert(`Team Member created: ${res.user_id}`);
  } catch (err) {
    alert(err.message);
  }
}

/***********************
 * CREATE PROJECT
 ***********************/
async function createProject() {
  const project_name =
    document.getElementById("projectName").value;
  const description =
    document.getElementById("projectDesc").value;
  const team_lead_id =
    document.getElementById("teamLeadSelect").value;

  if (!team_lead_id)
    return alert("Please assign a Team Lead");

  try {
    // 🔹 Create project
    await apiRequest(`${API_BASE}/api/admin/projects`, {
      method: "POST",
      body: JSON.stringify({
        project_name,
        description,
        team_lead_id
      })
    });

    alert("Project created");

    // 🔹 Reload projects
    await loadAdminProjects();

    // 🔹 AUTO-SELECT THE LAST PROJECT
    const select = document.getElementById("projectSelect");
    const lastOption = select.options[select.options.length - 1];

    if (lastOption) {
      select.value = lastOption.value;
      select.dispatchEvent(new Event("change"));
    }

  } catch (err) {
    alert(err.message);
  }
}

async function loadAdminProjectMembers(projectId) {
  try {
    const data = await apiRequest(
      `${API_BASE}/api/admin/admin-project-members/${projectId}`
    );


    const list = document.getElementById("adminProjectMembers");

    list.innerHTML = "";

    // Team Lead
    const leadLi = document.createElement("li");
    leadLi.className = "list-group-item fw-bold";
    leadLi.innerText =
      `Team Lead: ${data.project.team_lead_name} (${data.project.team_lead_code})`;
    list.appendChild(leadLi);

    // Members
    if (data.members.length === 0) {
      const li = document.createElement("li");
      li.className = "list-group-item text-muted";
      li.innerText = "No members assigned";
      list.appendChild(li);
      return;
    }

    data.members.forEach(m => {
      const li = document.createElement("li");
      li.className = "list-group-item";
      li.innerText = `${m.name} (${m.user_id})`;
      list.appendChild(li);
    });

  } catch (err) {
    console.error("Failed to load admin project members", err);
  }
}
async function loadTodayAttendance() {
  const data = await apiRequest(
    `${API_BASE}/api/admin/attendance/today/list`
  );

  const tbody = document.getElementById("attendanceTableBody");
  tbody.innerHTML = "";

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center">
          No attendance data for today
        </td>
      </tr>`;
    return;
  }

  data.forEach(row => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${row.user_id}</td>
      <td>${row.name}</td>
      <td>${row.role}</td>
      <td>${row.check_in ?? "-"}</td>
      <td>${row.check_out ?? "-"}</td>
      <td><strong>${row.status}</strong></td>
      
    `;

    tbody.appendChild(tr);
  });
}

/***********************
 * EXPOSE TO HTML
 ***********************/
window.createTeamLead = createTeamLead;
window.createTeamMember = createTeamMember;
window.createProject = createProject;
window.deleteProject = deleteProject;

/***********************
 * INIT
 ***********************/
document.addEventListener("DOMContentLoaded", () => {
  loadDashboardSummary();
  loadAdminProjects();
});

async function loadRoadmapProgress(projectId) {
  try {
    const data = await apiRequest(
      `${API_BASE}/api/admin/roadmap-progress/${projectId}`
    );

    // 🔹 Progress bar
    const progressBar = document.getElementById("adminProgressBar");
    progressBar.style.width = data.progress;
    progressBar.innerText = data.progress;

    // 🔹 Roadmap steps list
    const stepsList = document.getElementById("adminRoadmapSteps");
    stepsList.innerHTML = "";

    if (!data.steps || data.steps.length === 0) {
      stepsList.innerHTML =
        `<li class="list-group-item text-muted">
          No roadmap steps created
        </li>`;
      return;
    }

    data.steps.forEach(step => {
      const li = document.createElement("li");
      li.className =
        "list-group-item d-flex justify-content-between align-items-center";

      li.innerHTML = `
        <span>${step.step_title}</span>
        <span class="badge ${step.is_completed ? "bg-success" : "bg-secondary"
        }">
          ${step.is_completed ? "Completed" : "Pending"}
        </span>
      `;

      stepsList.appendChild(li);
    });

  } catch (err) {
    console.error("Failed to load roadmap progress", err);
  }
}

async function allowLateCheckIn(userId) {
  if (!userId) {
    alert("User ID missing");
    return;
  }

  if (!confirm("Allow late check-in?")) return;

  const res = await fetch(
    `${API_BASE}/api/admin/attendance/allow-late/${userId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const data = await res.json();

  if (!res.ok) {
    alert(data.message || "Failed");
    return;
  }

  alert(data.message);
  loadTodayAttendance(); // refresh table
}

document.addEventListener("DOMContentLoaded", () => {
  loadDashboardSummary();
  loadAdminProjects();
  loadTeamLeads();
  loadTodayAttendance();
  loadAdminWorkReports();
  loadShifts();
  loadLateUsers();
  loadWorkReportDashboard();
  loadAdminStatus();
  loadGeoSetting();




  const projectSelect = document.getElementById("projectSelect");

  if (projectSelect) {
    projectSelect.addEventListener("change", () => {
      const projectId = projectSelect.value;

      if (!projectId) {
        document.getElementById("adminRoadmapSteps").innerHTML = "";
        document.getElementById("adminProjectMembers").innerHTML = "";
        document.getElementById("adminProgressBar").style.width = "0%";
        return;
      }

      loadAdminProjectMembers(projectId);
      loadRoadmapProgress(projectId);
    });
  }
});
/***********************
 * ADMIN DAILY WORK REPORT
 ***********************/
async function submitAdminDailyReport() {
  const workDone = document.getElementById("adminWorkDone").value.trim();
  const messageDiv = document.getElementById("adminWorkMessage");

  if (!workDone) {
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Please enter work details</div>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/work/daily`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        work_done: workDone
      })
    });

    const data = await res.json();

    if (!res.ok) {
      messageDiv.innerHTML =
        `<div class="alert alert-danger">${data.message}</div>`;
      return;
    }

    messageDiv.innerHTML =
      `<div class="alert alert-success">${data.message}</div>`;

    document.getElementById("adminWorkDone").value = "";

  } catch (err) {
    console.error(err);
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Failed to submit report</div>`;
  }
}
async function loadAdminWorkReports() {
  try {
    const reports = await apiRequest(
      `${API_BASE}/api/admin/work-reports`
    );

    const tbody = document.getElementById("adminWorkReportsTable");
    tbody.innerHTML = "";

    if (!reports || reports.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted">
            No reports submitted today
          </td>
        </tr>
      `;
      return;
    }

    reports.forEach(r => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${r.name}</td>
        <td>${r.role}</td>
        <td>${r.work_done}</td>
        <td>${new Date(r.report_date).toLocaleDateString()}</td>
      `;

      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Failed to load work reports", err);
  }
}
async function exportWorkReportsCSV() {
  try {
    const from = document.getElementById("reportFromDate").value;
    const to = document.getElementById("reportToDate").value;

    if (!from || !to) {
      alert("Please select both From and To dates");
      return;
    }

    if (from > to) {
      alert("From date cannot be greater than To date");
      return;
    }

    const url =
      `${API_BASE}/api/admin/work-reports/export/csv?from=${from}&to=${to}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error("Export failed");

    const blob = await res.blob();
    const link = document.createElement("a");

    link.href = window.URL.createObjectURL(blob);
    link.download = `work_reports_${from}_to_${to}.csv`;
    link.click();

  } catch (err) {
    console.error(err);
    alert("CSV export failed");
  }
}
async function exportWorkReportsExcel() {
  try {
    const from = document.getElementById("reportFromDate").value;
    const to = document.getElementById("reportToDate").value;

    if (!from || !to) {
      alert("Please select both From and To dates");
      return;
    }

    if (from > to) {
      alert("From date cannot be greater than To date");
      return;
    }

    const url =
      `${API_BASE}/api/admin/work-reports/export/excel?from=${from}&to=${to}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error("Export failed");

    const blob = await res.blob();
    const link = document.createElement("a");

    link.href = window.URL.createObjectURL(blob);
    link.download = `work_reports_${from}_to_${to}.xlsx`;
    link.click();

  } catch (err) {
    console.error(err);
    alert("Excel export failed");
  }
}

async function createShift() {
  const name = document.getElementById("shiftName").value;
  const checkIn = document.getElementById("checkInTime").value;
  const lastCheckIn = document.getElementById("lastCheckInTime").value;

  if (!name || !checkIn || !lastCheckIn) {
    alert("All fields required");
    return;
  }

  const res = await fetch(`${API_BASE}/api/admin/shifts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      name,
      check_in_time: checkIn,
      last_checkin_time: lastCheckIn
    })
  });

  const data = await res.json();
  alert(data.message);

  loadShifts();
}

async function loadShifts() {
  const res = await fetch(`${API_BASE}/api/admin/shifts`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const shifts = await res.json();

  const tbody = document.getElementById("shiftTableBody");
  tbody.innerHTML = "";

  shifts.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.name}</td>
      <td>${s.check_in_time}</td>
      <td>${s.last_checkin_time}</td>
      <td>
        <button class="btn btn-sm btn-danger"
          onclick="deleteShift(${s.id})">
          Delete
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
async function deleteShift(id) {
  if (!confirm("Are you sure you want to delete this shift?")) return;

  const res = await fetch(`${API_BASE}/api/admin/shifts/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message);
    return;
  }

  alert(data.message);
  loadShifts();
}
async function loadLateUsers() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/attendance/late-users`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const users = await res.json();
    const container = document.getElementById("lateUsersContainer");
    container.innerHTML = "";

    if (!Array.isArray(users) || users.length === 0) {
      container.innerHTML = `<div class="text-center text-muted small py-3">No pending exception requests.</div>`;
      return;
    }

    // Load shifts for dropdown
    const shiftRes = await fetch(`${API_BASE}/api/admin/shifts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const shifts = await shiftRes.json();

    users.forEach(user => {
      const div = document.createElement("div");
      div.className = "d-flex align-items-center justify-content-between gap-2 p-2 border rounded mb-2 bg-white";

      // Shifts use correct field: s.name, s.id
      const shiftOptions = shifts.map(s =>
        `<option value="${s.id}">${s.name}</option>`
      ).join("");

      // user.user_id = DB integer primary key
      // user.user_code = e.g. TM001
      div.innerHTML = `
        <div>
          <strong>${user.user_code}</strong>
          <span class="text-muted small ms-1">${user.name}</span>
        </div>
        <div class="d-flex gap-2 align-items-center">
          <select id="shiftSelect_${user.user_id}" class="form-select form-select-sm" style="width:130px;">
            ${shiftOptions}
          </select>
          <button class="btn btn-sm btn-success" onclick="approveLate(${user.user_id})">
            Approve
          </button>
        </div>
      `;

      container.appendChild(div);
    });

  } catch (err) {
    console.error("loadLateUsers error:", err);
  }
}

async function approveLate(dbUserId) {
  const shiftId = document.getElementById(`shiftSelect_${dbUserId}`).value;

  if (!shiftId) {
    alert("Please select a shift");
    return;
  }

  const res = await fetch(`${API_BASE}/api/admin/attendance/approve-late`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      userId: dbUserId,   // DB integer primary key
      shiftId: Number(shiftId)
    })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message || "Approval failed");
    return;
  }

  alert(data.message);
  loadLateUsers();
  loadTodayAttendance(); // refresh live ops table
}
async function loadWorkReportDashboard() {
  const res = await fetch(`${API_BASE}/api/admin/work-reports/today`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  const tbody = document.getElementById("workReportTable");
  tbody.innerHTML = "";

  data.forEach(user => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${user.user_id}</td>
      <td>${user.name}</td>
      <td>${user.role}</td>
      <td>${user.shift_name || "-"}</td>
      <td>${user.attendance_status || "ABSENT"}</td>
      <td>
        ${user.work_report_status === "SUBMITTED"
        ? '<span class="text-success">SUBMITTED</span>'
        : '<span class="text-danger">NOT SUBMITTED</span>'
      }
      </td>
    `;

    tbody.appendChild(tr);
  });
}
const adminStatusText = document.getElementById("adminStatusText");
const adminCheckInBtn = document.getElementById("adminCheckInBtn");
const adminCheckOutBtn = document.getElementById("adminCheckOutBtn");
const adminAttendanceMessage = document.getElementById("adminAttendanceMessage");

/* ================= ADMIN ATTENDANCE ================= */

async function loadAdminStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/attendance/my-status`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    adminStatusText.innerText = `Status: ${data.status}`;

    adminCheckInBtn.disabled = data.status !== "ABSENT";
    adminCheckOutBtn.disabled = data.status !== "CHECKED_IN";

  } catch (err) {
    console.error("Load status error:", err);
  }
}


/* ================= ADMIN CHECK-IN ================= */

adminCheckInBtn.onclick = () => {

  if (!navigator.geolocation) {
    adminAttendanceMessage.innerHTML =
      `<div class="alert alert-danger">Geolocation not supported</div>`;
    return;
  }

  navigator.geolocation.getCurrentPosition(

    async (position) => {
      try {

        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        console.log("Latitude:", latitude);
        console.log("Longitude:", longitude);
        const res = await fetch(`${API_BASE}/api/attendance/check-in`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ latitude, longitude })
        });

        const data = await res.json();

        if (!res.ok) {
          adminAttendanceMessage.innerHTML =
            `<div class="alert alert-danger">${data.message}</div>`;
          return;
        }

        adminAttendanceMessage.innerHTML =
          `<div class="alert alert-success">${data.message}</div>`;

        loadAdminStatus();

      } catch (err) {
        console.error("Check-in error:", err);
        adminAttendanceMessage.innerHTML =
          `<div class="alert alert-danger">Check-in failed</div>`;
      }
    },

    (error) => {
      adminAttendanceMessage.innerHTML =
        `<div class="alert alert-danger">Location permission denied</div>`;
    }

  );
};


/* ================= ADMIN CHECK-OUT ================= */

adminCheckOutBtn.onclick = async () => {
  try {
    // 🔒 Block checkout if daily work report not submitted
    const reportCheck = await fetch(`${API_BASE}/api/work/check-today`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const reportData = await reportCheck.json();

    if (!reportData.submitted) {
      adminAttendanceMessage.innerHTML =
        `<div class="alert alert-warning">⚠️ Please submit your daily work report before checking out.</div>`;
      return;
    }

    const res = await fetch(`${API_BASE}/api/attendance/check-out`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (!res.ok) {
      adminAttendanceMessage.innerHTML =
        `<div class="alert alert-danger">${data.message}</div>`;
      return;
    }

    adminAttendanceMessage.innerHTML =
      `<div class="alert alert-success">${data.message}</div>`;

    loadAdminStatus();

  } catch (err) {
    console.error("Check-out error:", err);
    adminAttendanceMessage.innerHTML =
      `<div class="alert alert-danger">Check-out failed</div>`;
  }
};



// ================= DAILY ATTENDANCE EXPORT =================
async function exportDailyCSV() {
  try {
    const date = document.getElementById("attendanceExportDate").value;

    if (!date) {
      alert("Please select a date");
      return;
    }

    const url =
      `${API_BASE}/api/admin/attendance/daily/export/csv?date=${date}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error("Export failed");

    const blob = await res.blob();
    const link = document.createElement("a");

    link.href = window.URL.createObjectURL(blob);
    link.download = `attendance_${date}.csv`;
    link.click();

  } catch (err) {
    console.error(err);
    alert("Daily CSV export failed");
  }
}
async function exportDailyExcel() {
  try {
    const date = document.getElementById("attendanceExportDate").value;

    if (!date) {
      alert("Please select a date");
      return;
    }

    const url =
      `${API_BASE}/api/admin/attendance/daily/export/excel?date=${date}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error("Export failed");

    const blob = await res.blob();
    const link = document.createElement("a");

    link.href = window.URL.createObjectURL(blob);
    link.download = `attendance_${date}.xlsx`;
    link.click();

  } catch (err) {
    console.error(err);
    alert("Daily Excel export failed");
  }
}
const geoToggle = document.getElementById("geoToggle");

async function loadGeoSetting() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/geo-setting`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();

    console.log("🌍 Loaded geo:", data);

    // IMPORTANT LINE
    document.getElementById("geoToggle").checked = data.geo_enabled;

  } catch (err) {
    console.error("Load geo failed:", err);
  }
}


geoToggle.addEventListener("change", async () => {
  try {
    const isEnabled = geoToggle.checked;

    console.log("🌍 Saving geo:", isEnabled);

    await fetch(`${API_BASE}/api/admin/geo-setting`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ is_enabled: isEnabled })
    });

  } catch (err) {
    console.error("Update geo failed", err);
  }
});

async function loadLeaveRequests() {
  const res = await fetch(`${API_BASE}/api/admin/leave-requests`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  const table = document.getElementById("leaveRequestsTable");
  table.innerHTML = "";

  if (data.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">
          No leave requests found
        </td>
      </tr>
    `;
    return;
  }

  data.forEach(l => {
    table.innerHTML += `
      <tr>
        <td>${l.user_id} - ${l.name}</td>
        <td>${l.role}</td>
        <td>${l.from_date}</td>
        <td>${l.to_date}</td>
        <td>${l.reason}</td>
        <td>
          <span class="badge ${l.status === "PENDING" ? "bg-warning text-dark" :
        l.status === "APPROVED" ? "bg-success" :
          "bg-danger"
      }">
            ${l.status}
          </span>
        </td>
        <td>
          ${l.status === "PENDING"
        ? `
                <button class="btn btn-sm btn-success"
                  onclick="reviewLeave(${l.id}, 'APPROVED')">
                  Approve
                </button>
                <button class="btn btn-sm btn-danger"
                  onclick="reviewLeave(${l.id}, 'REJECTED')">
                  Reject
                </button>
              `
        : "-"
      }
        </td>
      </tr>
    `;
  });
}
async function reviewLeave(id, status) {
  const res = await fetch(`${API_BASE}/api/admin/leave-requests/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message);
    return;
  }

  alert("Leave updated successfully");
  loadLeaveRequests();
}
loadLeaveRequests();

/* ================= OFFICE LOCATION SETTINGS ================= */

async function loadOfficeSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/office-settings`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    if (data.latitude) document.getElementById("officeLat").value = data.latitude;
    if (data.longitude) document.getElementById("officeLon").value = data.longitude;
    if (data.allowed_radius) document.getElementById("officeRadius").value = data.allowed_radius;

  } catch (err) {
    console.error("Load office settings failed:", err);
  }
}

function captureMyLocation() {
  const msgDiv = document.getElementById("officeSettingsMessage");

  if (!navigator.geolocation) {
    msgDiv.innerHTML = `<span class="text-danger">Geolocation not supported</span>`;
    return;
  }

  msgDiv.innerHTML = `<span class="text-muted">📡 Detecting location...</span>`;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      document.getElementById("officeLat").value = position.coords.latitude;
      document.getElementById("officeLon").value = position.coords.longitude;
      msgDiv.innerHTML = `<span class="text-success">✅ Location captured! Click Save to update.</span>`;
    },
    () => {
      msgDiv.innerHTML = `<span class="text-danger">Location permission denied</span>`;
    },
    { enableHighAccuracy: true }
  );
}

async function saveOfficeLocation() {
  const msgDiv = document.getElementById("officeSettingsMessage");
  const latitude = parseFloat(document.getElementById("officeLat").value);
  const longitude = parseFloat(document.getElementById("officeLon").value);
  const allowed_radius = parseInt(document.getElementById("officeRadius").value) || 200;

  if (!latitude || !longitude) {
    msgDiv.innerHTML = `<span class="text-danger">Latitude and longitude are required</span>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/office-settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ latitude, longitude, allowed_radius })
    });

    const data = await res.json();

    if (!res.ok) {
      msgDiv.innerHTML = `<span class="text-danger">${data.message}</span>`;
      return;
    }

    msgDiv.innerHTML = `<span class="text-success">✅ ${data.message}</span>`;

  } catch (err) {
    console.error("Save office settings failed:", err);
    msgDiv.innerHTML = `<span class="text-danger">Failed to save</span>`;
  }
}

// Load saved office settings on page load
loadOfficeSettings();
