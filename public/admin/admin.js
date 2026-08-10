// ---------- Login page ----------
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  // Password toggle
  const passwordToggle = document.getElementById('passwordToggle');
  const passwordInput = document.getElementById('password');
  if (passwordToggle) {
    passwordToggle.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      passwordToggle.textContent = type === 'password' ? '👁️' : '🙈';
    });
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');
    const submitBtn = document.getElementById('submitBtn');

    errorMsg.style.display = 'none';

    if (!username || !password) {
      errorMsg.textContent = '❌ Please enter both username and password';
      errorMsg.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="loading-spinner"></span>Signing in...';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        errorMsg.textContent = '❌ ' + (data.error || 'Login failed.');
        errorMsg.style.display = 'block';
        return;
      }
      window.location.href = '/admin/dashboard.html';
    } catch (err) {
      errorMsg.textContent = '❌ Network error. Please try again.';
      errorMsg.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

// ---------- Dashboard page ----------
const usersBody = document.getElementById('usersBody');
if (usersBody) {
  init();
}

async function init() {
  const meRes = await fetch('/api/admin/me');
  if (!meRes.ok) {
    window.location.href = '/admin/login.html';
    return;
  }
  const me = await meRes.json();
  document.getElementById('whoami').textContent = me.admin.username;

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login.html';
  });

  document.getElementById('uploadForm').addEventListener('submit', handleUpload);

  const paymentForm = document.getElementById('uploadPaymentForm');
  if (paymentForm) {
    paymentForm.addEventListener('submit', handlePaymentUpload);
  }

  document.getElementById('closeDetail').addEventListener('click', () => {
    document.getElementById('detailPanel').style.display = 'none';
  });

  await loadUsers();
}

