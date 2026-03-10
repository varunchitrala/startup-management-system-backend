console.log("✅ Member dashboard JS loaded");

const API_BASE = "https://startup-management-system-backend.onrender.com";
const token = localStorage.getItem("token");

if (!token) {
  alert("Login again");
  window.location.href = "../index.html";
}

/* ================= LOGOUT ================= */
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  window.location.href = "../index.html";
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

  checkInBtn.disabled = true;
  messageDiv.innerHTML =
    `<div class="alert alert-info">📡 Getting GPS location (wait a few seconds for best accuracy)...</div>`;

  let bestPosition = null;
  let readings = 0;
  let sent = false;  // guard to prevent double-calling sendCheckIn

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (sent) return;
      readings++;
      const acc = position.coords.accuracy;
      console.log(`📍 GPS reading #${readings}: lat=${position.coords.latitude}, lon=${position.coords.longitude}, accuracy=${acc.toFixed(0)}m`);

      // Keep the most accurate reading
      if (!bestPosition || acc < bestPosition.coords.accuracy) {
        bestPosition = position;
      }

      // If we get a very accurate reading (<30m), use it immediately
      if (acc < 30) {
        sent = true;
        navigator.geolocation.clearWatch(watchId);
        sendCheckIn(bestPosition);
      }
    },
    (error) => {
      if (sent) return;
      navigator.geolocation.clearWatch(watchId);
      console.error("📍 Geolocation error:", error.code, error.message);

      // Fallback: try getCurrentPosition as a last resort
      messageDiv.innerHTML =
        `<div class="alert alert-info">📡 Retrying location with fallback method...</div>`;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (sent) return;
          sent = true;
          sendCheckIn(pos);
        },
        (err2) => {
          if (sent) return;
          checkInBtn.disabled = false;
          console.error("📍 Fallback geolocation error:", err2.code, err2.message);
          messageDiv.innerHTML =
            `<div class="alert alert-danger">Location error: ${err2.message || error.message || "Permission denied"}. Please enable location and try again.</div>`;
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
      );
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }
  );

  // After 10 seconds, use the best reading we have (increased from 5s for mobile GPS)
  setTimeout(() => {
    navigator.geolocation.clearWatch(watchId);
    if (sent) return;  // already sent, do nothing
    if (bestPosition) {
      sent = true;
      sendCheckIn(bestPosition);
    } else {
      // Last resort fallback: try single getCurrentPosition with relaxed settings
      messageDiv.innerHTML =
        `<div class="alert alert-info">📡 Still acquiring location, trying fallback...</div>`;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (sent) return;
          sent = true;
          sendCheckIn(pos);
        },
        (err) => {
          if (sent) return;
          checkInBtn.disabled = false;
          messageDiv.innerHTML =
            `<div class="alert alert-danger">Could not get GPS location. Please ensure location is enabled, try outdoors, and try again.</div>`;
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
      );
    }
  }, 10000);
};

