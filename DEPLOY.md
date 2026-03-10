# How to Deploy BuildX AI 🚀

## Deploy to Render.com (Full-Stack — Recommended)

Render deploys **both your frontend and backend** as one service. Free tier available.

### Prerequisites
- A **GitHub** account (sign up free at [github.com](https://github.com))
- **Git** installed — download from [git-scm.com](https://git-scm.com/download/win)
  - OR use **GitHub Desktop** (easier): [desktop.github.com](https://desktop.github.com)

---

### Step 1: Push Your Code to GitHub

**Option A: Using GitHub Desktop (Easier)**
1. Download and install [GitHub Desktop](https://desktop.github.com)
2. Sign in with your GitHub account
3. Click **File → Add Local Repository** → browse to `d:\projects ai\teen ai project`
4. If it says "not a git repo", click **Create a Repository** → Fill in the name → **Create**
5. Write a commit message (e.g., "BuildX AI v1.0") → Click **Commit to main**
6. Click **Publish Repository** → Uncheck "Keep private" if you want it public → **Publish**

**Option B: Using Git CLI**
```bash
cd "d:\projects ai\teen ai project"
git init
git add .
git commit -m "BuildX AI v1.0"
git remote add origin https://github.com/YOUR_USERNAME/buildx-ai.git
git push -u origin main
```

---

### Step 2: Deploy on Render

1. Go to [render.com](https://render.com) and sign up with your **GitHub account**
2. Click **New +** → **Web Service**
3. Connect your GitHub repository (you may need to authorize Render)
4. Select your **buildx-ai** repository
5. Configure the service:
   - **Name:** `buildx-ai` (or anything you want)
   - **Region:** closest to your users
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free
6. Click **Create Web Service**
7. Wait 2-5 minutes for it to build and deploy
8. You'll get a URL like `https://buildx-ai.onrender.com` 🎉

---

### Step 3: Set Environment Variables (Optional but Recommended)

On your Render dashboard → your service → **Environment**:
- `JWT_SECRET` = (any random long string for security, e.g., `my-super-secret-key-2026-xyz`)
- `NODE_ENV` = `production`

---

## ⚠️ Important Notes

- **Free tier cold starts**: Render free tier spins down after 15 min of inactivity. First visit takes ~30 seconds.
- **SQLite on Render**: The database resets if the service restarts (Render free tier). For persistent data, consider upgrading or using a hosted database.
- **API Keys**: Users still enter their OWN Gemini API key in the app.
- **Updates**: Push new code to GitHub → Render auto-deploys.

---

## Alternative: Frontend-Only Deploy (Vercel/Netlify)

If you only want to deploy the frontend (no backend — no auth, no project saving):

1. Run `npm run build`
2. Drag the `dist` folder to [vercel.com](https://vercel.com) or [netlify.com](https://netlify.com)
3. Done — users bring their own AI key