function currency(n) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadUsers() {
  // Fetch both user list and stats
  const usersRes = await fetch('/api/admin/users');
  const statsRes = await fetch('/api/admin/stats');

  if (!usersRes.ok || !statsRes.ok) return;

  const usersData = await usersRes.json();
  const statsData = await statsRes.json();

  const users = usersData.users;
  const stats = statsData;

  // Calculate totals from billing data
  const totalOutstanding = users.reduce((s, u) => s + Number(u.outstanding), 0);
  const totalBilled = stats.users.totalBilled;
  const totalPaid = stats.users.totalPaid;

  // Get payment receipt data
  const totalReceived = stats.receipts.totalReceived;
  const totalPending = stats.receipts.totalPending;

  document.getElementById('statsRow').innerHTML = `
    <div class="stat">
      <div class="stat-icon">👥</div>
      <div class="label">Total Users</div>
      <div class="value">${stats.users.totalUsers}</div>
      <div class="change">Active accounts</div>
    </div>
    <div class="stat">
      <div class="stat-icon">💰</div>
      <div class="label">Total Billed</div>
      <div class="value success">₹${currency(totalBilled)}</div>
      <div class="change">Invoice amount</div>
    </div>
    <div class="stat">
      <div class="stat-icon">✅</div>
      <div class="label">Amount Received</div>
      <div class="value success">₹${currency(totalReceived)}</div>
      <div class="change" style="color: var(--green);">+${totalBilled > 0 ? Math.round((totalReceived/totalBilled)*100) : 0}% collected</div>
    </div>
    <div class="stat">
      <div class="stat-icon">⚠️</div>
      <div class="label">Pending Amount</div>
      <div class="value outstanding">₹${currency(totalPending)}</div>
      <div class="change negative">Still to receive</div>
    </div>
  `;

  const tbody = document.getElementById('usersBody');
  tbody.innerHTML = '';
  document.getElementById('emptyState').style.display = users.length === 0 ? 'block' : 'none';
  document.getElementById('userCount').innerHTML = `<strong>${users.length}</strong> total users • Last updated: just now`;

  users.forEach((u, index) => {
    const tr = document.createElement('tr');
    const itsId = escapeHtml(u.its_id || u.sabil_no || '-');
    const name = escapeHtml(u.name || '-');
    const mobile = escapeHtml(u.mobile || '-');
    const sector = escapeHtml(u.sector || '-');
    const billed = currency(u.total_billed || 0);
    const received = currency(u.amount_received || 0);
    const pending = currency(u.amount_pending || 0);
    const outstanding = currency(u.outstanding || 0);
    const outstandingColor = Number(u.outstanding) > 0 ? '#ef4444' : '#22c55e';

    tr.style.animation = `slideIn 0.3s ease-out ${index * 0.02}s`;
    tr.innerHTML = `
      <td><strong>${itsId}</strong></td>
      <td><strong>${name}</strong></td>
      <td>${mobile}</td>
      <td>${sector}</td>
      <td style="text-align: right; font-weight: 600;">₹${billed}</td>
      <td style="text-align: right; color: #22c55e; font-weight: 600;">₹${received}</td>
      <td style="text-align: right; color: #f59e0b; font-weight: 600;">₹${pending}</td>
      <td style="text-align: right; color: ${outstandingColor}; font-weight: 700;">₹${outstanding}</td>
      <td style="text-align: center;"><button class="secondary small viewBtn" data-id="${u.id}">View</button></td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.viewBtn').forEach((btn) => {
    btn.addEventListener('click', () => showDetail(btn.dataset.id));
  });
}

async function showDetail(id) {
  const res = await fetch(`/api/admin/users/${id}`);
  if (!res.ok) return;
  const data = await res.json();

  document.getElementById('detailName').textContent = data.user.name;
  document.getElementById('detailMeta').textContent =
    `${data.user.its_id || data.user.sabil_no || 'N/A'} · ${data.user.mobile || 'no mobile'} · ${data.user.city || 'no city'} · Outstanding: ${currency(data.summary.outstanding)}`;

  const tbody = document.getElementById('detailBody');
  tbody.innerHTML = '';
  data.history.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.period_label || '-')}</td>
      <td>${currency(r.amount_billed)}</td>
      <td>${currency(r.amount_paid)}</td>
      <td>${r.due_date ? new Date(r.due_date).toLocaleDateString() : '-'}</td>
      <td><span class="badge ${r.status}">${escapeHtml(r.status)}</span></td>
      <td>${escapeHtml(r.notes || '-')}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('detailPanel').style.display = 'block';
  document.getElementById('detailPanel').scrollIntoView({ behavior: 'smooth' });
}

async function handleUpload(e) {
  e.preventDefault();
  const resultEl = document.getElementById('uploadResult');
  const submitBtn = document.getElementById('uploadForm').querySelector('button');

  // Check for stored dropped files or regular file input
  const files = droppedFiles['fileInput'] || document.getElementById('fileInput')?.files;

  if (!files || !files.length) {
    resultEl.textContent = '❌ Choose a file first.';
    resultEl.className = 'upload-result error';
    resultEl.style.display = 'block';
    return;
  }

  const formData = new FormData();
  formData.append('file', files[0]);

  resultEl.textContent = '⏳ Uploading...';
  resultEl.className = 'upload-result';
  resultEl.style.display = 'block';
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      resultEl.textContent = '❌ ' + (data.error || 'Upload failed.');
      resultEl.className = 'upload-result error';
      return;
    }

    const warnings = data.warnings && data.warnings.length ? ` (⚠️ ${data.warnings.length} rows skipped)` : '';
    resultEl.innerHTML = `✅ Success: ${data.usersUpserted} users updated, ${data.paymentsInserted} payment records added${warnings}`;
    resultEl.className = 'upload-result success';

    // Clear the stored files and reset the input
    droppedFiles['fileInput'] = null;
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';

    setTimeout(() => loadUsers(), 500);
  } catch (err) {
    resultEl.textContent = '❌ Network error during upload.';
    resultEl.className = 'upload-result error';
  } finally {
    submitBtn.disabled = false;
  }
}

async function handlePaymentUpload(e) {
  e.preventDefault();
  const resultEl = document.getElementById('paymentUploadResult');
  const submitBtn = e.target.querySelector('button');

  // Check for stored dropped files or regular file input
  const files = droppedFiles['paymentFileInput'] || document.getElementById('paymentFileInput')?.files;

  if (!files || !files.length) {
    resultEl.textContent = '❌ Choose a file first.';
    resultEl.className = 'upload-result error';
    resultEl.style.display = 'block';
    return;
  }

  const formData = new FormData();
  formData.append('file', files[0]);

  resultEl.textContent = '⏳ Uploading payments...';
  resultEl.className = 'upload-result';
  resultEl.style.display = 'block';
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/admin/upload-payments', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      resultEl.textContent = '❌ ' + (data.error || 'Upload failed.');
      resultEl.className = 'upload-result error';
      return;
    }

    // Build result message
    let resultMessage = `✅ Success: ${data.paymentsInserted} payment records added<br>💰 Total Received: ₹${data.summary.totalReceived}`;

    // Add duplicate info if any
    if (data.paymentsDuplicate > 0) {
      resultMessage += `<br>⚠️ ${data.paymentsDuplicate} duplicate receipts skipped`;
    }

    resultEl.innerHTML = resultMessage;
    resultEl.className = 'upload-result success';

    // Clear the stored files and reset the input
    droppedFiles['paymentFileInput'] = null;
    const fileInput = document.getElementById('paymentFileInput');
    if (fileInput) fileInput.value = '';
  } catch (err) {
    resultEl.textContent = '❌ Network error during upload.';
    resultEl.className = 'upload-result error';
  } finally {
    submitBtn.disabled = false;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- Drag & Drop functionality ----------
// Store files globally for each drop zone
const droppedFiles = {};

function setupDragDrop(dropZoneId, fileInputId) {
  const dropZone = document.getElementById(dropZoneId);
  const fileInput = document.getElementById(fileInputId);

  if (!dropZone || !fileInput) return;

  // Initialize storage for this drop zone
  droppedFiles[fileInputId] = null;

  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      // Store the dropped files
      droppedFiles[fileInputId] = files;
      updateDropZoneDisplay(dropZone, files[0].name);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      // Store the selected files
      droppedFiles[fileInputId] = fileInput.files;
      updateDropZoneDisplay(dropZone, fileInput.files[0].name);
    }
  });

  function updateDropZoneDisplay(zone, fileName) {
    zone.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 32px; margin-bottom: 12px;">✅</div>
        <p style="margin: 0; font-weight: 600; color: var(--green);">File selected</p>
        <p style="margin: 0; color: var(--text-lighter); font-size: 13px;">${fileName}</p>
      </div>
    `;
  }
}

// Initialize drag-drop when page loads
if (document.getElementById('dropZone')) {
  setupDragDrop('dropZone', 'fileInput');
  setupDragDrop('paymentDropZone', 'paymentFileInput');
}
