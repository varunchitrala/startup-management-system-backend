const API_BASE = "https://startup-management-system-backend.onrender.com";;
const token = localStorage.getItem("token");
if (!token) {
  alert("Please login again");
  window.location.href = "../login.html";
}

console.log("🔥 Lead Dashboard Loaded");

/* ================= DOM ================= */
const projectsList = document.getElementById("projectsList");
const roadmapSection = document.getElementById("roadmapSection");
const roadmapSteps = document.getElementById("roadmapSteps");
const progressBar = document.getElementById("progressBar");

const statusText = document.getElementById("statusText");
const checkInBtn = document.getElementById("checkInBtn");
const checkOutBtn = document.getElementById("checkOutBtn");
const messageDiv = document.getElementById("message");


/***********************
 * TEAM LEAD LOAD ROADMAP
 ***********************/
async function loadRoadmap(projectId) {
  try {
    const res = await fetch(
      `${API_BASE}/api/admin/roadmap/${projectId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!res.ok) {
      throw new Error("Failed to load roadmap");
    }

    const data = await res.json();

    const roadmapSection = document.getElementById("roadmapSection");
    const roadmapSteps = document.getElementById("roadmapSteps");
    const progressBar = document.getElementById("progressBar");

    roadmapSection.style.display = "block";
    roadmapSteps.innerHTML = "";

    progressBar.style.width = data.progress;
    progressBar.innerText = data.progress;

    if (!data.steps || data.steps.length === 0) {
      roadmapSteps.innerHTML = `
        <li class="list-group-item text-muted">
          No roadmap steps created
        </li>
      `;
      return;
    }

    data.steps.forEach(step => {
      const li = document.createElement("li");
      li.className =
        "list-group-item d-flex justify-content-between align-items-center";

      const left = document.createElement("div");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "form-check-input me-2";
      checkbox.checked = step.is_completed;

      checkbox.onchange = async () => {
        await updateStep(step.id, checkbox.checked, projectId);
      };

      left.appendChild(checkbox);
      left.append(step.step_title);

      const right = document.createElement("small");
      right.className = "text-muted";
      if (step.updated_by) right.innerText = `Updated by ${step.updated_by}`;

      li.appendChild(left);
      li.appendChild(right);
      roadmapSteps.appendChild(li);
    });

  } catch (err) {
    console.error(err);
    alert("Failed to load roadmap");
  }
}

/* ================= UPDATE ROADMAP STEP ================= */
async function updateStep(stepId, isCompleted, projectId) {
  await fetch(`${API_BASE}/api/admin/roadmap-step`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      step_id: stepId,
      is_completed: isCompleted
    })
  });

  loadRoadmap(projectId);
}



/* ================= ATTENDANCE ================= */
async function loadMyStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/attendance/my-status`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    statusText.innerText = `Status: ${data.status}`;

    checkInBtn.disabled = data.status !== "ABSENT";
    checkOutBtn.disabled = data.status !== "CHECKED_IN";

  } catch (err) {
    console.error("Status load error:", err);
  }
}
checkInBtn.onclick = () => {

  if (!navigator.geolocation) {
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Geolocation not supported</div>`;
    return;
  }

  navigator.geolocation.getCurrentPosition(

    async (position) => {
      try {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        console.log("📍 Lead Location:", latitude, longitude);

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
          messageDiv.innerHTML =
            `<div class="alert alert-danger">${data.message}</div>`;
          return;
        }

        messageDiv.innerHTML =
          `<div class="alert alert-success">${data.message}</div>`;

        loadMyStatus();   // ✅ correct function

      } catch (err) {
        console.error("Check-in error:", err);
        messageDiv.innerHTML =
          `<div class="alert alert-danger">Check-in failed</div>`;
      }
    },

    () => {
      messageDiv.innerHTML =
        `<div class="alert alert-danger">Location permission denied</div>`;
    }
  );
};
checkOutBtn.onclick = async () => {
  try {
    // 🔒 Block checkout if daily work report not submitted
    const reportCheck = await fetch(`${API_BASE}/api/work/check-today`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const reportData = await reportCheck.json();

    if (!reportData.submitted) {
      messageDiv.innerHTML =
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
      messageDiv.innerHTML =
        `<div class="alert alert-danger">${data.message}</div>`;
      return;
    }

    messageDiv.innerHTML =
      `<div class="alert alert-success">${data.message}</div>`;

    loadMyStatus();   // ✅ correct

  } catch (err) {
    console.error("Checkout error:", err);
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Checkout failed</div>`;
  }
};

/* ================= LOGOUT ================= */
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  window.location.href = "../index.html";
}

