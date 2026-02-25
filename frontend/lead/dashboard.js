const API_BASE = "https://startup-management-system-backend.onrender.com";;
const token = localStorage.getItem("token");
if (!token) {
  alert("Please login again");
  window.location.href = "../login.html";
}

console.log("🔥 loadProjects() called");

/* ================= DOM ================= */
const projectsList = document.getElementById("projectsList");
const roadmapSection = document.getElementById("roadmapSection");
const roadmapSteps = document.getElementById("roadmapSteps");
const progressBar = document.getElementById("progressBar");

const statusText = document.getElementById("statusText");
const checkInBtn = document.getElementById("checkInBtn");
const checkOutBtn = document.getElementById("checkOutBtn");
const messageDiv = document.getElementById("message");

/* ================= LOAD PROJECTS ================= */

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

    if (members.length === 0) {
      container.innerHTML =
        `<div class="text-muted">No members found</div>`;
      return;
    }

    members.forEach(m => {
      const div = document.createElement("div");
      div.className = "form-check";

      div.innerHTML = `
        <input
          class="form-check-input"
          type="checkbox"
          value="${m.id}"
          id="member_${m.id}"
        >
        <label class="form-check-label" for="member_${m.id}">
          ${m.name} (${m.user_id})
        </label>
      `;

      container.appendChild(div);
    });

  } catch (err) {
    console.error("loadMembers error:", err);
    alert("Failed to load members");
  }
}


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
  window.location.href = "../login.html";
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
});
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
