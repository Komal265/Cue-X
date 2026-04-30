# ✨ Version 1.0.1

```
 ██████╗██╗   ██╗███████╗       ██╗  ██╗
██╔════╝██║   ██║██╔════╝       ╚██╗██╔╝
██║     ██║   ██║█████╗   █████╗ ╚███╔╝ 
██║     ██║   ██║██╔══╝   ╚════╝ ██╔██╗ 
╚██████╗╚██████╔╝███████╗       ██╔╝ ██╗
 ╚═════╝ ╚═════╝ ╚══════╝       ╚═╝  ╚═╝
```

<div align="center">

### **Customer Intelligence Engine · Segment · Predict · Engage**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-REST_API-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-Build-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Scikit-Learn](https://img.shields.io/badge/scikit--learn-KMeans-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Render-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

### 🚀 **[LIVE DEMO](https://cuex.vercel.app)** 🚀

</div>

---

## ✦ Overview

**CUE-X** is an enterprise-grade, AI-powered **Customer Segmentation Platform** designed to transform raw purchase data into actionable marketing intelligence. By bridging advanced machine learning (K-Means + RFM Scoring) with a robust multi-model Generative AI backend, CUE-X allows marketers to automatically cluster audiences, chat directly with their data, and deploy live integrations via Google Sheets or Webhooks.

> _"Know your customers—Own your market."_

---

## ✦ Deep Dive: Core Features

CUE-X is built as a comprehensive ecosystem rather than a simple visualization tool. Here is a detailed breakdown of its core capabilities:

### 1. 🧠 Smart RFM & K-Means Segmentation Engine
At the core of CUE-X is a robust, pre-trained Scikit-Learn machine learning pipeline. 
- **RFM Processing:** The system automatically calculates **Recency** (days since last purchase), **Frequency** (total purchases), and **Monetary** value (total spend) for every unique customer in your dataset.
- **K-Means Clustering:** Data is normalized using a `StandardScaler` and passed through a highly optimized K-Means model (`k=4`) to group customers into distinct behavioral segments without human bias.
- **Actionable Outputs:** Customers are dynamically mapped into actionable categories: _High-Value Loyal Customers_, _Low-Value Frequent Buyers_, _Lost Customers_, and _Seasonal Buyers_.
- **Performance:** Optimized data processing pipelines for faster segmentation.

### 2. 🤖 Resilient Multi-Model AI System (Gemini)
CUE-X is equipped with a fault-tolerant, multi-tier Generative AI architecture leveraging the `google.generativeai` SDK (`gemini-2.5-flash`).
- **Fail-Fast Fallbacks:** If the primary AI service experiences rate-limiting or network latency, the backend instantly falls back to a highly sophisticated **Rule-Based Engine**. This ensures that the user interface never breaks and strategies are always generated reliably.
- **Boardroom-Ready Summaries:** The AI automatically scans the clustered dataset to generate high-level executive summaries, detailing critical business metrics, identifying anomalies, and recommending immediate marketing actions.

### 3. 💬 AI Data Chat (RAG-Powered)
Instead of manually sifting through dashboards, users can literally **chat with their dataset**.
- **Context-Aware Inference:** The Gemini AI is injected with the statistical context of the current dataset (cluster counts, top spenders, RFM averages).
- **Natural Language Queries:** Ask complex questions like _"Which segment has the highest churn risk?"_ or _"What is the average spend for my loyal customers?"_ and receive instant, mathematically accurate answers.

### 4. 📈 Live Integrations: Google Sheets & Webhooks
CUE-X supports enterprise-grade data ingestion, moving beyond static CSV uploads:
- **Live Google Sheets Syncing:** Paste a public Google Sheet URL directly into CUE-X. The platform will automatically extract, parse, and segment the live data. You can enable **Auto-Sync** to poll the sheet periodically, ensuring your dashboard always reflects live CRM data.
- **Real-Time Webhooks:** Connect CUE-X to thousands of apps via **Zapier, Make.com, or n8n**. CUE-X generates a unique Webhook URL for your workspace. Whenever a new customer makes a purchase on Shopify or Stripe, the data is pushed to the webhook, instantly updating the underlying machine learning clusters.

### 5. 🏢 Workspace & Session Management
CUE-X is fully multi-tenant, utilizing a secure **PostgreSQL** database powered by SQLAlchemy.
- **Authentication:** Secure user signup and login utilizing encrypted JWT (JSON Web Tokens).
- **Workspaces:** Create isolated workspaces to separate data between different brands, clients, or product lines.
- **Persistent Models:** Uploaded datasets and their corresponding ML evaluations are persistently stored and tracked by unique Dataset IDs, allowing you to seamlessly revisit past analyses without reprocessing.

### 6. 📊 Real-Time Analytics Dashboard
A stunning, dark-themed, glassmorphic UI built with React 19, Recharts 3, and Framer Motion.
- **Interactive Visualizations:** Explore segment distribution donuts, spending bar charts, seasonal trend area charts, and multi-dimensional scatter plots.
- **Immersive 3D/GLSL:** The frontend utilizes Three.js shaders and particle systems to create a premium, cinematic user experience.

