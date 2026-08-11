# Payment Tracker - PWA User Guide

## What is a Progressive Web App (PWA)?

A PWA is an app that works like a native mobile app but runs in your browser. You can:
- ✅ Install it on your device (home screen or app drawer)
- ✅ Use it offline without internet
- ✅ Receive update notifications
- ✅ Access it quickly like a native app

---

## Installation Guide

### 📱 **On Mobile (Android)**

#### Using Chrome/Edge Browser:
1. Open your mobile browser (Chrome, Edge, or Brave)
2. Navigate to: **http://your-server-address/user/** (for users) or **http://your-server-address/admin/** (for admin)
3. Wait for the **"📱 Install App"** banner to appear at the top
4. Tap the **"Install"** button
5. Confirm the installation dialog
6. App appears in your home screen! 🎉

#### Alternative (Android Menu):
1. Open the browser's menu (three dots)
2. Select **"Install app"** or **"Add to Home Screen"**
3. Choose your preferred name
4. Tap "Install"

---

### 🍎 **On iPhone/iPad (iOS 13+)**

iOS doesn't show an install banner, but you can add it manually:

1. Open Safari browser
2. Navigate to: **http://your-server-address/user/** or **http://your-server-address/admin/**
3. Tap the **Share** button (↑ or square icon)
4. Scroll down and select **"Add to Home Screen"**
5. Choose a name for the app
6. Tap **"Add"**
7. App appears on your home screen! 🎉

---

### 💻 **On Desktop (Windows, Mac, Linux)**

#### Chrome/Brave Browser:
1. Open the browser
2. Go to: **http://your-server-address/user/** or **http://your-server-address/admin/**
3. Look for the **install icon** in the address bar (or wait for banner)
4. Click **"Install"** when prompted
5. App opens in standalone window

#### Edge Browser (Windows):
1. Navigate to the app URL
2. Click **Settings** (three dots) → **"Apps"** → **"Install this site as an app"**
3. Confirm the dialog

#### Firefox:
- Service worker caching works offline
- Can add bookmark to home screen for quick access

---

## Using the App

### 🌐 **First Time Setup**

1. **Open the App**
   - Tap the installed app icon on your home screen
   - Or navigate via browser to the URL

2. **For Users (Payment Portal)**
   - Enter your ITS ID or Sabil Number
   - Click "Check Account"
   - View your Takhmeen amount and payment history

3. **For Admin (Dashboard)**
   - Log in with your credentials
   - Access dashboard or data upload section

### 🔄 **Using Offline**

Once you've opened the app once:

1. **Automatic Caching**
   - The app automatically caches essential pages and data
   - No action needed!

2. **Offline Access**
   - Close your internet connection
   - Open the app again
   - Recent data is available from cache
   - You'll see an offline indicator if network is unavailable

3. **Cached Features**
   - Last viewed account information (users)
   - Dashboard overview (admin)
   - All UI elements and styling
   - Payment history

4. **Limited Offline**
   - Cannot search for new accounts offline
   - Cannot upload new payment data offline
   - Cannot add new users offline
   - Data updates happen when connection restored

### 🔗 **Connection Restored**

- App automatically detects when internet returns
- Shows **"✅ Connection Restored!"** banner
- Tap "Refresh Now" to sync latest data
- All pending actions are processed

---

## Update Notifications

### 📡 **Automatic Updates**

The app checks for updates every minute:

1. **New Version Available**
   - You'll see a **"🔄 Update Available"** banner
   - Shows "A new version of the app is ready"

2. **Updating the App**
   - Tap **"Update"** button
   - App refreshes with latest version
   - No need to reinstall!

3. **Update Later**
   - Tap **"Later"** to dismiss the banner
   - Updates when you restart the app

---

## Common Tasks

### ✅ **Check Your Account (Users)**

1. Open the Payment Portal app
2. Enter your **ITS ID** or **Sabil Number**
3. Click **"Check Account"**
4. View:
   - Your Takhmeen contribution amount
   - Payments received
   - Pending amount
   - Payment history by year
   - Individual payment receipts

### 📊 **Admin Dashboard**

1. Log in with your credentials
2. **Users Tab**: View all registered users with their balances
3. **Accounts Tab**: Search and sort users by contributions
4. **Upload Tab**: Upload user details and payment records via CSV
5. **Sort by**:
   - Takhmeen (contribution amount)
   - Received (amount paid)
   - Pending (amount outstanding)
   - Outstanding (balance due)

### 📤 **Upload Data (Admin)**

1. Go to **Upload** section
2. Choose file type: **"Upload Users"** or **"Upload Payments"**
3. Select your CSV file
4. System validates data
5. Click **"Upload"** to confirm
6. View results and any errors

---

## Troubleshooting

### ❌ **Install Button Not Showing?**

**On Android:**
- Make sure you're on HTTPS (secure connection)
- Try a different browser (Chrome recommended)
- Clear browser cache: Settings → Apps → Browser → Storage → Clear Cache
- Reload the page

