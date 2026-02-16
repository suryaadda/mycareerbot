# 🚀 DEPLOYMENT GUIDE - MyCareerBot

## Get Your App Live in 3 Minutes

---

## METHOD 1: Vercel Deploy (Recommended)

### ✅ Why Vercel?
- ✅ 100% Free forever
- ✅ Custom domain support (mycareerbot.com)
- ✅ Automatic HTTPS
- ✅ Global CDN (fast worldwide)
- ✅ Zero config needed
- ✅ Auto-redeploys when you update code

### 📋 Step-by-Step Instructions

**STEP 1: Download This Folder**
- You should have the entire `mycareerbot` folder on your computer
- It contains: package.json, pages/, public/, README.md, etc.

**STEP 2: Create Vercel Account**
1. Go to: https://vercel.com/signup
2. Click "Continue with GitHub"
3. If you don't have GitHub:
   - Go to https://github.com/signup
   - Create account (takes 2 minutes)
   - Then return to Vercel and sign in with GitHub

**STEP 3: Deploy**
1. Go to: https://vercel.com/new
2. Click "Add New" → "Project"
3. Click "Browse" or drag the `mycareerbot` folder
4. Vercel auto-detects it's a Next.js project
5. Project name: `mycareerbot` (or change it)
6. Click "Deploy"
7. Wait 30-60 seconds

**STEP 4: Your App is Live! 🎉**
You'll get a URL like:
- `https://mycareerbot.vercel.app`
- or `https://mycareerbot-yourusername.vercel.app`

**STEP 5: (Optional) Custom Domain**
1. In Vercel dashboard, go to Settings → Domains
2. Add your domain (e.g., mycareerbot.com)
3. Follow DNS instructions
4. Done!

---

## METHOD 2: Netlify Deploy (Alternative)

**STEP 1: Create Netlify Account**
1. Go to: https://app.netlify.com/signup
2. Sign up with GitHub

**STEP 2: Deploy**
1. Drag the `mycareerbot` folder to: https://app.netlify.com/drop
2. Wait 30 seconds
3. Your app is live!

**Your URL:** `https://mycareerbot-abc123.netlify.app`

---

## METHOD 3: GitHub Pages (Free but requires build)

**STEP 1: Create GitHub Repo**
```bash
cd mycareerbot
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mycareerbot.git
git push -u origin main
```

**STEP 2: Enable GitHub Pages**
1. Go to your repo → Settings → Pages
2. Source: Deploy from branch
3. Branch: main → /docs
4. Save

**Your URL:** `https://YOUR_USERNAME.github.io/mycareerbot`

---

## 🎬 VIDEO WALKTHROUGH (Coming Soon)

I'll create a screen recording showing:
1. How to deploy to Vercel (2 min)
2. First-time setup walkthrough (3 min)
3. Running your first batch (2 min)
4. Reviewing and submitting applications (3 min)

**Total:** 10-minute complete guide

---

## ⚠️ IMPORTANT NOTES

### About Storage
- Your data (profile, applications) is stored in **browser localStorage**
- This means:
  - ✅ Private - only you can see it
  - ✅ Fast - no server delays
  - ⚠️ Browser-specific - if you clear browser data, you'll lose it
  - ⚠️ Device-specific - data won't sync between phone and laptop

### To Access from Multiple Devices
- Use the same browser and stay logged in
- Or: I can add cloud sync in a future update

### About the AI Calls
- The app calls Claude API directly from your browser
- Claude sees: your resume + job descriptions
- Claude generates: cover letters, resume bullets, etc.
- Then forgets everything (no data retention)

---

## 🐛 TROUBLESHOOTING

### "Build Failed" error on Vercel
**Solution:** Make sure you uploaded the entire folder, not just one file

### "Module not found" error
**Solution:** The package.json might be missing. Re-download the complete folder.

### App loads but shows blank screen
**Solution:** 
1. Open browser console (F12)
2. Check for errors
3. Most common: Clear cache and hard reload (Ctrl+Shift+R)

### Resume upload doesn't work
**Solution:**
1. File must be PDF
2. Under 5MB
3. Try a different PDF if it still fails

### "Run Daily Batch" takes forever
**Solution:** This is normal! Generating 15 applications takes 30-60 seconds. Watch the progress bar.

---

## 📞 NEED HELP?

If you get stuck during deployment:

1. **Check the README.md** - Has FAQ section
2. **Check browser console** - Press F12, look for red errors
3. **Vercel Logs** - In Vercel dashboard → Deployments → Click your deployment → View Logs
4. **Common fix:** Delete the folder, re-download, try again

---

## ✅ POST-DEPLOYMENT CHECKLIST

After your app is live:

- [ ] Open your URL - does it load?
- [ ] Try the visa selector - does it work?
- [ ] Upload a test PDF - does it extract info?
- [ ] Pick some roles - do they select?
- [ ] Try "Run Daily Batch" - does it generate applications?
- [ ] Click a job card - does the modal open?
- [ ] Check all tabs: Cover Letter, Resume, LinkedIn, Interview, Analysis

If all ✅ → **You're ready to use MyCareerBot!**

---

## 🎯 NEXT STEPS

1. **Deploy** (3 minutes)
2. **Test** (2 minutes)
3. **Share with friends** - Send them your URL
4. **Start your job search** - Upload real resume, run real batches

---

**Ready to deploy?** Pick Method 1 (Vercel) and follow the steps above.

Your app will be live in 3 minutes. 🚀
