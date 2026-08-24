require('dotenv').config();
const http = require('http');
const db = require('./src/db');

console.log('\n╔═══════════════════════════════════════════════════╗');
console.log('║     LOGIN ISSUE COMPREHENSIVE DIAGNOSTICS      ║');
console.log('╚═══════════════════════════════════════════════════╝\n');

(async () => {
  try {
    // TEST 1: Database verification
    console.log('TEST 1: Database - Admin User');
    console.log('─'.repeat(50));
    const adminCheck = await db.query('SELECT id, username FROM admins WHERE username = $1', ['admin']);
    if (adminCheck.rows.length === 0) {
      console.log('❌ ADMIN USER NOT FOUND');
      console.log('   Creating admin user...');
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('admin123', 10);
      await db.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', ['admin', hash]);
      console.log('✅ Admin user created\n');
    } else {
      console.log('✅ Admin user exists');
      console.log(`   ID: ${adminCheck.rows[0].id}`);
      console.log(`   Username: ${adminCheck.rows[0].username}\n`);
    }

    // TEST 2: Test login endpoint directly
    console.log('TEST 2: Login Endpoint - Direct HTTP');
    console.log('─'.repeat(50));

    const loginBody = JSON.stringify({ username: 'admin', password: 'admin123' });

    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/admin/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(loginBody),
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      };

      console.log('Sending request to: http://localhost:3000/api/admin/login');
      console.log('Headers:', JSON.stringify(options.headers, null, 2));
      console.log('Body:', loginBody);
      console.log('');

      const req = http.request(options, (res) => {
        console.log('✅ RESPONSE RECEIVED');
        console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
        console.log('   Headers:');
        Object.entries(res.headers).forEach(([key, val]) => {
          console.log(`     ${key}: ${val}`);
        });

        let data = '';
        res.on('data', chunk => {
          data += chunk;
          console.log(`   📦 Received ${chunk.length} bytes`);
        });

        res.on('end', () => {
          console.log('\n📄 Response Body:');
          console.log(data);

          try {
            const parsed = JSON.parse(data);
            console.log('\n✅ PARSED JSON:');
            console.log(JSON.stringify(parsed, null, 2));

            if (res.statusCode === 200 && parsed.ok) {
              console.log('\n✅ LOGIN ENDPOINT IS WORKING');
            } else {
              console.log('\n❌ LOGIN RETURNED ERROR');
              console.log(`   Status: ${res.statusCode}`);
              console.log(`   Error: ${parsed.error}`);
            }
          } catch (e) {
            console.log('\n❌ INVALID JSON RESPONSE');
            console.log(`   Parse error: ${e.message}`);
          }

          console.log('\n' + '═'.repeat(50));
          console.log('BROWSER LOGIN DEBUGGING TIPS:');
          console.log('═'.repeat(50));
          console.log(`
1. Open: http://localhost:3000/admin/login.html

2. Right-click → Inspect (open DevTools)

3. Go to Console tab

4. Paste this code:
   fetch('/api/admin/login', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ username: 'admin', password: 'admin123' })
   })
   .then(r => r.json())
   .then(d => console.log('Response:', d))
   .catch(e => console.error('Error:', e))

5. Press Enter

6. Screenshot the response and share it
          `);

          console.log('\n═'.repeat(50) + '\n');
          resolve();
        });
      });

      req.on('error', (err) => {
        console.log(`\n❌ REQUEST ERROR: ${err.message}`);
        if (err.code === 'ECONNREFUSED') {
          console.log('\n⚠️  Cannot connect to localhost:3000');
          console.log('   Make sure server is running:');
          console.log('   npm start');
        }
        resolve();
      });

      req.on('timeout', () => {
        console.log('\n❌ REQUEST TIMEOUT');
        req.destroy();
        resolve();
      });

      req.write(loginBody);
      req.end();
    });

  } catch (err) {
    console.error('\n❌ FATAL ERROR:', err.message);
  }
})();