/* ================= INIT ================= */
//loadProjects();
//loadMyStatus();
let selectedProjectId = null;

async function loadProjects() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/my-projects`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });

    if (!res.ok) throw new Error("Failed to load projects");

    const projects = await res.json();

    // LEFT: project list
    const list = document.getElementById("projectsList");
    list.innerHTML = "";

    // RIGHT: dropdown
    const select = document.getElementById("assignProjectSelect");
    select.innerHTML = `<option value="">Select Project</option>`;

    if (!projects.length) {
      list.innerHTML = `<div class="list-group-item">No projects assigned</div>`;
      return;
    }

    projects.forEach(p => {
      // Project list
      const btn = document.createElement("button");
      btn.className = "list-group-item list-group-item-action";
      btn.innerText = p.project_name;
      btn.onclick = () => {
        selectedProjectId = p.id;
        loadRoadmap(p.id);
      };
      list.appendChild(btn);

      // Dropdown option
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.project_name;
      select.appendChild(opt);
    });

  } catch (err) {
    console.error("loadProjects failed:", err);
  }
}



/***********************
 * TEAM LEAD LOAD MEMBERS (PER PROJECT)
 ***********************/
async function loadMembers() {
  try {
    const res = await fetch(
      `${API_BASE}/api/admin/lead/members`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!res.ok) {
      throw new Error("Failed to load members");
    }

    const members = await res.json();

    const container = document.getElementById("membersList");
    container.innerHTML = "";

    if (!members || members.length === 0) {
      container.innerHTML =
        `<div class="text-muted">No members available</div>`;
      return;
    }

    members.forEach(member => {
      const div = document.createElement("div");
      div.className = "form-check mb-1";

      div.innerHTML = `
        <input
          class="form-check-input"
          type="checkbox"
          value="${member.id}"
          id="member_${member.id}"
        />
        <label class="form-check-label" for="member_${member.id}">
          ${member.name} (${member.user_id})
        </label>
      `;

      container.appendChild(div);
    });

  } catch (err) {
    console.error("loadMembers error:", err);
    alert("Unable to load members");
  }
}


async function assignMembers() {
  const projectId = document.getElementById("assignProjectSelect").value;

  if (!projectId) {
    alert("Select a project");
    return;
  }

  const checked = document.querySelectorAll(
    "#membersList input:checked"
  );

  const member_ids = Array.from(checked).map(cb => Number(cb.value));

  if (member_ids.length === 0) {
    alert("Select at least one member");
    return;
  }

  const res = await fetch(`${API_BASE}/api/admin/assign-members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      project_id: projectId,
      member_ids
    })
  });

  const data = await res.json();

  document.getElementById("assignMessage").innerHTML =
    `<div class="alert alert-success">${data.message}</div>`;
}

//loadMembers();
async function createRoadmap() {
  if (!selectedProjectId) {
    alert("Select a project first");
    return;
  }

  const text = document.getElementById("roadmapStepsInput").value;

  const steps = text
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  if (steps.length === 0) {
    alert("Enter at least one roadmap step");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/create-roadmap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        project_id: selectedProjectId,
        steps
      })
    }
    );

    const data = await res.json();

    document.getElementById("roadmapMessage").innerHTML =
      `<div class="alert alert-success">${data.message}</div>`;

    // Reload roadmap after creation
    loadRoadmap(selectedProjectId);

  } catch (err) {
    alert("Failed to create roadmap");
    console.error(err);
  }
}