async function sendCheckIn(position) {
  try {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    console.log("📍 Best GPS reading:", latitude, longitude, "Accuracy:", accuracy.toFixed(0), "m");
    messageDiv.innerHTML =
      `<div class="alert alert-info">📡 Checking in (GPS accuracy: ~${Math.round(accuracy)}m)...</div>`;

    const res = await fetch(`${API_BASE}/api/attendance/check-in`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ latitude, longitude, accuracy })
    });

    const data = await res.json();

    if (!res.ok) {
      // If blocked by missed checkout penalty, show button to open the modal
      if (res.status === 403 && data.message && data.message.includes('missed checkout')) {
        messageDiv.innerHTML =
          `<div class="alert alert-danger">
            ${data.message}
            <br><button class="btn btn-sm btn-warning mt-2 fw-bold" onclick="forceOpenMissedModal()">
              📝 Submit Missed Report Now
            </button>
          </div>`;
      } else {
        messageDiv.innerHTML =
          `<div class="alert alert-danger">${data.message}</div>`;
      }
      checkInBtn.disabled = false;
      return;
    }

    messageDiv.innerHTML =
      `<div class="alert alert-success">${data.message}</div>`;

    loadStatus();
    loadMyAttendanceHistory();
    updateCheckoutBanner();

  } catch (err) {
    console.error("Check-in error:", err);
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Check-in failed</div>`;
    checkInBtn.disabled = false;
  }
}


// Check Out
checkOutBtn.onclick = async () => {
  checkOutBtn.disabled = true;
  checkOutBtn.textContent = "Processing...";
  try {
    // 🔒 Block checkout if daily work report not submitted
    const reportCheck = await fetch(`${API_BASE}/api/work/check-today`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const reportData = await reportCheck.json();

    if (!reportData.submitted) {
      messageDiv.innerHTML =
        `<div class="alert alert-warning">⚠️ Please submit your daily work report before checking out.</div>`;
      checkOutBtn.disabled = false;
      checkOutBtn.textContent = "Check Out";
      return;
    }

    const istWeekday = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      weekday: "short"
    });
    if (istWeekday === "Sat") {
      const weeklyCheck = await fetch(`${API_BASE}/api/work/check-weekly`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const weeklyData = await weeklyCheck.json();

      if (!weeklyData.submitted) {
        messageDiv.innerHTML =
          `<div class="alert alert-warning">Saturday checkout is blocked until you submit this week's weekly report.</div>`;
        checkOutBtn.disabled = false;
        checkOutBtn.textContent = "Check Out";
        return;
      }
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
      checkOutBtn.disabled = false;
      checkOutBtn.textContent = "Check Out";
      return;
    }

    messageDiv.innerHTML =
      `<div class="alert alert-success">${data.message}</div>`;

    loadStatus();
    loadMyAttendanceHistory();
    updateCheckoutBanner();

  } catch (err) {
    console.error("Check-out error:", err);
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Check-out failed</div>`;
    checkOutBtn.disabled = false;
    checkOutBtn.textContent = "Check Out";
  }
};

async function submitMemberDailyReport() {
  const workDone = document
    .getElementById("memberWorkDone")
    .value.trim();

  const messageDiv = document.getElementById("memberWorkMessage");
  const btn = event ? event.target : null;

  if (!workDone) {
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Please enter work details</div>`;
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = "Submitting..."; }

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
      if (btn) { btn.disabled = false; btn.textContent = "Commit Report"; }
      return;
    }

    messageDiv.innerHTML =
      `<div class="alert alert-success">${data.message}</div>`;

    document.getElementById("memberWorkDone").value = "";
    loadMyWorkReports();
    updateCheckoutBanner();
    if (btn) { btn.disabled = false; btn.textContent = "Commit Report"; }

  } catch (err) {
    console.error(err);
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Submission failed</div>`;
    if (btn) { btn.disabled = false; btn.textContent = "Commit Report"; }
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
    loadMyLeaveBalance();
    loadMyLeaveRequests();

  } catch (err) {
    console.error(err);
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Leave submission failed</div>`;
  }
}


