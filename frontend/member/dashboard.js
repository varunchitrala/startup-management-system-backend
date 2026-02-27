console.log("✅ Member dashboard JS loaded");

const API_BASE = "https://startup-management-system-backend.onrender.com";
const token = localStorage.getItem("token");

if (!token) {
  alert("Login again");
  window.location.href = "../login.html";
}

const statusText = document.getElementById("statusText");
const messageDiv = document.getElementById("message");
const checkInBtn = document.getElementById("checkInBtn");
const checkOutBtn = document.getElementById("checkOutBtn");
const projectTitle = document.getElementById("projectTitle");


// Load status
async function loadStatus() {
  const res = await fetch(`${API_BASE}/api/attendance/my-status`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  statusText.innerText = `Status: ${data.status}`;

  checkInBtn.disabled = data.status !== "ABSENT";
  checkOutBtn.disabled = data.status !== "CHECKED_IN";
}

// Check In
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

        console.log("📍 Member Location:", latitude, longitude);

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

        loadStatus();

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


// Check Out
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

    loadStatus();

  } catch (err) {
    console.error("Check-out error:", err);
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Check-out failed</div>`;
  }
};

async function submitMemberDailyReport() {
  const workDone = document
    .getElementById("memberWorkDone")
    .value.trim();

  const messageDiv = document.getElementById("memberWorkMessage");

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

    document.getElementById("memberWorkDone").value = "";

  } catch (err) {
    console.error(err);
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Submission failed</div>`;
  }
}
async function loadMemberProjects() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/member/roadmap`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const projects = await res.json();

    const select = document.getElementById("memberProjectSelect");
    const stepsList = document.getElementById("memberRoadmapSteps");
    const progressBar = document.getElementById("memberProgressBar");

    select.innerHTML = `<option value="">Select Project</option>`;
    stepsList.innerHTML = "";
    progressBar.style.width = "0%";
    progressBar.innerText = "0%";

    if (!projects.length) {
      stepsList.innerHTML = `
        <li class="list-group-item text-muted">
          No project assigned
        </li>
      `;
      return;
    }

    projects.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.project_id;
      opt.textContent = p.project_name;
      select.appendChild(opt);
    });

    select.onchange = () => {
      const selected = projects.find(
        p => p.project_id == select.value
      );
      if (selected) renderMemberRoadmap(selected);
    };

  } catch (err) {
    console.error("Failed to load member projects:", err);
  }
}

function renderMemberRoadmap(project) {
  const stepsList = document.getElementById("memberRoadmapSteps");
  const progressBar = document.getElementById("memberProgressBar");

  stepsList.innerHTML = "";

  const total = project.steps.length;
  const completed = project.steps.filter(s => s.is_completed).length;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  progressBar.style.width = progress + "%";
  progressBar.innerText = progress + "%";

  project.steps.forEach(step => {
    const li = document.createElement("li");
    li.className = "list-group-item";

    li.innerHTML = `
      <input type="checkbox"
        ${step.is_completed ? "checked" : ""}
        onchange="updateStep(${step.id}, this.checked)">
      ${step.step_title}
    `;

    stepsList.appendChild(li);
  });
}

async function updateStep(stepId, isCompleted) {
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

  loadMemberProjects(); // reload everything
}
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

  } catch (err) {
    console.error(err);
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Leave submission failed</div>`;
  }
}



document.addEventListener("DOMContentLoaded", () => {
  loadMemberProjects();
  loadStatus();
  loadNotifications();
  setInterval(loadNotifications, 60000);
  loadMyLeaveBalance();
  loadMyWorkReports();

  // Set month picker to current month and auto-load
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
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-3">Failed to load reports</td></tr>`;
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
      // Truncate long work_done text with expandable title tooltip
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
    tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-3">Error loading reports</td></tr>`;
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

    // Progress bar: remaining=green, pending=yellow, used=red (all % of quota)
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

    // Summary counts
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

    // Summary bar
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

    // Update badge
    if (unread.length > 0) {
      badge.style.display = "flex";
      badge.textContent = unread.length > 9 ? "9+" : unread.length;
    } else {
      badge.style.display = "none";
    }

    // Render list
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
  const dropdown = document.getElementById("notifDropdown");
  dropdown.classList.toggle("open");
}

// Close dropdown when clicking outside
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
    loadNotifications(); // refresh badge
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
