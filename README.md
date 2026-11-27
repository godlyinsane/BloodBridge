# BloodBridge 🩸

> A modern, clean full-stack web platform connecting people with verified blood banks, hospitals, and emergency distribution centers across India.

**Developed by Priyansh Bhatt for EPICS.**

---

## 📌 Overview

During medical emergencies, finding certified blood facilities and hospital blood banks quickly can be life-saving. **BloodBridge** eliminates delays by providing an intuitive, verified discovery directory and GPS-assisted nearest blood bank locator across India (with focused coverage in Bhopal, Sehore, Raisen, Vidisha, and central MP).

---

## ✨ Key Features

- **📍 Nearest Blood Bank Discovery:** Turn-by-turn routing and GPS-assisted discovery of verified hospitals, government blood banks, and storage centers.
- **🏥 Verified Blood Facilities & Directory:** Clean, searchable directory of verified hospitals, government blood centres, charitable units, and distribution drives with district and service filtering.
- **🩸 Clinical Reference Blood Groups:** Comprehensive clinical compatibility guide for all 8 standard ABO/Rh blood groups.
- **⚡ Performance & Modern UI:** Designed with modern aesthetics, dark/light theme support, accessible mobile navigation, and lightweight performance with zero bloated dependencies.
- **🚀 Single-Project Vercel & Node Deployment:** Pre-configured with serverless API proxy routes (`/api/*`) and SPA routing for seamless zero-config deployment.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite, Framer Motion, Lucide Icons, Tailwind / CSS variables
- **Backend:** Node.js, Express.js (Modular Serverless & Traditional)
- **Data Engine:** Local JSON database engine (`json-db`) with seamless MongoDB / Mongoose option
- **Deployment:** Vercel

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
   npm --prefix BloodBridgeFrontend install
   npm --prefix BloodBridgeBackend/bloodbridge-backend install
   ```

3. **Start the development servers:**
   ```bash
   # Start backend (Port 5000)
   npm --prefix BloodBridgeBackend/bloodbridge-backend start

   # Start frontend (Port 5173)
   npm --prefix BloodBridgeFrontend dev
   ```

4. **Open in browser:**
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:5000/api/blood-banks`

---

## 📜 License

Created by **Priyansh Bhatt** for EPICS.
Built to assist communities in discovering life-saving blood resources and verified medical facilities.