/* ================= MY PROJECT PORTFOLIO STATS ================= */
async function loadMyProjectStats() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/my-project-stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    // Stat badges
    const statusBadge = document.getElementById("myProjectStatusBadge");
    if (statusBadge) {
      if (data.status === "FREE") {
        statusBadge.className = "badge bg-success";
        statusBadge.textContent = "🟢 Free";
      } else {
        statusBadge.className = "badge bg-warning text-dark";
        statusBadge.textContent = "🟠 Assigned";
      }
    }

    // Stat cards
    const ac = document.getElementById("activeProjectCount");
    const cc = document.getElementById("completedProjectCount");
    const tc = document.getElementById("totalProjectCount");
    if (ac) ac.textContent = data.active_count;
    if (cc) cc.textContent = data.completed_count;
    if (tc) tc.textContent = data.active_count + data.completed_count;

    // Active projects list
    const activeDiv = document.getElementById("activeProjectsList");
    if (activeDiv) {
      if (data.active_projects.length === 0) {
        activeDiv.innerHTML = `<div class="text-muted small text-center py-2">No active projects</div>`;
      } else {
        activeDiv.innerHTML = `
          <h6 class="fw-bold text-uppercase text-muted small mb-2">
            <i class="bi bi-lightning-charge text-warning"></i> Active Projects
          </h6>` +
          data.active_projects.map(p => `
            <div class="border rounded p-3 mb-2 bg-light">
              <div class="d-flex justify-content-between align-items-start">
                <strong class="text-primary">${p.project_name}</strong>
                <span class="badge bg-info text-dark">${p.days_elapsed} day${p.days_elapsed > 1 ? "s" : ""}</span>
              </div>
              ${p.team_lead_name ? `<div class="small text-muted mt-1">Lead: ${p.team_lead_name}</div>` : ""}
              ${p.member_count ? `<div class="small text-muted">Members: ${p.member_count}</div>` : ""}
              <div class="progress mt-2" style="height:6px;">
                <div class="progress-bar bg-success" style="width:${p.progress}%"></div>
              </div>
              <div class="d-flex justify-content-between mt-1">
                <span class="small text-muted">Roadmap: ${p.progress}%</span>
                <span class="small text-muted">${p.completed_steps}/${p.total_steps} steps</span>
              </div>
            </div>
          `).join("");
      }
    }

    // Completed projects list
    const compDiv = document.getElementById("completedProjectsList");
    if (compDiv) {
      if (data.completed_projects.length === 0) {
        compDiv.innerHTML = `<div class="text-muted small text-center py-2">No completed projects yet</div>`;
      } else {
        compDiv.innerHTML = `
          <h6 class="fw-bold text-uppercase text-muted small mb-2">
            <i class="bi bi-check-circle text-success"></i> Completed Projects
          </h6>` +
          data.completed_projects.map(p => `
            <div class="border rounded p-2 mb-2" style="background:#f0fdf4;">
              <div class="d-flex justify-content-between align-items-center">
                <span class="fw-bold text-success">${p.project_name}</span>
                <span class="badge bg-success">${p.days_taken} day${p.days_taken > 1 ? "s" : ""}</span>
              </div>
              ${p.team_lead_name ? `<div class="small text-muted">Lead: ${p.team_lead_name}</div>` : ""}
            </div>
          `).join("");
      }
    }

  } catch (err) {
    console.error("Project stats error:", err);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  loadMemberProjects();
  loadMyProjectStats();
  loadStatus();
  loadNotifications();
  setInterval(loadNotifications, 60000);
  loadMyLeaveBalance();
  loadMyLeaveRequests();
  loadMyWorkReports();
  loadMyWeeklyReports();
  checkWeeklyReportStatus();
  setWeekRangeLabel();
  updateCheckoutBanner();
  loadMyAttendancePercentage(); // Show attendance % card on load

  // Set month picker to current month and auto-load
  const picker = document.getElementById("attendanceMonthPicker");
  if (picker) {
    picker.value = new Date().toISOString().slice(0, 7);
    loadMyAttendanceHistory();
  }

  // Enforce missed checkout report
  checkPendingMissed();
});

