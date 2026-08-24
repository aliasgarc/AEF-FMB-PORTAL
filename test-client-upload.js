require('dotenv').config();
const http = require('http');
const https = require('https');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const FormData = require('form-data');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

console.log('\n╔═══════════════════════════════════════════════════╗');
console.log('║     CLIENT-SIDE UPLOAD TEST SIMULATION          ║');
console.log('╚═══════════════════════════════════════════════════╝\n');

async function testUpload() {
  try {
    // ========== STEP 1: Simulate Browser Login ==========
    console.log('STEP 1: Simulate Browser Login');
    console.log('─'.repeat(50));

    const token = jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET);
    console.log('✅ Generated JWT token');
    console.log(`   Token: ${token.substring(0, 30)}...`);
    console.log(`   Payload: id=1, username=admin\n`);

    // ========== STEP 2: Load Excel File ==========
    console.log('STEP 2: Load Excel File');
    console.log('─'.repeat(50));

    const filePath = 'temp-excel2.xlsx';
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}\n`);
      return;
    }

    const fileBuffer = fs.readFileSync(filePath);
    console.log(`✅ File loaded: ${filePath}`);
    console.log(`   Size: ${fileBuffer.length} bytes`);
    console.log(`   Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\n`);

    // ========== STEP 3: Prepare FormData ==========
    console.log('STEP 3: Prepare FormData (Multipart)');
    console.log('─'.repeat(50));

    const form = new FormData();
    form.append('file', fileBuffer, 'test.xlsx');

    const formHeaders = form.getHeaders();
    console.log('✅ FormData prepared');
    console.log(`   Content-Type: ${formHeaders['content-type']}`);
    console.log(`   Content-Length: ${form.getLengthSync()} bytes\n`);

    // ========== STEP 4: Prepare Request Headers ==========
    console.log('STEP 4: Prepare Request Headers');
    console.log('─'.repeat(50));

    const requestHeaders = {
      ...formHeaders,
      'Cookie': `admin_token=${token}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    console.log('✅ Request headers set');
    console.log(`   Cookie: admin_token=${token.substring(0, 20)}...`);
    console.log(`   Content-Type: ${requestHeaders['content-type']}`);
    console.log(`   Method: POST`);
    console.log(`   Path: /api/admin/upload-combined\n`);

    // ========== STEP 5: Send Upload Request ==========
    console.log('STEP 5: Send Upload Request');
    console.log('─'.repeat(50));
    console.log('📤 Sending to http://localhost:3000/api/admin/upload-combined\n');

    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/admin/upload-combined',
        method: 'POST',
        headers: requestHeaders,
        timeout: 30000
      };

      const req = http.request(options, (res) => {
        console.log('STEP 6: Receive Response');
        console.log('─'.repeat(50));
        console.log(`📨 Response Status: ${res.statusCode} ${res.statusMessage}`);
        console.log(`   Headers: ${Object.keys(res.headers).join(', ')}\n`);

        let responseData = '';
        let chunkCount = 0;

        res.on('data', (chunk) => {
          chunkCount++;
          responseData += chunk;
          console.log(`   📦 Chunk ${chunkCount}: ${chunk.length} bytes`);
        });

        res.on('end', () => {
          console.log(`\nSTEP 7: Parse Response`);
          console.log('─'.repeat(50));

          console.log(`✅ Response complete`);
          console.log(`   Total bytes: ${responseData.length}`);
          console.log(`   Total chunks: ${chunkCount}\n`);

          console.log(`📄 Response Body:`);
          console.log(`   ${responseData}\n`);

          try {
            const parsed = JSON.parse(responseData);

            if (res.statusCode === 200 && parsed.jobId) {
              console.log('\n' + '═'.repeat(50));
              console.log('✅ UPLOAD TEST SUCCESSFUL');
              console.log('═'.repeat(50));
              console.log('\n📌 Job Details:');
              console.log(`   Status Code: ${res.statusCode}`);
              console.log(`   Job ID: ${parsed.jobId}`);
              console.log(`   Status: ${parsed.status}`);
              console.log(`   Message: ${parsed.message}`);
              console.log(`\n🎯 Next: Job will process in background`);
              console.log(`   Check status at: /api/admin/upload-status/${parsed.jobId}`);
            } else {
              console.log('\n' + '═'.repeat(50));
              console.log('❌ UPLOAD TEST FAILED');
              console.log('═'.repeat(50));
              console.log(`\n   Status Code: ${res.statusCode}`);
              console.log(`   Error: ${parsed.error || 'Unknown error'}`);
            }

            console.log('\n' + '═'.repeat(50));
            console.log('DIAGNOSIS:');
            console.log('═'.repeat(50));
            console.log('\n📋 What This Test Did:');
            console.log('  ✓ Simulated browser login with JWT token');
            console.log('  ✓ Created FormData with multipart/form-data encoding');
            console.log('  ✓ Set auth cookie in request headers');
            console.log('  ✓ Sent POST request to /api/admin/upload-combined');
            console.log('  ✓ Received and parsed response\n');

            if (res.statusCode === 200 && parsed.jobId) {
              console.log('✅ TEST RESULT: SERVER IS WORKING');
              console.log('\n🔍 Browser Upload Issue Analysis:');
              console.log('  If browser still fails but this test succeeds:');
              console.log('  1. Browser cookies may not be set properly');
              console.log('  2. Browser fetch might not include credentials');
              console.log('  3. Check browser console for network errors');
              console.log('  4. Verify you are logged in (check Application tab)');
            } else {
              console.log('❌ TEST RESULT: SERVER ERROR');
              console.log(`\n   Server returned: ${res.statusCode} ${res.statusMessage}`);
              console.log(`   Error: ${parsed.error}`);
            }

            console.log('\n' + '═'.repeat(50) + '\n');
          } catch (e) {
            console.log('\n❌ ERROR: Could not parse response as JSON');
            console.log(`   Error: ${e.message}`);
            console.log(`   Response: ${responseData.substring(0, 100)}...`);
          }

          resolve();
        });
      });

      req.on('error', (err) => {
        console.log('\n' + '═'.repeat(50));
        console.log('❌ REQUEST ERROR');
        console.log('═'.repeat(50));
        console.log(`\n   Error: ${err.message}`);
        console.log(`   Code: ${err.code}`);

        if (err.code === 'ECONNREFUSED') {
          console.log('   Cause: Cannot connect to localhost:3000');
          console.log('   Fix: Make sure server is running (npm start)');
        }
        console.log('\n' + '═'.repeat(50) + '\n');
        resolve();
      });

      req.on('timeout', () => {
        console.log('\n❌ REQUEST TIMEOUT');
        console.log('   Request took too long to respond');
        req.destroy();
        resolve();
      });

      form.pipe(req);
    });

  } catch (err) {
    console.error('\n❌ FATAL ERROR:', err.message);
    console.error(err.stack);
  }
}

testUpload();
