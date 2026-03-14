const state = {
  authenticated: false,
  loading: false
};

const loginCard = document.getElementById("login-card");
const dashboardContent = document.getElementById("dashboard-content");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const logoutButton = document.getElementById("logout-button");
const refreshButton = document.getElementById("refresh-button");

function formatCount(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function setLoading(nextValue) {
  state.loading = Boolean(nextValue);
  const disabled = state.loading;
  const submitButton = loginForm.querySelector("button[type='submit']");
  submitButton.disabled = disabled;
  refreshButton.disabled = disabled;
  logoutButton.disabled = disabled;
}

function showAuthenticatedView(authenticated) {
  state.authenticated = Boolean(authenticated);
  loginCard.classList.toggle("hidden", state.authenticated);
  dashboardContent.classList.toggle("hidden", !state.authenticated);
  logoutButton.classList.toggle("hidden", !state.authenticated);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload;
}

function renderTopSharers(rows) {
  const body = document.getElementById("top-sharers-body");
  if (!Array.isArray(rows) || !rows.length) {
    body.innerHTML = `<tr><td colspan="4" class="empty-cell">No tracked sharers yet.</td></tr>`;
    return;
  }

  body.innerHTML = rows.map((row) => `
    <tr>
      <td><strong>${row.userId}</strong></td>
      <td>${formatCount(row.uniqueVisitors)}</td>
      <td>
        <span class="status-pill ${row.unlocked ? "is-unlocked" : "is-locked"}">
          ${row.unlocked ? "Unlocked" : "Waiting"}
        </span>
      </td>
      <td>${formatDate(row.lastVisitAt)}</td>
    </tr>
  `).join("");
}

function renderRecentReferrals(rows) {
  const body = document.getElementById("recent-referrals-body");
  if (!Array.isArray(rows) || !rows.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-cell">No referral accesses yet.</td></tr>`;
    return;
  }

  body.innerHTML = rows.map((row) => `
    <tr>
      <td><strong>${row.referrerUserId}</strong></td>
      <td>${row.visitorUserId}</td>
      <td>${row.landingPath || "/"}</td>
      <td>${formatCount(row.visitCount)}</td>
      <td>${row.lastIpAddress || "—"}</td>
      <td>${formatDate(row.lastSeenAt)}</td>
    </tr>
  `).join("");
}

function renderOverview(payload) {
  document.getElementById("stat-users").textContent = formatCount(payload?.totals?.totalUsers);
  document.getElementById("stat-referrals").textContent = formatCount(payload?.totals?.totalReferrals);
  document.getElementById("stat-unlocked").textContent = formatCount(payload?.totals?.unlockedUsers);
  document.getElementById("stat-rule").textContent = `${formatCount(payload?.totals?.unlockThreshold)} opens`;
  renderTopSharers(payload?.topSharers || []);
  renderRecentReferrals(payload?.recentReferrals || []);
}

async function loadOverview() {
  setLoading(true);
  try {
    const payload = await requestJson("/api/share/admin/overview");
    showAuthenticatedView(true);
    renderOverview(payload);
  } catch (error) {
    if (String(error.message || "").toLowerCase().includes("authentication")) {
      showAuthenticatedView(false);
      return;
    }
    loginStatus.textContent = error.message;
  } finally {
    setLoading(false);
  }
}

async function checkSession() {
  setLoading(true);
  try {
    const payload = await requestJson("/api/share/admin/session", {
      headers: {}
    });
    showAuthenticatedView(payload.authenticated);
    if (payload.authenticated) {
      await loadOverview();
    }
  } catch (error) {
    showAuthenticatedView(false);
    loginStatus.textContent = error.message;
  } finally {
    setLoading(false);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "";
  const formData = new FormData(loginForm);
  setLoading(true);

  try {
    await requestJson("/api/share/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: String(formData.get("username") || "").trim(),
        password: String(formData.get("password") || "")
      })
    });
    loginForm.reset();
    await loadOverview();
  } catch (error) {
    showAuthenticatedView(false);
    loginStatus.textContent = error.message;
  } finally {
    setLoading(false);
  }
});

logoutButton.addEventListener("click", async () => {
  setLoading(true);
  try {
    await requestJson("/api/share/admin/logout", {
      method: "POST"
    });
    showAuthenticatedView(false);
    loginStatus.textContent = "";
  } catch (error) {
    loginStatus.textContent = error.message;
  } finally {
    setLoading(false);
  }
});

refreshButton.addEventListener("click", () => {
  void loadOverview();
});

void checkSession();