**On iOS:**
- iOS always requires manual install via Share menu
- Works with iOS 13 or later
- Safari browser recommended

**On Desktop:**
- Check if browser supports PWA installation (Chrome, Edge, Brave)
- Check if you have the site open for at least 30 seconds
- Close and reopen the browser

### 🔌 **Offline Mode Not Working?**

1. **First Visit Required**
   - The app must be opened once while online to cache data
   - Return to offline mode after first visit

2. **Clear Cache**
   - App Settings → Storage → Clear Cache
   - Revisit app online to recache

3. **Service Worker Issue**
   - Open Developer Tools (F12)
   - Go to "Application" tab
   - Check "Service Workers" section
   - Should show "payment-tracker" is registered

### 🚀 **App Not Starting?**

1. **Hard Refresh**
   - Desktop: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Mobile: Close app completely and reopen

2. **Reinstall**
   - Remove app from home screen
   - Clear browser cache
   - Reinstall following installation guide

3. **Check Connection**
   - Make sure server is running
   - Verify URL is correct
   - Try in regular browser first

### 🔄 **Updates Not Appearing?**

1. **Force Refresh**
   - Close the app completely
   - Wait 60 seconds
   - Reopen the app

2. **Check Updates Manually**
   - App automatically checks every minute
   - Can also clear cache to force update

---

## Security & Privacy

### 🔐 **Data Storage**

- ✅ Admin login credentials are secure (never stored locally)
- ✅ User searches are cached temporarily
- ✅ Payment history cached from official server only
- ✅ All data validated before caching

### 🛡️ **Offline Security**

- Cached data is stored locally on your device
- Only you can access your app's data
- Clear cache to remove all stored data
- Uninstalling app removes all cached data

### 🚨 **Clearing Data**

**To remove all cached app data:**
1. Open app settings
2. Go to "Storage" or "App Storage"
3. Tap "Clear Cache" or "Clear Data"
4. Reinstall app if needed

---

## Device Requirements

### ✅ **Minimum Requirements**

**Android:**
- Android 5.0+
- Chrome, Edge, Firefox, or Brave browser
- 50MB free storage

**iOS:**
- iOS 13.0+
- Safari browser
- 50MB free storage

**Desktop:**
- Windows 7+, macOS 10.12+, or Linux
- Chrome 45+, Edge 79+, Firefox 44+, Safari 14+
- 50MB free storage

### 📱 **Recommended**

- **Android 10+** with Chrome 90+
- **iOS 15+** with Safari
- **Broadband or 4G+** internet connection
- **50MB-100MB** free storage for smooth operation

---

## Tips & Best Practices

### ⚡ **Performance**

1. **Faster Loading**
   - Open app at least once per week to keep cache fresh
   - This reduces loading time significantly

2. **Data Usage**
   - First load: ~2-5 MB (one-time)
   - Regular loads: <100 KB (cached data)
   - Much less data than web pages!

3. **Battery Life**
   - PWA uses less battery than native apps
   - Service worker runs efficiently in background

### 🎯 **Best Practices**

1. **Keep Updated**
   - Always accept update notifications
   - Keeps security features current

2. **Verify Connection**
   - For important operations, ensure internet is available
   - Check connection indicator on page

3. **Regular Backups**
   - Screenshot important information
   - Export/download payment records periodically

4. **Browser Updates**
   - Keep your browser updated
   - Ensures best PWA compatibility

---

## Getting Help

### 📧 **Support Contact**

If you encounter issues:

1. **Technical Issues**
   - Email: ali@testrig.co.in
   - Describe the problem and your device/browser

2. **Admin Access Issues**
   - Contact your system administrator
   - Provide your login credentials for verification

3. **Data Discrepancies**
   - Email with ITS ID or Sabil Number
   - Include screenshots if possible

### 💡 **Common Questions (FAQ)**

**Q: Can I use the app without internet?**
A: Yes, but you need internet for the first visit to cache data, then you can use offline.

**Q: Will my data sync across devices?**
A: No, data is device-specific. Each device maintains its own cache.

**Q: How much data does it use?**
A: Very little - just a few KB for each search/view after initial download.

**Q: Can I delete the app like normal apps?**
A: Yes, on home screen long-press the icon and select "Remove" or "Uninstall".

**Q: Is it safe to use for payments?**
A: Yes, all connections use HTTPS encryption and data is validated server-side.

---

## Version Information

- **App Version:** 1.0 (MVP)
- **Last Updated:** August 2026
- **Supported Browsers:** Chrome 45+, Edge 79+, Firefox 44+, Safari 14.1+
- **Offline Storage:** Service Worker + Browser Cache

---

## Feedback & Suggestions

Your feedback helps us improve! Please share:
- Feature requests
- Bug reports
- Usability suggestions
- Performance concerns

Email: ali@testrig.co.in

---

**Enjoy using Payment Tracker! 🚀**

Made with ❤️ by Cyphron Tech LLP