/***********************
 * TEAM LEAD DAILY WORK REPORT
 ***********************/
async function submitLeadDailyReport() {
  const workDone = document.getElementById("leadWorkDone").value.trim();
  const messageDiv = document.getElementById("leadWorkMessage");

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

    document.getElementById("leadWorkDone").value = "";

  } catch (err) {
    console.error(err);
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Failed to submit report</div>`;
  }
}
document.addEventListener("DOMContentLoaded", () => {
  loadProjects();
  loadMembers();    // members checkbox list
  loadMyStatus();   // attendance
  loadNotifications();
  setInterval(loadNotifications, 60000);
  loadMyLeaveBalance();
  loadMyLeaveRequests();
  loadMyWorkReports();

  // Set month picker and auto-load attendance history
  const picker = document.getElementById("attendanceMonthPicker");
  if (picker) {
    picker.value = new Date().toISOString().slice(0, 7);
    loadMyAttendanceHistory();
  }
});

/* ================= MY WORK REPORTS ================= */
async function loadMyWorkReports() {
  const tbody = document.getElementById("myWorkReportsBody");
  const countBadge = document.getElementById("workReportCount");

  try {
    const res = await fetch(`${API_BASE}/api/work/my?type=DAILY`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: "Unknown error" }));
      console.error(`Error loading work reports (${res.status}):`, errorData);
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-3">Failed to load reports: ${errorData.message || res.statusText}</td></tr>`;
      return;
    }

    const reports = await res.json();

    if (reports.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3">No reports submitted yet</td></tr>`;
      countBadge.textContent = "0 reports";
      return;
    }

    countBadge.textContent = `${reports.length} report${reports.length !== 1 ? "s" : ""}`;

    tbody.innerHTML = reports.map(r => {
      const dateStr = new Date(r.report_date).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", timeZone: "UTC"
      });
      const workText = r.work_done.length > 120 ? r.work_done.slice(0, 120) + "…" : r.work_done;
      return `
        <tr>
          <td class="text-nowrap">${dateStr}</td>
          <td class="text-muted">${r.title || "—"}</td>
          <td title="${r.work_done.replace(/"/g, '&quot;')}">${workText}</td>
        </tr>`;
    }).join("");

  } catch (err) {
    console.error("Work reports error:", err);
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-3">Error loading reports: ${err.message}</td></tr>`;
  }
}

