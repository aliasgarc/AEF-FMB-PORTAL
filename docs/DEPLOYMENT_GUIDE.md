# Payment Tracker - Deployment & User Access Guide

## 📋 Overview

This guide explains how to deploy the Payment Tracker PWA and share it with users and admins.

---

## 🚀 Server Setup

### Prerequisites

- Node.js 14+ installed
- PostgreSQL database running with FMB tables:
  - `fmb_its_tbl` (user master data)
  - `fmb_takhmeen` (contribution data)
  - `fmb_payment_tbl` (payment records)

### Installation Steps

```bash
# 1. Clone or extract the project
cd saas-payment-tracker

# 2. Install dependencies
npm install

# 3. Configure environment variables (.env file)
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=fmb_database
DB_USER=db_user
DB_PASSWORD=db_password

# 4. Start the server
npm start

# Server running at http://localhost:3000
# Admin portal: http://localhost:3000/admin
# User portal: http://localhost:3000/user
```

---

## 🌐 Deployment Options

### Option 1: Local Network (LAN)

**Best for:** Small teams, office use, testing

```bash
# Find your computer's IP
# Windows: ipconfig
# Mac/Linux: ifconfig

# Access from other computers on same network:
# http://192.168.x.x:3000  (replace with your IP)
```

**Advantages:**
- ✅ No internet required
- ✅ Fastest performance
- ✅ No external server cost
- ✅ Complete data privacy

**Disadvantages:**
- ❌ Only works on office network
- ❌ Can't access remotely
- ❌ Each user needs network access

---

### Option 2: Public Server (Internet)

**Best for:** Distributed users, remote access, production

#### Using Vercel (Easy, Free)

```bash
# 1. Create Vercel account at vercel.com
# 2. Install Vercel CLI
npm install -g vercel

# 3. Deploy
vercel

# 4. Set environment variables in Vercel dashboard
# - DB_HOST, DB_PORT, DB_NAME, etc.

# 5. Get your URL: https://your-app.vercel.app
```

#### Using Render (Free Tier Available)

```bash
# 1. Create account at render.com
# 2. Connect GitHub repository
# 3. Create new Web Service
# 4. Set environment variables
# 5. Deploy

# URL: https://your-app.onrender.com
```

#### Using AWS/Heroku/DigitalOcean

Follow their Node.js deployment guides, ensure:
- Environment variables configured
- Port 3000 or custom port exposed
- Database connection working
- HTTPS enabled (recommended)

---

### Option 3: Docker Deployment

**Best for:** Scalable, containerized deployments

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t payment-tracker .
docker run -p 3000:3000 \
  -e DB_HOST=your-db-host \
  -e DB_PORT=5432 \
  -e DB_NAME=fmb_database \
  -e DB_USER=user \
  -e DB_PASSWORD=password \
  payment-tracker
```

---

## 📱 Sharing Access Links

### For User Portal (Payment Lookup)

**Permanent URL:**
```
http://your-server:3000/user
or
https://your-domain.com/user
```

**QR Code Link:**
```
http://your-server:3000/install-guide.html
```

### For Admin Portal (Management)

**Dashboard Access:**
```
http://your-server:3000/admin
```

**Login Page:**
```
http://your-server:3000/admin/login.html
```

---

## 📢 User Communication

### Email Template (For Users)

```
Subject: 📱 Download Payment Tracker App

Dear Member,

You can now easily check your Takhmeen contribution and payment status 
using our new Payment Tracker app!

🚀 GET STARTED:

Option 1: Install as App (Recommended)
1. Visit: http://your-server:3000/user
2. Wait for "📱 Install App" banner
3. Tap "Install"
4. Check your account from your home screen!

Option 2: Save as Bookmark
1. Visit: http://your-server:3000/user
2. Bookmark the page
3. Access anytime

📋 WHAT YOU CAN DO:
✅ Check your Takhmeen amount
✅ View payment history
✅ See pending balance
✅ Works offline (after first visit)

📱 WORKS ON:
• Android phones (Chrome, Edge)
• iPhone/iPad (Safari)
• Laptops and computers

❓ NEED HELP?
Installation Guide: http://your-server:3000/install-guide.html
Contact: ali@testrig.co.in

Best regards,
Faizul Mawaid Al-Burhaniyah
```

### SMS Template (For Mobile Users)

```
📱 Payment Tracker App Ready!

Check your Takhmeen & payments instantly:

👉 Visit: http://your-server:3000/user
📱 Tap "Install App" to download
✅ Works offline!

Help: http://your-server:3000/install-guide.html
```

### WhatsApp Message (For Groups)

```
🎉 Great News! Payment Tracker App is Live!

Now you can check your account anytime, anywhere - even without internet!

🔗 Download: http://your-server:3000/user
📱 Click "Install" when you visit

Features:
✅ Check Takhmeen & payments
✅ View payment history
✅ Works offline
✅ Auto updates

Installation Guide:
http://your-server:3000/install-guide.html

