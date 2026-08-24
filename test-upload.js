require('dotenv').config();
const http = require('http');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const FormData = require('form-data');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

console.log('\n╔═══════════════════════════════════════════════╗');
console.log('║     UPLOAD FLOW TEST (WITH AUTH)            ║');
console.log('╚═══════════════════════════════════════════════╝\n');

// Generate JWT token
console.log('STEP 1: Generate Admin Token');
const token = jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET);
console.log(`✅ Token created\n`);

// Load file
console.log('STEP 2: Load Test Excel File');
const filePath = 'temp-excel2.xlsx';
if (!fs.existsSync(filePath)) {
  console.log(`❌ File not found: ${filePath}`);
  process.exit(1);
}
const fileBuffer = fs.readFileSync(filePath);
console.log(`✅ File loaded: ${fileBuffer.length} bytes\n`);

// Prepare form
console.log('STEP 3: Prepare Upload Request');
const form = new FormData();
form.append('file', fileBuffer, 'test.xlsx');

// Send request
console.log('STEP 4: Send Upload Request to /api/admin/upload-combined\n');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/upload-combined',
  method: 'POST',
  headers: {
    ...form.getHeaders(),
    'Cookie': `admin_token=${token}`
  }
};

const req = http.request(options, (res) => {
  console.log(`📨 Response Status: ${res.statusCode} ${res.statusMessage}`);
  console.log(`📋 Headers:`, Object.keys(res.headers).join(', '));

  let responseData = '';
  res.on('data', chunk => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log(`\n📄 Response Body (${responseData.length} bytes):`);
    console.log(responseData);

    try {
      const parsed = JSON.parse(responseData);

      console.log('\n' + '═'.repeat(45));
      if (res.statusCode === 200 && parsed.jobId) {
        console.log('✅ UPLOAD SUCCESSFUL!');
        console.log('═'.repeat(45));
        console.log(`\n📌 Job Details:`);
        console.log(`   Job ID: ${parsed.jobId}`);
        console.log(`   Status: ${parsed.status}`);
        console.log(`   Message: ${parsed.message}`);
        console.log(`\n✅ Test Result: PASS`);
      } else {
        console.log('❌ UPLOAD FAILED');
        console.log('═'.repeat(45));
        console.log(`\n❌ Test Result: FAIL`);
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Error: ${parsed.error}`);
      }
    } catch(e) {
      console.log('\n❌ Could not parse response as JSON');
      console.log(`   Error: ${e.message}`);
    }
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('\n❌ Request Error:', err.message);
  process.exit(1);
});

form.pipe(req);
console.log('📤 Request sent to server...\n');