/* ================= LEAVE BALANCE ================= */
async function loadMyLeaveBalance() {
  try {
    const res = await fetch(`${API_BASE}/api/attendance/my-leave-balance`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return;

    const { quota, used, remaining, pending, year } = await res.json();

    document.getElementById("leaveBalanceYear").textContent = `(${year})`;
    document.getElementById("lbQuota").textContent = quota;
    document.getElementById("lbUsed").textContent = used;
    document.getElementById("lbRemaining").textContent = remaining;
    document.getElementById("lbPending").textContent = pending;

    const remPct = Math.round((remaining / quota) * 100);
    const pendPct = Math.round((pending / quota) * 100);
    const usedPct = Math.round((used / quota) * 100);

    document.getElementById("lbProgressBar").style.width = `${remPct}%`;
    document.getElementById("lbPendingBar").style.width = `${pendPct}%`;
    document.getElementById("lbUsedBar").style.width = `${usedPct}%`;

  } catch (err) {
    console.error("Leave balance error:", err);
  }
}

/* ================= APPLY LEAVE ================= */
async function applyLeave() {
  const fromDate = document.getElementById("leaveFromDate").value;
  const toDate = document.getElementById("leaveToDate").value;
  const reason = document.getElementById("leaveReason").value.trim();
  const messageDiv = document.getElementById("leaveMessage");

  if (!fromDate || !toDate || !reason) {
    messageDiv.innerHTML =
      `<div class="alert alert-danger">All fields are required</div>`;
    return;
  }

  if (fromDate > toDate) {
    messageDiv.innerHTML =
      `<div class="alert alert-danger">From date cannot be after To date</div>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/attendance/apply-leave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        from_date: fromDate,
        to_date: toDate,
        reason
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

    document.getElementById("leaveFromDate").value = "";
    document.getElementById("leaveToDate").value = "";
    document.getElementById("leaveReason").value = "";
    loadMyLeaveBalance();
    loadMyLeaveRequests();

  } catch (err) {
    console.error(err);
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Leave submission failed</div>`;
  }
}

/* ================= MY LEAVE REQUESTS ================= */
async function loadMyLeaveRequests() {
  const tbody = document.getElementById("myLeaveRequestsBody");
  try {
    const res = await fetch(`${API_BASE}/api/attendance/my-leave-requests`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: "Unknown error" }));
      console.error(`Error loading leave requests (${res.status}):`, errorData);
      // Also log serialized body so DevTools shows exact contents
      try { console.error('LeaveRequests response body (raw):', JSON.stringify(errorData)); } catch (e) { /* ignore */ }
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">Failed to load requests: ${errorData.message || res.statusText}</td></tr>`;
      return;
    }

    const data = await res.json();

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No leave requests found</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(l => {
      const appliedOn = new Date(l.created_at).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", timeZone: "UTC"
      });
      const fromD = new Date(l.from_date).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", timeZone: "UTC"
      });
      const toD = new Date(l.to_date).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", timeZone: "UTC"
      });

      let statusBadge = "";
      if (l.status === 'PENDING') statusBadge = '<span class="badge bg-warning text-dark">PENDING</span>';
      else if (l.status === 'APPROVED') statusBadge = '<span class="badge bg-success">APPROVED</span>';
      else statusBadge = '<span class="badge bg-danger">REJECTED</span>';

      return `
        <tr>
          <td class="text-nowrap">${appliedOn}</td>
          <td class="text-nowrap">${fromD}</td>
          <td class="text-nowrap">${toD}</td>
          <td>${l.reason}</td>
          <td>${statusBadge}</td>
        </tr>`;
    }).join("");

  } catch (err) {
    console.error("Leave requests error:", err);
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">Error loading requests: ${err.message}</td></tr>`;
  }
}

/* ================= ATTENDANCE HISTORY ================= */
const STATUS_STYLE = {
  PRESENT: { bg: "#dcfce7", color: "#15803d", label: "Present" },
  CHECKED_IN: { bg: "#dbeafe", color: "#1d4ed8", label: "Checked In" },
  ABSENT: { bg: "#fee2e2", color: "#dc2626", label: "Absent" },
  LATE: { bg: "#fef9c3", color: "#a16207", label: "Late" },
  ON_LEAVE: { bg: "#ede9fe", color: "#7c3aed", label: "On Leave" },
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function loadMyAttendanceHistory() {
  const month = document.getElementById("attendanceMonthPicker").value;
  const tbody = document.getElementById("attendanceHistoryBody");
  const summaryBar = document.getElementById("attendanceSummaryBar");

  tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Loading...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/api/attendance/my-history?month=${month}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const records = await res.json();

    if (!records.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">No records for this month</td></tr>`;
      summaryBar.innerHTML = "";
      return;
    }

    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, ON_LEAVE: 0, CHECKED_IN: 0 };
    records.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });

    tbody.innerHTML = records.map(r => {
      const s = STATUS_STYLE[r.status] || { bg: "#f1f5f9", color: "#64748b", label: r.status };
      const dateObj = new Date(r.date);
      const dayName = DAYS[dateObj.getUTCDay()];
      const dateStr = dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
      return `
        <tr>
          <td>${dateStr}</td>
          <td class="text-muted">${dayName}</td>
          <td>${r.check_in || "—"}</td>
          <td>${r.check_out || "—"}</td>
          <td><span style="background:${s.bg}; color:${s.color}; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:600;">${s.label}</span></td>
          <td class="text-muted">${r.shift_name || "—"}</td>
        </tr>`;
    }).join("");

    summaryBar.innerHTML = [
      `<span>✅ Present: <strong>${counts.PRESENT}</strong></span>`,
      `<span>🔵 Checked-In: <strong>${counts.CHECKED_IN}</strong></span>`,
      `<span>❌ Absent: <strong>${counts.ABSENT}</strong></span>`,
      `<span>⏰ Late: <strong>${counts.LATE}</strong></span>`,
      `<span>🟣 On Leave: <strong>${counts.ON_LEAVE}</strong></span>`,
    ].join("<span class='mx-1'>·</span>");

  } catch (err) {
    console.error("Attendance history error:", err);
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">Failed to load</td></tr>`;
  }
}

