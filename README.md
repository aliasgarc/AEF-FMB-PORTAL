# Payment Tracker - Progressive Web App

A modern PWA for tracking Takhmeen contributions and payments with offline support and automatic updates.

## 🚀 Quick Start

- **User Portal:** http://localhost:3000/user
- **Admin Portal:** http://localhost:3000/admin

## 📖 Documentation

All documentation has been moved to the `/docs` folder. See [docs/INDEX.md](docs/INDEX.md) for a complete guide.

### Quick Links

- [Quick Start Guide](docs/QUICK_LINKS.md) - Fast reference for users
- [User Guide](docs/PWA_USER_GUIDE.md) - Detailed user instructions
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) - How to deploy
- [Vercel Setup](docs/VERCEL_SETUP.md) - Vercel-specific instructions
- [PWA Implementation](docs/FINAL_IMPLEMENTATION_VERIFICATION.md) - Complete technical verification

## 🎯 Features

✅ **Progressive Web App (PWA)**
- Install on home screen (no app store)
- Works offline with cached data
- Automatic updates within 60 seconds
- Mobile responsive design

✅ **User Features**
- Check Takhmeen contribution amount
- View payment history
- See pending balance
- Offline access to recent data

✅ **Admin Features**
- Manage user accounts
- Upload user and payment data (CSV)
- View system statistics
- Sort and filter accounts

## 🏗️ Project Structure

```
saas-payment-tracker/
├── docs/                      # All documentation files
├── public/                    # Frontend files
│   ├── user/                 # User portal
│   ├── admin/                # Admin portal
│   ├── service-worker.js     # PWA service worker
│   ├── pwa-install.js        # PWA installation manager
│   ├── icon.svg              # PWA icon
│   └── shared.css            # Global styles
├── src/                       # Backend code
│   ├── app.js                # Express app
│   └── routes/               # API routes
├── package.json              # Dependencies
└── server.js                 # Server entry point
```

## 💻 Development

### Install Dependencies
```bash
npm install
```

### Start Local Server
```bash
npm start
```

Server runs at `http://localhost:3000`

### Build/Deploy
```bash
git add .
git commit -m "Your message"
git push origin main
# Vercel auto-deploys
```

## 📱 Installation

### On Android (Chrome/Edge)
1. Visit: `https://saas-payment-tracker.vercel.app/user`
2. Wait 2-3 seconds for install banner
3. Tap "📱 Install App"
4. Confirm installation
5. Icon appears on home screen!

### On iPhone (Safari)
1. Visit: `https://saas-payment-tracker.vercel.app/user`
2. Tap Share (↑)
3. Tap "Add to Home Screen"
4. Confirm
5. Icon appears on home screen!

## 🔄 Updates

Users receive automatic updates:
- Service Worker checks every 60 seconds
- "Update Available" banner appears when new version deployed
- One-tap update experience
- No app store required

## 🔐 Security

- HTTPS encryption (Vercel provides SSL)
- Admin login authentication
- Database query validation
- Environment variables for secrets

## 📞 Support

For issues or questions, refer to the documentation in `/docs` folder.

## 📋 Technology Stack

- **Frontend:** HTML, CSS, JavaScript, PWA
- **Backend:** Node.js, Express
- **Database:** PostgreSQL
- **Hosting:** Vercel (PWA), Local/Custom (API)
- **Icons:** SVG

## 📄 License

Internal use only.

---

**For detailed documentation, see [docs/INDEX.md](docs/INDEX.md)**
