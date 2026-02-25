const API_BASE = "https://startup-management-system-backend.onrender.com";

const token = localStorage.getItem("token");

const table = document.getElementById("projectsTable");

async function loadProjects() {
  const res = await fetch(`${API_BASE}/api/admin/projects`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const projects = await res.json();
  table.innerHTML = "";

  if (projects.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted">No projects</td>
      </tr>`;
    return;
  }

  projects.forEach(p => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.project_name}</td>
      <td>${p.team_lead_name || "-"}</td>
      <td>${p.member_count}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="viewMembers(${p.id})">
          View
        </button>
        <button class="btn btn-sm btn-danger ms-2" onclick="deleteProject(${p.id})">
          Delete
        </button>
      </td>
    `;

    table.appendChild(tr);
  });
}

async function viewMembers(projectId) {
  window.location.href = `project-members.html?projectId=${projectId}`;
}

async function deleteProject(projectId) {
  if (!confirm("Delete this project?")) return;

  const res = await fetch(`${API_BASE}/api/admin/projects/${projectId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message);
    return;
  }

  alert("Project deleted");
  loadProjects();
}

loadProjects();