/* ================= NOTIFICATIONS ================= */

async function loadNotifications() {
  try {
    const res = await fetch(`${API_BASE}/api/notifications/my-notifications`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const notifs = await res.json();
    const list = document.getElementById("notifList");
    const badge = document.getElementById("notifBadge");

    const unread = notifs.filter(n => !n.is_read);

    if (unread.length > 0) {
      badge.style.display = "flex";
      badge.textContent = unread.length > 9 ? "9+" : unread.length;
    } else {
      badge.style.display = "none";
    }

    if (notifs.length === 0) {
      list.innerHTML = `<div class="notif-empty">No notifications yet</div>`;
      return;
    }

    list.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.is_read ? "" : "unread"}"
           data-id="${n.id}"
           onclick="markOneRead(event, ${n.id}, this)">
        <div>${n.message}</div>
        <div class="notif-time">${new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
      </div>
    `).join("");

  } catch (err) {
    console.error("Load notifications error:", err);
  }
}

function toggleNotifDropdown() {
  document.getElementById("notifDropdown").classList.toggle("open");
}

document.addEventListener("click", (e) => {
  const bell = document.getElementById("notifBell");
  if (bell && !bell.contains(e.target)) {
    document.getElementById("notifDropdown").classList.remove("open");
  }
});

async function markOneRead(e, id, el) {
  e.stopPropagation();
  if (!el.classList.contains("unread")) return;
  try {
    await fetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    });
    el.classList.remove("unread");
    loadNotifications();
  } catch (err) {
    console.error("Mark read error:", err);
  }
}

async function markAllRead(e) {
  e.stopPropagation();
  try {
    await fetch(`${API_BASE}/api/notifications/mark-all-read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` }
    });
    loadNotifications();
  } catch (err) {
    console.error("Mark all read error:", err);
  }
}

/* ================= CHANGE PASSWORD ================= */
async function changePassword() {
  const msgDiv = document.getElementById("cpMessage");
  const current = document.getElementById("cpCurrent").value.trim();
  const newPass = document.getElementById("cpNew").value.trim();
  const confirm = document.getElementById("cpConfirm").value.trim();

  msgDiv.innerHTML = "";

  if (!current || !newPass || !confirm) {
    msgDiv.innerHTML = `<span class="text-danger">All fields are required</span>`;
    return;
  }
  if (newPass.length < 6) {
    msgDiv.innerHTML = `<span class="text-danger">New password must be at least 6 characters</span>`;
    return;
  }
  if (newPass !== confirm) {
    msgDiv.innerHTML = `<span class="text-danger">New passwords do not match</span>`;
    return;
  }

  msgDiv.innerHTML = `<span class="text-muted">Updating...</span>`;

  try {
    const res = await fetch(`${API_BASE}/api/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword: current, newPassword: newPass })
    });

    const data = await res.json();

    if (!res.ok) {
      msgDiv.innerHTML = `<span class="text-danger">❌ ${data.message}</span>`;
      return;
    }

    msgDiv.innerHTML = `<span class="text-success">✅ ${data.message}</span>`;
    document.getElementById("cpCurrent").value = "";
    document.getElementById("cpNew").value = "";
    document.getElementById("cpConfirm").value = "";
    setTimeout(() => { msgDiv.innerHTML = ""; }, 5000);

  } catch (err) {
    console.error("Change password error:", err);
    msgDiv.innerHTML = `<span class="text-danger">Failed to update password</span>`;
  }
}
