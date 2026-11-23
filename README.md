# BloodBridge 🩸

> A modern, production-ready full-stack MERN blood donation & emergency network connecting patients, verified donors, and certified blood banks with live maps, shortage tracking, and lightweight touch-optimized performance.

---

## 📌 Overview

During medical emergencies, finding compatible blood quickly can be life-or-death. **BloodBridge** eliminates delays by offering a unified discovery and coordination hub. The platform features an interactive donor map, facility directory, real-time inventory exploration, and lightweight touch-optimized mobile performance.

---

## ✨ Features

- **📍 Nearest Blood Bank Discovery:** Turn-by-turn routing and GPS-assisted discovery of verified hospitals, government blood banks, and storage centers.
- **🛡️ Verification-Aware Donor Network:** Locality-based discovery of available and verified donors categorized by ABO/Rh blood groups.
- **🩸 Real-Time Blood Facilities & Shortage Tracker:** Live regional inventory indicators showing where specific blood components and units are critically needed.
- **⚡ Performance & Mobile First:** Powered by Vite & React 19 with GPU-accelerated CSS lighting, optimized for smooth performance on both low-end PCs and Android/iOS devices without tap jumping or animation lag.
- **🚀 Single-Project Vercel Deployment:** Pre-configured with serverless API proxy routes (`/api/*`) and SPA routing for seamless zero-config deployment on Vercel.
- **🔐 Secure Architecture:** JWT authentication, bcrypt password hashing, and lazy MongoDB connection pooling for serverless execution.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite, Framer Motion, Lucide Icons, Recharts, Three.js
- **Backend:** Node.js, Express.js (Modular Serverless & Traditional)
- **Database:** MongoDB & Mongoose
- **Deployment & Hosting:** Vercel

---

## 🚀 Getting Started

### Prerequisites
- Node.js (>= 20)
- npm

### Installation & Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/godlyinsane/BloodBridge.git
   cd BloodBridge
   ```

2. **Install dependencies:**
   ```bash
   npm install
   npm --prefix raktsetufrontend install
   npm --prefix raktsetuBackend/raktsetu-backend install
   ```

3. **Configure Environment Variables:**
   Create `.env` in `raktsetuBackend/raktsetu-backend/`:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key_at_least_32_characters
   CLIENT_ORIGIN=http://localhost:5173
   ```

4. **Run the frontend development server:**
   ```bash
   npm --prefix raktsetufrontend run dev
   ```

5. **Run the backend development server:**
   ```bash
   npm start
   ```
