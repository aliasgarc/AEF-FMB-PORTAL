const db = require('../src/db');

async function testPushNotifications() {
  try {
    console.log('🧪 Testing Push Notifications System...\n');

    // Test 1: Create push notification to all users
    console.log('📝 Test 1: Sending custom message to all users');
    const response1 = await fetch('http://localhost:3000/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_type: 'all',
        message_type: 'custom',
        title: '🔔 Test Notification',
        custom_message: 'This is a test notification to all users',
        admin_id: 'test_admin'
      })
    });

    const data1 = await response1.json();
    console.log('✅ Result:', data1);
    console.log();

    // Test 2: Create auto-takhmeen notification to specific user
    console.log('📝 Test 2: Sending auto Takhmeen message to specific user');
    const response2 = await fetch('http://localhost:3000/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_type: 'specific',
        its_ids: ['50450029'],  // Use actual user ID
        message_type: 'auto_takhmeen',
        title: '💰 Your Takhmeen',
        admin_id: 'test_admin'
      })
    });

    const data2 = await response2.json();
    console.log('✅ Result:', data2);
    console.log();

    // Test 3: Create auto-pending notification to specific users
    console.log('📝 Test 3: Sending auto Pending message to multiple users');
    const response3 = await fetch('http://localhost:3000/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_type: 'specific',
        its_ids: ['50450029', '50450030'],  // Multiple users
        message_type: 'auto_pending',
        title: '⚠️ Pending Payment',
        admin_id: 'test_admin'
      })
    });

    const data3 = await response3.json();
    console.log('✅ Result:', data3);
    console.log();

    // Test 4: Get push notification history
    console.log('📝 Test 4: Fetching push notification history');
    const response4 = await fetch('http://localhost:3000/api/push/history');
    const data4 = await response4.json();
    console.log('✅ History Count:', data4.notifications.length);
    if (data4.notifications.length > 0) {
      console.log('Latest notification:');
      console.log('  -', data4.notifications[0]);
    }
    console.log();

    console.log('✅ All tests completed!\n');

  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
}

// Run tests if server is available
setTimeout(testPushNotifications, 2000);