Any issues? Contact us at ali@testrig.co.in
```

---

## 🔐 Security Checklist

Before going live:

- [ ] **HTTPS Enabled** - Always use HTTPS in production
  ```bash
  # Force HTTPS in Express (add to src/app.js)
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
  ```

- [ ] **Database Security**
  - Use strong passwords
  - Restrict database access
  - Regular backups configured
  - No credentials in code (use .env file)

- [ ] **Admin Access**
  - Change default admin password
  - Limit admin portal to trusted networks (optional)
  - Enable login audit logs

- [ ] **API Security**
  - Rate limiting enabled
  - Input validation active
  - CORS configured properly

- [ ] **Data Privacy**
  - No sensitive data in browser cache
  - Clear cache on logout
  - GDPR/privacy policy in place

---

## 📊 Monitoring & Maintenance

### Health Check Endpoint

```bash
# Check if server is running
curl http://your-server:3000/health

# Response:
# {"ok":true}
```

### Log Monitoring

```bash
# Monitor application logs
npm start 2>&1 | tee app.log

# Watch logs in real-time
tail -f app.log
```

### Database Backups

```bash
# Backup PostgreSQL
pg_dump -h localhost -U user -d fmb_database > backup.sql

# Restore from backup
psql -h localhost -U user -d fmb_database < backup.sql
```

### Performance Optimization

1. **Enable Browser Caching**
   ```bash
   # Static assets cached for 30 days
   # Already configured in Express static middleware
   ```

2. **Compress Responses**
   ```bash
   # Add gzip compression to app.js
   const compression = require('compression');
   app.use(compression());
   ```

3. **Database Query Optimization**
   - Use EXPLAIN ANALYZE on slow queries
   - Index frequently searched columns (its_id, hof_its)

---

## 🐛 Troubleshooting Deployment

### Server Not Accessible

```bash
# 1. Check if server is running
netstat -an | grep 3000  # Windows

# 2. Verify firewall allows port 3000
# 3. Check if database connection works
# 4. Check .env file is properly configured
```

### Slow Performance

```bash
# 1. Check database query performance
EXPLAIN ANALYZE SELECT ... FROM fmb_users;

# 2. Monitor server resources
# Windows Task Manager → Performance tab
# Linux: top or htop command

# 3. Reduce number of concurrent users
# Add load balancer for production
```

### HTTPS Certificate Issues

```bash
# Get free SSL certificate via Let's Encrypt
certbot certonly --standalone -d your-domain.com

# Install certificate on server
# (Configuration depends on your hosting platform)
```

---

## 📈 Analytics & Usage Tracking

### Recommended Tools

1. **Google Analytics** (Free)
   - Add to public/shared.css or master HTML
   - Tracks user sessions and features used

2. **Sentry** (Free tier available)
   - Error tracking and monitoring
   - Alerts for crashes

3. **Custom Analytics**
   - Add logging endpoint: `/api/analytics`
   - Track feature usage patterns

### Simple Usage Tracking

```javascript
// Add to shared.js for basic analytics
const trackEvent = (event, data) => {
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, data, timestamp: new Date() })
  });
};

// Usage:
trackEvent('user_lookup', { its_id: '50450029' });
trackEvent('payment_upload', { count: 150 });
```

---

## 🔄 Update Strategy

### Automatic Updates (Users Don't Need to Do Anything)

1. New version deployed to server
2. Service Worker detects changes (checks every 60 seconds)
3. User sees "🔄 Update Available" banner
4. User taps "Update" → app refreshes with new version
5. No app store, no manual installation needed!

### Rolling Out Features

```bash
# Deploy to production
npm run build  # (if using build process)
npm start

# Users automatically notified of updates
# No downtime during updates
```

---

## 📞 Support & Contact

### Setting Up Support Email

Add support contact to `install-guide.html`:

```html
<p>📧 Need help? Contact: ali@testrig.co.in</p>
```

### Support Checklist

- [ ] Respond to emails within 24 hours
- [ ] Maintain FAQ page
- [ ] Log and track issues
- [ ] Test fixes on multiple devices
- [ ] Communicate maintenance windows

---

## 🚀 Production Deployment Checklist

Before launching to all users:

### Preparation
- [ ] Database backups working
- [ ] HTTPS/SSL configured
- [ ] Admin credentials secured
- [ ] All environment variables set
- [ ] Server capacity adequate

### Testing
- [ ] Test user portal on Android
- [ ] Test user portal on iPhone
- [ ] Test admin portal on desktop
- [ ] Test offline functionality
- [ ] Test payment upload feature
- [ ] Test on slow internet (3G simulation)

### Security
- [ ] No console errors in browser
- [ ] No sensitive data in localStorage
- [ ] CORS properly configured
- [ ] Admin login working
- [ ] Rate limiting active

### Documentation
- [ ] Installation guide published
- [ ] User emails scheduled
- [ ] Support email configured
- [ ] Emergency contacts listed
- [ ] Backup procedures tested

### Monitoring
- [ ] Error tracking enabled
- [ ] Uptime monitoring active
- [ ] Database backup automated
- [ ] Logs being collected
- [ ] Performance baseline established

---

## 📅 Migration Path (From Web to PWA)

### Phase 1: Deploy ✅ (Complete)
- Service Worker for offline support
- Install prompts on compatible browsers
- Update notifications
- Offline fallback page

### Phase 2: Enhance (Future)
- IndexedDB for offline data persistence
- Form submission queue
- Background sync
- Advanced analytics

### Phase 3: Scale (Future)
- Multi-language support
- Offline payment tracking
- Advanced reporting
- Admin analytics dashboard

---

## 📧 Contact for Questions

**Technical Support:** ali@testrig.co.in

---

**Version:** 1.0 (MVP - Progressive Web App)  
**Last Updated:** August 2026  
**Made by:** CyphronTech LLP
