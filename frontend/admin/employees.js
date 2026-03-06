const API_BASE = "https://startup-management-system-backend.onrender.com";
const token = localStorage.getItem("token");

if (!token) {
  alert("Unauthorized");
  window.location.href = "../index.html";
}

const tableBody = document.getElementById("employeesTable");
let shiftsCache = [];
let allEmployees = [];

/* ================= LOAD SHIFTS ================= */
async function loadShifts() {
  const res = await fetch(`${API_BASE}/api/admin/shifts`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  shiftsCache = await res.json();
}

/* ================= LOAD EMPLOYEES ================= */
async function loadEmployees() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/team-members`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    allEmployees = await res.json();
    filterEmployees();

  } catch (err) {
    console.error(err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-danger text-center">Error loading employees</td>
      </tr>`;
  }
}

/* ================= FILTER EMPLOYEES ================= */
function filterEmployees() {
  const searchText = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
  const roleFilter = document.getElementById("roleFilter")?.value || "";

  let filtered = allEmployees;

  if (searchText) {
    filtered = filtered.filter(u =>
      u.name.toLowerCase().includes(searchText) ||
      (u.user_id && u.user_id.toLowerCase().includes(searchText))
    );
  }

  if (roleFilter) {
    filtered = filtered.filter(u => u.role === roleFilter);
  }

  renderEmployees(filtered);
}

/* ================= RENDER EMPLOYEES ================= */
function renderEmployees(users) {
  tableBody.innerHTML = "";

  if (users.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted">No employees found</td>
      </tr>`;
    return;
  }

  users.forEach(user => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${user.user_id}</td>
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>
        <span class="badge ${user.role === "TEAM_LEAD" ? "bg-primary" : "bg-secondary"}">
          ${user.role}
        </span>
      </td>
      <td>
        <span class="badge bg-${user.is_assigned ? "warning" : "success"}">
          ${user.is_assigned ? "Assigned" : "Free"}
        </span>
      </td>
      <td>
        ${renderShiftDropdown(user)}
      </td>
      <td>
        <button
          class="btn btn-sm btn-danger"
          ${user.is_assigned ? "disabled" : ""}
          onclick="deleteUser(${user.id}, '${user.role}')">
          Delete
        </button>
      </td>
    `;

    tableBody.appendChild(tr);
  });
}

/* ================= SHIFT DROPDOWN ================= */
function renderShiftDropdown(user) {
  if (shiftsCache.length === 0) {
    return `<span class="text-muted">Shifts disabled</span>`;
  }

  let options = `<option value="">No Shift</option>`;

  shiftsCache.forEach(s => {
    options += `
      <option value="${s.id}" ${s.id === user.shift_id ? "selected" : ""}>
        ${s.name} (${s.check_in_time} - ${s.check_out_time})
      </option>`;
  });

  return `
    <select class="form-select form-select-sm"
      onchange="assignShift(${user.id}, this.value)">
      ${options}
    </select>`;
}


/* ================= ASSIGN SHIFT ================= */
async function assignShift(userId, shiftId) {
  if (!shiftId) return;

  const res = await fetch(`${API_BASE}/api/admin/assign-shift`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ user_id: userId, shift_id: shiftId })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message || "Shift assignment failed");
    return;
  }

  alert("Shift assigned successfully");
}

/* ================= DELETE USER ================= */
async function deleteUser(userId, role) {
  if (!confirm("Are you sure?")) return;

  let url =
    role === "MEMBER"
      ? `${API_BASE}/api/admin/team-member/${userId}`
      : `${API_BASE}/api/admin/team-lead/${userId}`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message);
    return;
  }

  alert(data.message);
  loadEmployees();
}

/* ================= LOGOUT ================= */
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  window.location.href = "../index.html";
}

/* ================= INIT ================= */
(async function init() {
  await loadShifts();
  loadEmployees();
})();
