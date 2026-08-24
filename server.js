require('dotenv').config();
const app = require('./src/app');
const { startWorker } = require('./src/jobs/uploadQueue');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Payment tracker running at http://localhost:${PORT}`);
  console.log(`  Admin portal: http://localhost:${PORT}/admin`);
  console.log(`  User portal:  http://localhost:${PORT}/user`);

  // Start background job worker
  console.log(`\n📋 Starting background upload worker...`);
  startWorker(1000); // Check for new jobs every 1 second
  console.log(`✅ Background worker started\n`);
});
