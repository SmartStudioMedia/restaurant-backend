# Railway Deployment Guide

## 🚀 Deploy Your Restaurant App to Railway

### Step 1: Connect to Railway
1. Go to [railway.app](https://railway.app)
2. Sign up/Login with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your `restaurant-backend` repository

### Step 2: Configure the Project
1. Railway will automatically detect it's a Node.js project
2. The build command will be: `npm run build`
3. The start command will be: `npm start`

### Step 3: Set Environment Variables
In Railway dashboard, go to your project → Variables tab and add:
```
NODE_ENV=production
PORT=3000
```

### Step 4: Deploy
1. Railway will automatically build and deploy
2. Your app will be available at the provided Railway URL
3. Both frontend and backend will be served from the same domain

### Step 5: Access Your App
- Frontend: `https://your-app.railway.app`
- Backend API: `https://your-app.railway.app/api`
- Admin Panel: `https://your-app.railway.app/admin`

## 🎯 What You'll Get

### Mobile-First Design
- ✅ Centered welcome page
- ✅ Language dropdown with 10 languages + flag emojis
- ✅ Dine-in/Takeaway selection
- ✅ Restaurant name top-left, cart top-right
- ✅ Horizontal scrollable category tabs with emojis
- ✅ Scrollable item cards with proper proportions
- ✅ Clickable items with full details modal
- ✅ Professional cart with cancel order option
- ✅ Sleek, user-friendly mobile interface

### Features
- 🍔 **Welcome Page**: Beautiful centered design with language selection
- 🌍 **10 Languages**: English, Maltese, Italian, French, Spanish, German, Russian, Portuguese, Dutch, Polish
- 📱 **Mobile Optimized**: Touch-friendly, responsive design
- 🛒 **Smart Cart**: Add/remove items, cancel order, complete order
- 🖼️ **Clickable Images**: Full-screen image viewing
- ⚡ **Fast Loading**: Optimized images and smooth animations
- 🎨 **Modern UI**: Gradients, shadows, smooth transitions

## 🔧 Local Development

To run locally:
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Start development server
npm run dev
```

## 📱 Mobile Testing

Test on your phone:
1. Get your Railway URL
2. Open in mobile browser
3. Add to home screen for app-like experience
4. Test all features: language switching, cart, ordering

Your app is now ready for production! 🎉
