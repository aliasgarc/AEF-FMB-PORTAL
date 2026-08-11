const lookupForm = document.getElementById('lookupForm');
const lookupCard = document.getElementById('lookupCard');
const resultArea = document.getElementById('resultArea');
const lookupError = document.getElementById('lookupError');

function currency(n) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Helper function for fetch with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw error;
  }
}

function showError(message) {
  if (!lookupError) return;
  lookupError.textContent = message;
  lookupError.className = 'error';
  lookupError.style.display = 'block';
  lookupError.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideError() {
  lookupError.style.display = 'none';
  lookupError.textContent = '';
}

lookupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const uniqueNumber = document.getElementById('uniqueNumber').value.trim().toUpperCase();
  const submitBtn = lookupForm.querySelector('button');

  hideError();

  if (!uniqueNumber) {
    showError('❌ Please enter your ITS ID.');
    return;
  }

  submitBtn.disabled = true;
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="loading-spinner"></span> Checking...';

  try {
    const res = await fetchWithTimeout(`/api/user/${encodeURIComponent(uniqueNumber)}`);
    const data = await res.json();

    if (!res.ok) {
      showError('❌ ' + (data.error || 'Account not found. Please verify your ITS ID and try again.'));
      return;
    }

    renderResult(data);
  } catch (err) {
    showError('❌ ' + (err.message || 'Network error. Please check your connection and try again.'));
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
});

document.getElementById('searchAgainBtn').addEventListener('click', () => {
  resultArea.style.display = 'none';
  lookupCard.style.display = 'block';
  document.getElementById('uniqueNumber').value = '';
  hideError();
  document.getElementById('uniqueNumber').focus();
});

// Add Enter key support and auto-uppercase ITS ID
document.getElementById('uniqueNumber').addEventListener('keyup', (e) => {
  e.target.value = e.target.value.toUpperCase();
});

function renderResult(data) {
  if (!data || !data.user) {
    showError('❌ Invalid data received. Please try again.');
    return;
  }

  const { user, takhmeen = [], payments = [], summary = {} } = data;

  // Populate user info
  const resNameEl = document.getElementById('resName');
  if (!resNameEl) {
    showError('❌ Error loading page. Please refresh.');
    return;
  }
  resNameEl.textContent = user?.name || 'Unknown User';

  const metaParts = [];
  if (user.its_id) metaParts.push(`ITS ID: ${escapeHtml(user.its_id)}`);
  if (user.mobile) metaParts.push(`📱 ${escapeHtml(user.mobile)}`);
  if (user.city) metaParts.push(`📍 ${escapeHtml(user.city)}`);

  document.getElementById('resMeta').textContent = metaParts.join(' • ') || 'Account information';

  // Update statistics with Takhmeen and payment data
  // Show Takhmeen total, received and pending from payment receipts
  const totalBilled = summary.totalBilled || 0;
  const totalReceived = summary.totalReceived || 0;
  const totalPending = summary.totalPending || 0;

  // Populate stats with null checks
  const statTakhmeen = document.getElementById('statTakhmeen');
  const statReceived = document.getElementById('statReceived');
  const statPending = document.getElementById('statPending');

  if (statTakhmeen) statTakhmeen.textContent = currency(totalBilled);
  if (statReceived) statReceived.textContent = currency(totalReceived);
  if (statPending) statPending.textContent = currency(totalPending);

  // Hide skeleton and show actual stats
  const statsContainer = document.getElementById('statsContainer');
  const statsRow = document.getElementById('statsRow');
  if (statsContainer) statsContainer.style.display = 'none';
  if (statsRow) statsRow.style.display = 'grid';

  // Create progress bar for pending amounts
  const statPendingDiv = document.querySelector('.stat:nth-child(2)');
  if (statPendingDiv) {
    const totalContribution = totalReceived + totalPending;
    const percentReceived = totalContribution > 0 ? Math.round((totalReceived / totalContribution) * 100) : 0;

    const progressBar = document.createElement('div');
    progressBar.style.marginTop = '12px';
    progressBar.style.height = '6px';
    progressBar.style.background = 'rgba(59,130,246,0.1)';
    progressBar.style.borderRadius = '3px';
    progressBar.style.overflow = 'hidden';

    const progressFill = document.createElement('div');
    progressFill.style.height = '100%';
    progressFill.style.width = percentReceived + '%';
    progressFill.style.background = 'linear-gradient(90deg, var(--green), var(--cyan))';
    progressFill.style.borderRadius = '3px';
    progressFill.style.transition = 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';

    progressBar.appendChild(progressFill);

    const oldBar = statPendingDiv.querySelector('[data-progress]');
    if (oldBar) oldBar.remove();

    progressBar.setAttribute('data-progress', 'true');
    statPendingDiv.appendChild(progressBar);

    // Add percentage label
    const percentLabel = document.createElement('p');
    percentLabel.style.margin = '8px 0 0 0';
    percentLabel.style.fontSize = '12px';
    percentLabel.style.color = '#64748b';
    percentLabel.textContent = `${percentReceived}% collected`;
    statPendingDiv.appendChild(percentLabel);
  }

  // Populate payment receipts table
  const receiptsBody = document.getElementById('receiptsBody');
  const emptyReceipts = document.getElementById('emptyReceipts');

  // Safety check: only proceed if elements exist
  if (receiptsBody && emptyReceipts) {
    receiptsBody.innerHTML = '';

    if (!payments || payments.length === 0) {
      emptyReceipts.style.display = 'block';
    } else {
      emptyReceipts.style.display = 'none';
      payments.forEach((p, index) => {
        const tr = document.createElement('tr');
        const receiptDate = p.received_date ? new Date(p.received_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';

        tr.style.animation = `slideUp 0.4s ease-out ${index * 0.05}s backwards`;
        tr.innerHTML = `
          <td><strong>${escapeHtml(p.receipt_no || '-')}</strong></td>
          <td>${receiptDate}</td>
          <td style="text-align: right; color: var(--green); font-weight: 600;">₹${currency(p.amt_rcv || 0)}</td>
          <td>${escapeHtml(p.payment_mode || '-')}</td>
          <td style="text-align: right; color: var(--amber); font-weight: 600;">₹${currency(p.amt_pending || 0)}</td>
          <td>${escapeHtml(p.payment_refrence || '-')}</td>
        `;
        receiptsBody.appendChild(tr);
      });
    }
  }

  // Show results with smooth animation
  lookupCard.style.display = 'none';
  resultArea.style.display = 'block';
  resultArea.style.animation = 'slideUp 0.5s ease-out';
  resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getStatusIcon(status) {
  const icons = {
    'paid': '✅',
    'partial': '⚠️',
    'pending': '⏳'
  };
  return icons[status] || '❓';
}
