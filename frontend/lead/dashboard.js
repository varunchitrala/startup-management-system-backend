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

      const span = document.createElement("span");
      span.className = step.is_completed ? "text-decoration-line-through text-muted" : "fw-bold";
      span.innerText = step.step_title;
      left.appendChild(span);

      const center = document.createElement("small");
      center.className = "text-muted ms-auto pe-3";
      center.style.minWidth = "120px";
      center.style.textAlign = "right";
      if (step.updated_by) center.innerHTML = `<i class="bi bi-person-check text-success"></i> ${step.updated_by}`;

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-sm btn-outline-danger border-0";
      deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
      deleteBtn.onclick = () => deleteStep(step.id, projectId);

      li.appendChild(left);
      li.appendChild(center);
      li.appendChild(deleteBtn);
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

// ================= DELETE ROADMAP STEP ================= */
async function deleteStep(stepId, projectId) {
  if (!confirm("Are you sure you want to delete this step?")) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/roadmap-step/${stepId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Failed to delete step");

    // Reload roadmap
    loadRoadmap(projectId);
  } catch (err) {
    console.error(err);
    alert("Failed to delete step");
  }
}

// ================= ADD SINGLE ROADMAP STEP ================= */
async function addSingleStep() {
  if (!selectedProjectId) return;

  const input = document.getElementById("newStepInput");
  const stepTitle = input.value.trim();

  if (!stepTitle) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/roadmap-step/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        project_id: selectedProjectId,
        step_title: stepTitle
      })
    });

    if (!res.ok) throw new Error("Failed to add step");

    input.value = "";
    loadRoadmap(selectedProjectId);
  } catch (err) {
    console.error(err);
    alert("Failed to add step");
  }
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