// Add this just below DOMContentLoaded
let missedCheckoutModalInstance = null;
async function checkPendingMissed() {
  try {
    const res = await fetch(`${API_BASE}/api/work/pending-missed`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const pending = await res.json();
    if (pending && pending.length > 0) {
      openMissedModal(pending[0]);
    }
  } catch (err) {
    console.error("Pending missed check error:", err);
  }
}

// Reusable function to open missed checkout modal — can be called from anywhere
function openMissedModal(mcData) {
  try {
    if (mcData) {
      document.getElementById("mcId").value = mcData.id;
      const fmtDate = new Date(mcData.date).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      document.getElementById("mcDateText").innerText = fmtDate;
    }

    const modalEl = document.getElementById('missedCheckoutModal');
    if (!modalEl) {
      console.error("missedCheckoutModal element not found in HTML!");
      return;
    }

    // Remove stale aria-hidden
    modalEl.removeAttribute('aria-hidden');

    if (!missedCheckoutModalInstance) {
      missedCheckoutModalInstance = new bootstrap.Modal(modalEl, {
        backdrop: 'static',
        keyboard: false
      });
    }
    missedCheckoutModalInstance.show();
  } catch (err) {
    console.error("Failed to open missed checkout modal:", err);
    // Ultimate fallback: alert
    alert("⚠️ You have a pending missed checkout report. Please refresh the page and submit it.");
  }
}

// Expose so the check-in error button can call it
window.openMissedModal = openMissedModal;

// Fallback: fetch and open modal manually (called from check-in error button)
window.forceOpenMissedModal = async function () {
  try {
    const res = await fetch(`${API_BASE}/api/work/pending-missed`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const pending = await res.json();
    if (pending && pending.length > 0) {
      openMissedModal(pending[0]);
    }
  } catch (err) {
    console.error("Force open missed modal error:", err);
    alert("⚠️ Could not load missed checkout data. Please refresh the page.");
  }
};


const MEMBER_LIVE_REFRESH_MS = 15000;

/* ================= CHECKOUT REMINDER BANNER ================= */
async function updateCheckoutBanner() {
  try {
    const banner = document.getElementById("checkoutReminderBanner");
    if (!banner) return;

    const statusRes = await fetch(`${API_BASE}/api/attendance/my-status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const statusData = await statusRes.json();

    if (statusData.status !== "CHECKED_IN") {
      banner.classList.remove("visible");
      return;
    }

    const reportRes = await fetch(`${API_BASE}/api/work/check-today`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const reportData = await reportRes.json();

    if (reportData.submitted) {
      banner.classList.remove("visible");
    } else {
      banner.classList.add("visible");
    }
  } catch (err) {
    console.error("Banner check error:", err);
  }
}

function refreshMemberLiveData() {
  loadStatus();
  loadNotifications();
  checkWeeklyReportStatus();
  updateCheckoutBanner();

  const picker = document.getElementById("attendanceMonthPicker");
  if (picker && picker.value) {
    loadMyAttendanceHistory();
  }
}

setInterval(() => {
  if (document.visibilityState === "visible") {
    refreshMemberLiveData();
  }
}, MEMBER_LIVE_REFRESH_MS);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshMemberLiveData();
  }
});

/* ================= WEEK RANGE HELPER ================= */
function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

function setWeekRangeLabel() {
  const label = document.getElementById("weekRangeLabel");
  if (!label) return;
  const { monday, sunday } = getWeekRange();
  const fmt = (d) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  label.textContent = `${fmt(monday)} – ${fmt(sunday)}`;
}

/* ================= SUBMIT WEEKLY REPORT ================= */
async function submitWeeklyReport() {
  const skills = document.getElementById("weeklySkillsLearned").value.trim();
  const projectUpdate = document.getElementById("weeklyProjectUpdate").value.trim();
  const workDone = document.getElementById("weeklyWorkDone").value.trim();
  const msgDiv = document.getElementById("weeklyReportMessage");

  if (!skills || !projectUpdate || !workDone) {
    msgDiv.innerHTML = `<div class="alert alert-danger">All weekly report fields are required</div>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/work/weekly`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        skills_learned: skills,
        project_update: projectUpdate,
        work_done: workDone
      })
    });

    const data = await res.json();

    if (!res.ok) {
      msgDiv.innerHTML = `<div class="alert alert-danger">${data.message}</div>`;
      return;
    }

    msgDiv.innerHTML = `<div class="alert alert-success">${data.message}</div>`;
    document.getElementById("weeklySkillsLearned").value = "";
    document.getElementById("weeklyProjectUpdate").value = "";
    document.getElementById("weeklyWorkDone").value = "";
    loadMyWeeklyReports();
    checkWeeklyReportStatus();

  } catch (err) {
    console.error("Weekly report error:", err);
    msgDiv.innerHTML = `<div class="alert alert-danger">Submission failed</div>`;
  }
}

/* ================= CHECK WEEKLY REPORT STATUS ================= */
async function checkWeeklyReportStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/work/check-weekly`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    const alreadyDiv = document.getElementById("weeklyAlreadySubmitted");
    const formDiv = document.getElementById("weeklyReportForm");

    if (data.submitted) {
      alreadyDiv.style.display = "block";
      formDiv.style.display = "none";
    } else {
      alreadyDiv.style.display = "none";
      formDiv.style.display = "block";
    }
  } catch (err) {
    console.error("Check weekly status error:", err);
  }
}

/* ================= MY WEEKLY REPORTS ARCHIVE ================= */
async function loadMyWeeklyReports() {
  const tbody = document.getElementById("myWeeklyReportsBody");
  const countBadge = document.getElementById("weeklyReportCount");

  try {
    const res = await fetch(`${API_BASE}/api/work/my?type=WEEKLY`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">Failed to load</td></tr>`;
      return;
    }

    const reports = await res.json();

    if (reports.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">No weekly reports submitted yet</td></tr>`;
      countBadge.textContent = "0";
      return;
    }

    countBadge.textContent = `${reports.length} report${reports.length !== 1 ? "s" : ""}`;

    tbody.innerHTML = reports.map(r => {
      const ws = new Date(r.week_start).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
      const we = new Date(r.week_end).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
      const truncate = (text, max) => {
        if (!text) return "<span class='text-muted'>—</span>";
        return text.length > 100 ? text.slice(0, 100) + "…" : text;
      };
      return `
        <tr>
          <td class="text-nowrap">${ws} – ${we}</td>
          <td title="${(r.skills_learned || '').replace(/"/g, '&quot;')}">${truncate(r.skills_learned)}</td>
          <td title="${(r.project_update || '').replace(/"/g, '&quot;')}">${truncate(r.project_update)}</td>
          <td title="${(r.work_done || '').replace(/"/g, '&quot;')}">${truncate(r.work_done)}</td>
        </tr>`;
    }).join("");

  } catch (err) {
    console.error("Weekly reports error:", err);
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">Error loading</td></tr>`;
  }
}

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
  HOLIDAY: { bg: "#e0f2fe", color: "#0369a1", label: "Holiday" },
  MISSED_CHECKOUT: { bg: "#fecaca", color: "#991b1b", label: "Missed Checkout ⚠️" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function loadMyAttendanceHistory() {
  const month = document.getElementById("attendanceMonthPicker").value;
  const tbody = document.getElementById("attendanceHistoryBody");
  const summaryBar = document.getElementById("attendanceSummaryBar");

  tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-3">Loading...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/api/attendance/my-history?month=${month}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const records = await res.json();

    if (!records.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-3">No records for this month</td></tr>`;
      summaryBar.innerHTML = "";
      return;
    }

    // Summary counts
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, ON_LEAVE: 0, CHECKED_IN: 0, HOLIDAY: 0 };
    let totalEarly = 0;
    let totalOT = 0;
    records.forEach(r => {
      if (counts[r.status] !== undefined) counts[r.status]++;
      if (r.early_checkout_minutes) totalEarly += Number(r.early_checkout_minutes);
      if (r.overtime_minutes) totalOT += Number(r.overtime_minutes);
    });

    tbody.innerHTML = records.map(r => {
      const s = STATUS_STYLE[r.status] || { bg: "#f1f5f9", color: "#64748b", label: r.status };
      const dateObj = new Date(r.date);
      const dayName = DAYS[dateObj.getUTCDay()];
      const dateStr = dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });

      const earlyMin = r.early_checkout_minutes ? Number(r.early_checkout_minutes) : 0;
      const otMin = r.overtime_minutes ? Number(r.overtime_minutes) : 0;

      const earlyBadge = earlyMin > 0
        ? `<span style="background:#fee2e2; color:#dc2626; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:600;">${earlyMin}</span>`
        : `<span class="text-muted">—</span>`;

      const otBadge = otMin > 0
        ? `<span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:600;">${otMin}</span>`
        : `<span class="text-muted">—</span>`;

      return `
        <tr>
          <td>${dateStr}</td>
          <td class="text-muted">${dayName}</td>
          <td>${r.check_in || "—"}</td>
          <td>${r.check_out || "—"}</td>
          <td><span style="background:${s.bg}; color:${s.color}; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:600;">${s.label}</span></td>
          <td class="text-muted">${r.shift_name || "—"}</td>
          <td>${earlyBadge}</td>
          <td>${otBadge}</td>
        </tr>`;
    }).join("");

    // Summary bar
    summaryBar.innerHTML = [
      `<span>✅ Present: <strong>${counts.PRESENT}</strong></span>`,
      `<span>🔵 Checked-In: <strong>${counts.CHECKED_IN}</strong></span>`,
      `<span>❌ Absent: <strong>${counts.ABSENT}</strong></span>`,
      `<span>⏰ Late: <strong>${counts.LATE}</strong></span>`,
      `<span>🟣 On Leave: <strong>${counts.ON_LEAVE}</strong></span>`,
      `<span>🏖️ Holiday: <strong>${counts.HOLIDAY}</strong></span>`,
      totalEarly > 0 ? `<span>⚠️ Early: <strong style="color:#dc2626;">${totalEarly} min</strong></span>` : "",
      totalOT > 0 ? `<span>💪 OT: <strong style="color:#15803d;">${totalOT} min</strong></span>` : "",
    ].filter(Boolean).join(`<span class='mx-1'>·</span>`);

    // Load and show attendance percentage (only when viewing current month)
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (month === currentMonth) {
      loadMyAttendancePercentage();
    }
  } catch (err) {
    console.error("Attendance history error:", err);
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Failed to load</td></tr>`;
  }
}

/* ================= ATTENDANCE PERCENTAGE CARD ================= */
async function loadMyAttendancePercentage() {
  try {
    const res = await fetch(`${API_BASE}/api/attendance/my-percentage`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    const pct = data.percentage;
    const from = new Date(data.from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
    const to = new Date(data.to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });

    const color = pct >= 75 ? '#15803d' : pct >= 50 ? '#b45309' : '#dc2626';
    const bg = pct >= 75 ? '#dcfce7' : pct >= 50 ? '#fef3c7' : '#fee2e2';
    const emoji = pct >= 75 ? '🟢' : pct >= 50 ? '🟡' : '🔴';

    const container = document.getElementById('attendancePercentageCard');
    if (container) {
      container.innerHTML = `
        <div style="background:${bg}; border:2px solid ${color}; border-radius:12px; padding:14px 20px; display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
          <div style="font-size:2.2rem; font-weight:800; color:${color};">${emoji} ${pct}%</div>
          <div>
            <div style="font-weight:700; color:${color}; font-size:0.95rem;">Your Attendance (2nd – Today)</div>
            <div style="font-size:0.82rem; color:#64748b;">
              ${data.present_days} present / ${data.effective_working_days} effective working days
              &nbsp;·&nbsp; ${from} – ${to}
              ${data.leave_days > 0 ? `&nbsp;·&nbsp; ${data.leave_days} leave day(s) excluded` : ''}
            </div>
          </div>
        </div>`;
      container.style.display = 'block';
    }
  } catch (err) {
    console.error('Attendance percentage error:', err);
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

/* ================= MISSED CHECKOUT SUBMISSION ================= */
async function submitMissedCheckout() {
  const mcId = document.getElementById("mcId").value;
  const workDone = document.getElementById("mcWorkDone").value.trim();
  const lateReason = document.getElementById("mcLateReason").value.trim();
  const msgDiv = document.getElementById("mcMessage");

  if (!workDone || !lateReason) {
    msgDiv.innerHTML = `<div class="alert alert-danger py-2">Please fill both fields.</div>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/work/submit-missed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ id: mcId, work_done: workDone, late_reason: lateReason })
    });

    const data = await res.json();

    if (!res.ok) {
      msgDiv.innerHTML = `<div class="alert alert-danger py-2">${data.message || "Submission failed"}</div>`;
      return;
    }

    msgDiv.innerHTML = `<div class="alert alert-success py-2">Compliance report submitted</div>`;

    setTimeout(() => {
      // Hide modal
      if (missedCheckoutModalInstance) missedCheckoutModalInstance.hide();
      document.getElementById("mcWorkDone").value = "";
      document.getElementById("mcLateReason").value = "";
      // Refresh to see if there are more
      checkPendingMissed();
      loadMyWorkReports();
    }, 1500);

  } catch (err) {
    console.error("Submit missed checkout error:", err);
    msgDiv.innerHTML = `<div class="alert alert-danger py-2">Submission failed</div>`;
  }
}
