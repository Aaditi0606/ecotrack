# 🚀 EcoTrack Deployment & Sharing Guide

There are two primary ways to share your live EcoTrack link with a friend:

---

## ⚡ Option 1: Instant Sharing via Tunnel (Ready in 30 Seconds)

If your laptop is on and both services are running locally, you can create a public HTTPS link immediately without signing up for any cloud hosting.

### Method A: Using `localtunnel` (No Signup Required)
1. Open a new PowerShell terminal.
2. Run:
   ```powershell
   npx localtunnel --port 5000
   ```
3. It will print a public URL like:
   ```text
   your url is: https://green-leaves-42.loca.lt
   ```
4. **Endpoint password check:** Localtunnel asks first-time visitors for your public IP address to prevent bots.
   - You can find your IP by visiting: [https://loca.lt/mytunnelpassword](https://loca.lt/mytunnelpassword) or typing `curl https://icanhazip.com` in your terminal.
   - Send that IP and the `.loca.lt` link to your friend!

---

### Method B: Using `ngrok` (Cleanest Tunnel Experience)
1. Download ngrok or install via:
   ```powershell
   winget install ngrok
   ```
2. Run:
   ```powershell
   ngrok http 5000
   ```
3. Ngrok gives you a clean link like `https://xxxx.ngrok-free.app` that your friend can open directly on their phone or computer.

---

## 🌐 Option 2: Permanent Free Cloud Deployment (24/7 Online)

If you want a permanent link like `https://ecotrack.onrender.com` that stays online even when your laptop is turned off:

### Step 1: Push Code to GitHub
1. Create a free repository on [GitHub.com](https://github.com).
2. Push your project:
   ```bash
   git init
   git add .
   git commit -m "Initial EcoTrack commit"
   git remote add origin https://github.com/<your-username>/ecotrack.git
   git push -u origin main
   ```

### Step 2: Create Free MongoDB Database (MongoDB Atlas)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and create a free M0 cluster (free forever).
2. Under **Database Access**, create a user (e.g., `ecotrack_user` with a password).
3. Under **Network Access**, click **Add IP Address** -> select **Allow Access from Anywhere** (`0.0.0.0/0`).
4. Copy the connection string:
   ```text
   mongodb+srv://ecotrack_user:<password>@cluster0.mongodb.net/ecotrack?retryWrites=true&w=majority
   ```

### Step 3: Deploy Free on Render.com
Render allows hosting both Node.js and Python web services for free:

1. Sign up for free at [Render.com](https://render.com).
2. Click **New +** -> **Web Service** -> Connect your GitHub repository.
3. **Deploy Flask Service first:**
   - Name: `ecotrack-flask`
   - Root Directory: `ecotrack/flask-service`
   - Runtime: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python app.py`
   - Environment Variable: `FLASK_PORT=10000`
   - Click **Create Web Service**. Note the URL (e.g., `https://ecotrack-flask.onrender.com`).

4. **Deploy Node.js Backend & Frontend:**
   - Click **New +** -> **Web Service** -> Connect the same repository.
   - Name: `ecotrack-web`
   - Root Directory: `ecotrack/backend`
   - Runtime: `Node`
   - Build Command: `npm install && cd ../frontend && npx typescript --project tsconfig.json`
   - Start Command: `npm start`
   - Environment Variables:
     - `PORT`: `10000`
     - `MONGODB_URI`: `<Your MongoDB Atlas connection string from Step 2>`
     - `FLASK_SERVICE_URL`: `https://ecotrack-flask.onrender.com` (from the previous step)
   - Click **Create Web Service**.

Once built, Render will provide a permanent link like:
👉 **`https://ecotrack-web.onrender.com`**

Share this link with your friend, professor, or classmates!