---

## ✦ Try It Now!

### 🌐 Live Application
**Visit:** [https://cue-x.vercel.app/](https://cue-x.vercel.app/)

### 📊 Testing Dataset
Download the sample dataset to test the application:
- **File:** `StyleSense_Dataset_updated.csv`
- **Size:** ~220KB
- **Records:** 1000+ customer transactions
- **[Download Dataset](https://github.com/Heisenberg-Xd/ML-miniproject/blob/main/StyleSense_Dataset_updated.csv)**

### 🎯 Quick Test Steps
1. Visit [https://cue-x.vercel.app/](https://cue-x.vercel.app/)
2. Create an account and a new Workspace.
3. Download the `StyleSense_Dataset_updated.csv` file.
4. Click **Upload CSV** (or try pasting a Google Sheet link!).
5. Watch as the ML model segments your customers in real-time.
6. Navigate to the **Analytics Dashboard** to explore the charts, chat with the AI, and read the Executive Summary.
7. Click **Download CSV** to retrieve your enriched data containing the new segment labels.

---

## ✦ Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Python 3.10+ |
| Web Framework | Flask |
| Database | PostgreSQL (SQLAlchemy ORM) |
| ML Engine | Scikit-Learn (K-Means, RFM Scoring) |
| Generative AI | Google GenAI SDK (`gemini-2.5-flash`) |
| Data Processing | Pandas, NumPy |
| Authentication | PyJWT, Werkzeug Security |
| Production Server | Gunicorn |
| Deployment | Render |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts 3 |
| Animation | Framer Motion + GSAP |
| 3D Engine | Three.js |
| Routing | React Router DOM 7 |
| Deployment | Vercel |

---

## ✦ Project Structure

```
cue-x/
│
├── 📄 app.py                      # Flask REST API & Factory Pattern Entry
├── ├── routes/                    # Modular API Blueprints (auth, ai, integrations)
├── ├── services/                  # Business logic (ML, Gemini, Database)
├── ├── models/                    # Serialized Joblib models & Encoders
├── 📄 requirements.txt            # Python dependencies
├── 📄 config.py                   # Environment Configurations
├── 📊 StyleSense_Dataset_updated.csv # Testing dataset
│
└── 📁 frontend/                   # React application
    ├── 📄 vite.config.ts
    ├── 📄 tailwind.config.js
    ├── 📁 src/
    │   ├── 📄 config/api.ts       # Centralized API routing (Vercel to Render)
    │   ├── 📁 components/         # Reusable UI components (DataChat, Charts)
    │   ├── 📁 pages/              # Route-level page components (Analytics, Dashboard)
    │   └── 📁 utils/              # fetchWithAuth & CORS handlers
    └── 📁 public/                 # Static assets
```

---

## ✦ Local Development Guide

### Prerequisites
- Python `3.10+`
- Node.js `18+` & npm
- PostgreSQL installed and running locally on port `5432`

---

### 1. Database Setup
1. Open pgAdmin or your PostgreSQL CLI.
2. Create a new database named exactly: `cuex_db`.
3. Create a `.env` file in the root directory:
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/cuex_db
JWT_SECRET_KEY=super-secret-local-key
GEMINI_API_KEY=your-google-gemini-key
FRONTEND_URL=http://localhost:5173
```

### 2. Backend Setup
Use a virtual environment to manage dependencies:
```bash
# Create virtual environment
python -m venv .venv

# Activate (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Activate (macOS / Linux)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the Flask server
python app.py
```
> The API will boot on **`http://localhost:10000`**. Tables will automatically generate in your PostgreSQL database on the first boot.

### 3. Frontend Setup
```bash
cd frontend

# Create local environment variables
echo "VITE_API_BASE=http://localhost:10000" > .env

# Install dependencies
npm install

# Start the dev server
npm run dev
```
> The React app will boot on **`http://localhost:5173`**.

---

## ✦ Deployment Architecture

The production environment of CUE-X is decoupled into a robust modern cloud stack:

1. **Frontend:** Deployed globally on the **Vercel Edge Network**. Ensures blazing fast loading times, seamless CI/CD, and global asset distribution.
2. **Backend:** Containerized and hosted on **Render** utilizing a Gunicorn WSGI server. The backend handles heavy Pandas data manipulation and Sklearn inference without blocking the main thread.
3. **Database:** Fully managed **Render PostgreSQL** instance, providing secure persistence, connection pooling, and automated backups.

---

## ✦ License

```
MIT License — Copyright (c) 2026 CUE-X Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files, to deal in the Software
without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software.
```

---

<div align="center">

```
Built by the CUE-X Team
Segment Smarter · Market Sharper
```

** Star this repo if CUE-X helped your project!**

**🌐 [Try the Live Demo](https://cuex.vercel.app)**

---
🛠️ **Maintainer:** [CUE-X Team](https://github.com/Heisenberg-Xd)

</div>

