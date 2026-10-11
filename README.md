# 🌿 EcoTrack — Personal Sustainability Tracker Website

Please see [`ecotrack/README.md`](./ecotrack/README.md) for full documentation, architecture diagrams, and testing guides.

## Quick Start:

1. **Install Python dependencies:**
   ```bash
   pip install -r ecotrack/flask-service/requirements.txt
   ```

2. **Install Node.js dependencies:**
   ```bash
   cd ecotrack/backend && npm install && cd ../..
   ```

3. **Start the Flask Calculation Microservice (Terminal 1):**
   ```bash
   python ecotrack/flask-service/app.py
   ```

4. **Start the Node.js / Express Server (Terminal 2):**
   ```bash
   npm --prefix ecotrack/backend start
   ```

5. **Open in Browser:**
   👉 Visit `http://localhost:5000`
