console.log("✅ Member dashboard JS loaded");

const API_BASE = "http://localhost:5000/api";
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
  const res = await fetch(`${API_BASE}/attendance/my-status`, {
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

        const res = await fetch(`${API_BASE}/attendance/check-in`, {
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
  const res = await fetch(`${API_BASE}/attendance/check-out`, {
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
    const res = await fetch(`${API_BASE}/work/daily`, {
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
    const res = await fetch(`${API_BASE}/admin/member/roadmap`, {
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
  await fetch(`${API_BASE}/admin/roadmap-step`, {
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
    const res = await fetch(`${API_BASE}/attendance/apply-leave`, {
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
});