/* ================= MY ATTENDANCE PERCENTAGE (2nd of month) ================= */
async function loadMyAttendancePercentage() {
  try {
    const res = await fetch(`${API_BASE}/api/attendance/my-percentage`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    const container = document.getElementById('attendancePercentageContainer');
    if (!container) return;

    const pct = data.percentage ?? 0;
    const color = pct >= 75 ? '#15803d' : pct >= 50 ? '#b45309' : '#dc2626';
    const from = data.from || '';
    const to = data.to || '';

    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:14px; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:12px;">
        <div style="width:52px; height:52px; border-radius:50%; background:conic-gradient(${color} ${pct * 3.6}deg, #e2e8f0 0deg); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <div style="width:38px; height:38px; border-radius:50%; background:#f8fafc; display:flex; align-items:center; justify-content:center;">
            <span style="font-size:0.78rem; font-weight:800; color:${color};">${pct}%</span>
          </div>
        </div>
        <div>
          <div style="font-weight:700; color:${color}; font-size:0.95rem;">Your Attendance (2nd – Today)</div>
          <div style="font-size:0.82rem; color:#64748b;">
            ${data.present_days} present / ${data.effective_working_days} working days
            &nbsp;·&nbsp; ${from} – ${to}
          </div>
        </div>
      </div>`;
    container.style.display = 'block';
  } catch (err) {
    console.error('Attendance percentage error:', err);
  }
}
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
  let sent = false;  // guard to prevent double-calling sendLeadCheckIn

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (sent) return;
      readings++;
      const acc = position.coords.accuracy;
      console.log(`📍 GPS reading #${readings}: lat=${position.coords.latitude}, lon=${position.coords.longitude}, accuracy=${acc.toFixed(0)}m`);

      if (!bestPosition || acc < bestPosition.coords.accuracy) {
        bestPosition = position;
      }

      if (acc < 30) {
        sent = true;
        navigator.geolocation.clearWatch(watchId);
        sendLeadCheckIn(bestPosition);
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
          sendLeadCheckIn(pos);
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
      sendLeadCheckIn(bestPosition);
    } else {
      // Last resort fallback: try single getCurrentPosition with relaxed settings
      messageDiv.innerHTML =
        `<div class="alert alert-info">📡 Still acquiring location, trying fallback...</div>`;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (sent) return;
          sent = true;
          sendLeadCheckIn(pos);
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

async function sendLeadCheckIn(position) {
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

    loadMyStatus();
    loadMyAttendanceHistory();
    updateCheckoutBanner();

  } catch (err) {
    console.error("Check-in error:", err);
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Check-in failed</div>`;
    checkInBtn.disabled = false;
  }
}
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

    loadMyStatus();
    loadMyAttendanceHistory();
    updateCheckoutBanner();

  } catch (err) {
    console.error("Checkout error:", err);
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Checkout failed</div>`;
    checkOutBtn.disabled = false;
    checkOutBtn.textContent = "Check Out";
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

    // RIGHT: dropdown (only active projects)
    const select = document.getElementById("assignProjectSelect");
    select.innerHTML = `<option value="">Select Project</option>`;

    if (!projects.length) {
      list.innerHTML = `<div class="list-group-item text-muted text-center py-4">No projects assigned</div>`;
      return;
    }

    projects.forEach(p => {
      const isCompleted = p.status === 'COMPLETED';

      // Project list item with status
      const item = document.createElement("div");
      item.className = `list-group-item d-flex justify-content-between align-items-center ${isCompleted ? 'bg-light' : ''}`;
      item.style.cursor = isCompleted ? 'default' : 'pointer';

      const leftSide = document.createElement("div");
      leftSide.className = "d-flex align-items-center gap-2";
      leftSide.innerHTML = `
        <span class="${isCompleted ? 'text-muted' : ''}">${p.project_name}</span>
        <span class="badge ${isCompleted ? 'bg-success' : 'bg-primary'}" style="font-size:10px;">
          ${isCompleted ? '✅ COMPLETED' : 'ACTIVE'}
        </span>
      `;

      const rightSide = document.createElement("div");
      rightSide.className = "d-flex gap-2 align-items-center";

      if (!isCompleted) {
        // View Roadmap button
        const viewBtn = document.createElement("button");
        viewBtn.className = "btn-sys btn-sys-default border";
        viewBtn.style.fontSize = "11px";
        viewBtn.style.padding = "3px 10px";
        viewBtn.textContent = "📋 Roadmap";
        viewBtn.onclick = (e) => {
          e.stopPropagation();
          selectedProjectId = p.id;
          loadRoadmap(p.id);
        };
        rightSide.appendChild(viewBtn);

        // Mark Complete button
        const completeBtn = document.createElement("button");
        completeBtn.className = "btn-sys btn-sys-primary";
        completeBtn.style.fontSize = "11px";
        completeBtn.style.padding = "3px 10px";
        completeBtn.style.background = "#00875a";
        completeBtn.textContent = "✅ Mark Complete";
        completeBtn.onclick = (e) => {
          e.stopPropagation();
          completeProject(p.id, p.project_name);
        };
        rightSide.appendChild(completeBtn);
      }

      item.appendChild(leftSide);
      item.appendChild(rightSide);

      if (!isCompleted) {
        item.onclick = () => {
          selectedProjectId = p.id;
          loadRoadmap(p.id);
        };
      }

      list.appendChild(item);

      // Dropdown option — only active projects
      if (!isCompleted) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.project_name;
        select.appendChild(opt);
      }
    });

  } catch (err) {
    console.error("loadProjects failed:", err);
  }
}

// ================= COMPLETE PROJECT =================
async function completeProject(projectId, projectName) {
  if (!confirm(`Are you sure you want to mark "${projectName}" as COMPLETED?\n\nThis will release all assigned members.`)) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/projects/${projectId}/complete`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Failed to complete project");
      return;
    }

    alert("✅ " + data.message);
    loadProjects();

    // Clear roadmap section if this was the selected project
    if (selectedProjectId === projectId) {
      selectedProjectId = null;
      document.getElementById("roadmapSection").style.display = "none";
    }

  } catch (err) {
    console.error("Complete project error:", err);
    alert("Failed to complete project");
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

    // Add change listener to project select to auto-check assigned members
    const projSelect = document.getElementById("assignProjectSelect");
    if (projSelect) {
      projSelect.addEventListener("change", async (e) => {
        const pId = e.target.value;
        const checkboxes = document.querySelectorAll("#membersList input[type='checkbox']");

        // Reset all checkboxes
        checkboxes.forEach(cb => cb.checked = false);

        if (!pId) return;

        try {
          // Fetch existing members for this project
          const res = await fetch(`${API_BASE}/api/admin/project-members/${pId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) throw new Error("Failed to fetch project members");

          const assignedMembers = await res.json();
          // Check the boxes for currently assigned members
          assignedMembers.forEach(m => {
            const cb = document.getElementById(`member_${m.id}`);
            if (cb) cb.checked = true;
          });
        } catch (err) {
          console.error("Auto-check members error:", err);
        }
      });
    }

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

  const msgEl = document.getElementById("assignMessage");
  msgEl.innerHTML = `<div class="alert alert-success">${data.message}</div>`;
  setTimeout(() => { msgEl.innerHTML = ""; }, 3000);

  // Reload roadmap if a project is currently selected
  if (selectedProjectId) loadRoadmap(selectedProjectId);
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
    loadMyWorkReports(); // refresh archive instantly
    updateCheckoutBanner(); // hide banner immediately

  } catch (err) {
    console.error(err);
    messageDiv.innerHTML =
      `<div class="alert alert-danger">Failed to submit report</div>`;
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

    const ac = document.getElementById("activeProjectCount");
    const cc = document.getElementById("completedProjectCount");
    const tc = document.getElementById("totalProjectCount");
    if (ac) ac.textContent = data.active_count;
    if (cc) cc.textContent = data.completed_count;
    if (tc) tc.textContent = data.active_count + data.completed_count;

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
              <div class="small text-muted mt-1">Members: ${p.member_count || 0}</div>
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
              <div class="small text-muted">Members: ${p.member_count || 0}</div>
            </div>
          `).join("");
      }
    }

  } catch (err) {
    console.error("Project stats error:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadProjects();
  loadMembers();
  loadMyStatus();
  loadMyAttendancePercentage();
  loadMyProjectStats();
  loadNotifications();
  setInterval(loadNotifications, 60000);
  loadMyLeaveBalance();
  loadMyLeaveRequests();
  loadMyWorkReports();
  loadMyWeeklyReports();
  checkWeeklyReportStatus();
  setWeekRangeLabel();
  updateCheckoutBanner();

  // Set month picker and auto-load attendance history
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

function openMissedModal(mcData) {
  try {
    if (mcData) {
      document.getElementById("mcId").value = mcData.id;
      const fmtDate = new Date(mcData.date).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      document.getElementById("mcDateText").innerText = fmtDate;
    }

    const modalEl = document.getElementById('missedCheckoutModal');
    if (!modalEl) {
      console.error("missedCheckoutModal element not found!");
      return;
    }

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
    alert("⚠️ You have a pending missed checkout report. Please refresh the page and submit it.");
  }
}

window.openMissedModal = openMissedModal;

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

const LEAD_LIVE_REFRESH_MS = 15000;

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

function refreshLeadLiveData() {
  loadMyStatus();
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
    refreshLeadLiveData();
  }
}, LEAD_LIVE_REFRESH_MS);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshLeadLiveData();
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
      const truncate = (text) => {
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

  } catch (err) {
    console.error("Attendance history error:", err);
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Failed to load</td></tr>`;
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
