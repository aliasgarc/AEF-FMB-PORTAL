// Enhanced Upload Experience - All UI Improvements
class UploadExperience {
  constructor() {
    this.currentJobId = null;
    this.uploadStartTime = null;
    this.statusCheckInterval = null;
    this.uploadHistory = this.loadUploadHistory();
  }

  // Initialize upload handlers
  init() {
    const form = document.getElementById('uploadCombinedForm');
    const dropZone = document.getElementById('combinedDropZone');
    const fileInput = document.getElementById('combinedFileInput');

    if (!form) return;

    // Drag & drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) this.handleFileSelect(files[0]);
    });

    // Click to browse
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) this.handleFileSelect(e.target.files[0]);
    });

    // Form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (fileInput.files.length > 0) this.uploadFile(fileInput.files[0]);
    });
  }

  // Handle file selection with validation
  handleFileSelect(file) {
    // Validate file type
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
    if (!validTypes.includes(file.type)) {
      this.showError('❌ Invalid file type. Please upload Excel (.xlsx, .xls) or CSV file.');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showError(`❌ File too large. Maximum size is 5MB (your file: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      return;
    }

    // Show preview modal
    this.showFilePreview(file);
  }

  // Show file preview before upload
  showFilePreview(file) {
    const modal = document.createElement('div');
    modal.id = 'filePreviewModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 32px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out;">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; font-weight: 700; color: #0f172a;">📋 File Preview</h3>

        <div style="background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">📁 File Name</p>
          <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #0f172a; word-break: break-all;">${file.name}</p>

          <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">📊 File Size</p>
          <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${(file.size / 1024).toFixed(2)} KB</p>

          <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600;">📅 Last Modified</p>
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0f172a;">${new Date(file.lastModified).toLocaleString()}</p>
        </div>

        <div style="background: #e8f3eb; border: 1.5px solid #86efac; border-radius: 8px; padding: 12px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 13px; color: #16a34a;">✅ File validation passed. Ready to upload!</p>
        </div>

        <div style="display: flex; gap: 12px;">
          <button id="cancelPreview" style="flex: 1; padding: 12px; background: #f1f5f9; color: #3c7441; border: 1.5px solid #e2e8f0; border-radius: 8px; font-weight: 600; cursor: pointer;">Cancel</button>
          <button id="proceedUpload" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #3c7441 0%, #5a9b62 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Proceed with Upload</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('cancelPreview').addEventListener('click', () => {
      modal.remove();
      document.getElementById('combinedFileInput').value = '';
    });

    document.getElementById('proceedUpload').addEventListener('click', () => {
      modal.remove();
      this.uploadFile(file);
    });
  }

  // Upload file with progress tracking
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Show progress modal
      this.showProgressModal();
      this.uploadStartTime = Date.now();

      console.log('📤 Uploading file to /api/admin/upload-combined:', file.name, file.size);

      const response = await fetch('/api/admin/upload-combined', {
        method: 'POST',
        body: formData
      });

      console.log('📥 Upload response status:', response.status, response.statusText);
      console.log('📥 Content-Type:', response.headers.get('content-type'));

      if (!response.ok) {
        const text = await response.text();
        console.error('❌ Upload error response:', text);
        throw new Error(`Upload failed with status ${response.status}: ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      console.log('✅ Upload response data:', data);

      if (!data.jobId) {
        throw new Error('No jobId returned from server');
      }

      this.currentJobId = data.jobId;
      console.log('🔄 Starting progress tracking for job:', this.currentJobId);
      this.startProgressTracking();

    } catch (error) {
      console.error('❌ Upload error:', error);
      this.showError('❌ Upload failed: ' + error.message);
    }
  }

  // Show progress modal
  showProgressModal() {
    const modal = document.createElement('div');
    modal.id = 'uploadProgressModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1001;
    `;

    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 32px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; margin-bottom: 12px; animation: spin 2s linear infinite;">⚙️</div>
          <h3 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #0f172a;">Upload in Progress</h3>
          <p style="margin: 0; font-size: 14px; color: #64748b;">Processing your file...</p>
        </div>

        <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="font-size: 13px; font-weight: 600; color: #0f172a;">Progress</span>
            <span id="progressPercentage" style="font-size: 13px; font-weight: 600; color: #3c7441;">0%</span>
          </div>
          <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
            <div id="progressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #3c7441, #5a9b62); transition: width 0.3s ease; border-radius: 4px;"></div>
          </div>
        </div>

        <div id="uploadStats" style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 24px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b;">Elapsed Time:</span>
            <span id="elapsedTime" style="font-weight: 600; color: #0f172a;">00:00</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #64748b;">Est. Time Left:</span>
            <span id="timeRemaining" style="font-weight: 600; color: #0f172a;">--:--</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Processing Speed:</span>
            <span id="processingSpeed" style="font-weight: 600; color: #0f172a;">-- rows/sec</span>
          </div>
        </div>

        <div id="recordsProgress" style="background: #f0faf5; border: 1px solid #86efac; padding: 12px; border-radius: 8px; font-size: 12px; margin-bottom: 24px; display: none;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #16a34a;">✅ Processing Progress:</p>
          <div id="recordsDetail" style="margin: 0; color: #16a34a;"></div>
        </div>

        <div style="display: flex; gap: 12px;">
          <button id="runBackground" style="flex: 1; padding: 12px; background: #f1f5f9; color: #3c7441; border: 1.5px solid #e2e8f0; border-radius: 8px; font-weight: 600; cursor: pointer;">Run in Background</button>
          <button id="cancelUpload" style="flex: 1; padding: 12px; background: #fee2e2; color: #dc2626; border: 1.5px solid #fca5a5; border-radius: 8px; font-weight: 600; cursor: pointer;">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('runBackground').addEventListener('click', () => {
      modal.style.display = 'none';
      this.showNotification('✅ Upload running in background. You can continue working.');
    });

    document.getElementById('cancelUpload').addEventListener('click', () => {
      clearInterval(this.statusCheckInterval);
      modal.remove();
      this.currentJobId = null;
    });
  }

  // Track upload progress
  startProgressTracking() {
    let failedChecks = 0;
    this.statusCheckInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/upload-status/${this.currentJobId}`);

        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error(`Invalid response type: expected JSON, got ${contentType}`);
        }

        const data = await response.json();
        failedChecks = 0; // Reset on success

        const progressBar = document.getElementById('progressBar');
        const progressPercentage = document.getElementById('progressPercentage');
        const elapsedTime = document.getElementById('elapsedTime');
        const timeRemaining = document.getElementById('timeRemaining');
        const processingSpeed = document.getElementById('processingSpeed');

        if (progressBar && progressPercentage) {
          progressBar.style.width = data.progress + '%';
          progressPercentage.textContent = data.progress + '%';

          // Calculate elapsed time
          const elapsed = Math.floor((Date.now() - this.uploadStartTime) / 1000);
          elapsedTime.textContent = this.formatSeconds(elapsed);

          // Calculate speed and remaining time
          if (data.summary && data.progress > 15) {
            const recordsProcessed = data.summary.recordsProcessed || 0;
            const speed = recordsProcessed / (elapsed || 1);
            processingSpeed.textContent = speed.toFixed(1) + ' rows/sec';

            if (speed > 0 && data.progress < 100) {
              const recordsRemaining = (recordsProcessed / ((data.progress - 15) / 70)) - recordsProcessed;
              const timeLeft = Math.ceil(recordsRemaining / speed);
              timeRemaining.textContent = this.formatSeconds(timeLeft);
            }
          }
        }

        // Show records progress
        if (data.summary) {
          const recordsDetail = document.getElementById('recordsDetail');
          if (recordsDetail) {
            recordsDetail.innerHTML = `
              ✓ ITS Records: ${data.summary.itsUpserted || 0}<br>
              ✓ Takhmeen: ${data.summary.takhmeenUpserted || 0}<br>
              ✓ Payments: ${data.summary.paymentUpserted || 0}
            `;
            document.getElementById('recordsProgress').style.display = 'block';
          }
        }

        // Check if completed
        if (data.progress === 100 && data.status === 'completed') {
          clearInterval(this.statusCheckInterval);
          this.showSuccessPage(data);
        }
      } catch (error) {
        console.error('Status check error:', error);
        failedChecks++;

        // If 10 consecutive checks fail (10 seconds), show error
        if (failedChecks >= 10) {
          clearInterval(this.statusCheckInterval);
          const progressModal = document.getElementById('uploadProgressModal');
          if (progressModal) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
              background: #fee2e2;
              color: #dc2626;
              padding: 16px;
              border-radius: 8px;
              border: 1.5px solid #fca5a5;
              margin-top: 16px;
              font-size: 13px;
            `;
            errorDiv.innerHTML = `
              <strong>❌ Error:</strong> Unable to track upload progress. ${error.message}
              <br><br>
              <small>Check the browser console (F12) and server logs for details.</small>
            `;
            progressModal.appendChild(errorDiv);
          }
        }
      }
    }, 1000);
  }

  // Show success page
  showSuccessPage(data) {
    const progressModal = document.getElementById('uploadProgressModal');
    if (progressModal) progressModal.remove();

    const modal = document.createElement('div');
    modal.id = 'uploadSuccessModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1001;
    `;

    const summary = data.summary || {};
    const totalSeconds = Math.floor((Date.now() - this.uploadStartTime) / 1000);

    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 40px; max-width: 600px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="font-size: 64px; margin-bottom: 16px; animation: bounce 0.6s ease-out;">✅</div>
          <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #16a34a;">Upload Completed Successfully!</h2>
          <p style="margin: 0; font-size: 14px; color: #64748b;">Your file has been processed and all records have been synced.</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
          <div style="background: #f0faf5; border: 1.5px solid #86efac; padding: 16px; border-radius: 12px; text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: #16a34a; margin-bottom: 4px;">${summary.recordsProcessed || 0}</div>
            <div style="font-size: 12px; color: #16a34a; font-weight: 600; text-transform: uppercase;">Total Records</div>
          </div>
          <div style="background: #e8f3eb; border: 1.5px solid #86efac; padding: 16px; border-radius: 12px; text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: #16a34a; margin-bottom: 4px;">${this.formatSeconds(totalSeconds)}</div>
            <div style="font-size: 12px; color: #16a34a; font-weight: 600; text-transform: uppercase;">Processing Time</div>
          </div>
        </div>

        <div style="background: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 32px;">
          <h4 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; color: #0f172a;">📊 Processing Summary</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b;">✓ ITS Records Updated</span>
              <span style="font-weight: 700; color: #3c7441;">${summary.itsUpserted || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b;">✓ Takhmeen Records</span>
              <span style="font-weight: 700; color: #3c7441;">${summary.takhmeenUpserted || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
              <span style="color: #64748b;">✓ Payment Records</span>
              <span style="font-weight: 700; color: #3c7441;">${summary.paymentUpserted || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">⚠️ Warnings/Errors</span>
              <span style="font-weight: 700; color: ${summary.warnings && summary.warnings.length > 0 ? '#dc2626' : '#16a34a'};'">${summary.warnings ? summary.warnings.length : 0}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 12px;">
          <button id="backToDashboard" style="flex: 1; padding: 14px; background: linear-gradient(135deg, #3c7441 0%, #5a9b62 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px;">📊 Back to Dashboard</button>
          <button id="uploadAnother" style="flex: 1; padding: 14px; background: #f1f5f9; color: #3c7441; border: 1.5px solid #e2e8f0; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px;">📤 Upload Another File</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Save to history
    this.saveToUploadHistory({
      timestamp: new Date(),
      fileName: 'Upload',
      records: summary.recordsProcessed || 0,
      status: 'success',
      duration: totalSeconds
    });

    document.getElementById('backToDashboard').addEventListener('click', () => {
      modal.remove();
      document.querySelector('[data-tab="users"]').click();
      location.reload();
    });

    document.getElementById('uploadAnother').addEventListener('click', () => {
      modal.remove();
      document.getElementById('combinedFileInput').value = '';
    });
  }

  // Show error message
  showError(message) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fee2e2;
      color: #dc2626;
      padding: 16px 24px;
      border-radius: 8px;
      border: 1.5px solid #fca5a5;
      font-weight: 600;
      z-index: 2000;
      animation: slideIn 0.3s ease-out;
      max-width: 400px;
    `;
    modal.textContent = message;
    document.body.appendChild(modal);

    setTimeout(() => {
      modal.style.animation = 'slideOut 0.3s ease-out forwards';
      setTimeout(() => modal.remove(), 300);
    }, 4000);
  }

  // Show notification
  showNotification(message) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dcfce7;
      color: #16a34a;
      padding: 16px 24px;
      border-radius: 8px;
      border: 1.5px solid #86efac;
      font-weight: 600;
      z-index: 2000;
      animation: slideIn 0.3s ease-out;
      max-width: 400px;
    `;
    modal.textContent = message;
    document.body.appendChild(modal);

    setTimeout(() => {
      modal.style.animation = 'slideOut 0.3s ease-out forwards';
      setTimeout(() => modal.remove(), 300);
    }, 3000);
  }

  // Format seconds to MM:SS
  formatSeconds(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Upload history management
  loadUploadHistory() {
    return JSON.parse(localStorage.getItem('uploadHistory') || '[]');
  }

  saveToUploadHistory(record) {
    this.uploadHistory.unshift(record);
    this.uploadHistory = this.uploadHistory.slice(0, 10); // Keep last 10
    localStorage.setItem('uploadHistory', JSON.stringify(this.uploadHistory));
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const uploader = new UploadExperience();
  uploader.init();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(400px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideOut {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(400px); }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
`;
document.head.appendChild(style);
