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
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

### 🚀 **[LIVE DEMO](https://cue-x.vercel.app/)** 🚀

</div>

---

## ✦ Overview

**CUE-X** is a full-stack, AI-powered **Customer Segmentation Platform** that transforms raw purchase data into actionable marketing intelligence. Upload a customer dataset, let the ML engine cluster your audience, and explore a real-time interactive dashboard that tells the story behind your data.

> _"Know your customers. Own your market."_

---

## ✦ Key Features

| Feature | Description |
|---|---|
| 🧠 **Smart Segmentation** | K-Means ML model classifies customers into 4 behavioural segments |
| 📤 **CSV Upload Pipeline** | Drag-and-drop file ingestion with instant server-side preprocessing |
| 📊 **Live Analytics Dashboard** | Recharts-powered visualisations — distribution, spending, recency & seasonal trends |
| 🎯 **Campaign Recommendations** | Auto-generates targeted marketing strategies per segment |
| 📥 **Export Results** | Download the fully enriched & labelled dataset as a CSV |
| ⚡ **High-Performance Frontend** | React 19 + Vite 8 + TailwindCSS 4 – ultra-fast, glassmorphic UI |
| 🌐 **REST API Backend** | Flask REST endpoints powering all chart data in real-time |

---

## ✦ Try It Now!

### 🌐 Live Application
**Visit:** [https://cue-x.vercel.app/](https://cue-x.vercel.app/)

### 📊 Testing Dataset
Download the sample dataset to test the application:
- **File:** `StyleSense_Dataset_updated.csv`
- **Size:** ~220KB
- **Records:** 1000+ customer transactions
- **[Download Dataset](https://github.com/your-username/cue-x/blob/main/StyleSense_Dataset_updated.csv)**

### 🎯 Quick Test Steps
1. Visit [https://cue-x.vercel.app/](https://cue-x.vercel.app/)
2. Download the `StyleSense_Dataset_updated.csv` file
3. Click "Upload CSV" and select the dataset
4. Watch as the ML model segments your customers in real-time
5. Explore the interactive dashboard with charts and insights
6. Download the enriched results with segment labels

---

## ✦ Customer Segments

```
┌──────────────────────────────────────────────────────────────────┐
│  SEGMENT 0  │  Low-Value Frequent Buyers                         │
│             │  → Campaign: Discount Coupons & Loyalty Programs   │
├──────────────────────────────────────────────────────────────────┤
│  SEGMENT 1  │  High-Value Loyal Customers                        │
│             │  → Campaign: Exclusive Membership & VIP Rewards    │
├──────────────────────────────────────────────────────────────────┤
│  SEGMENT 2  │  Lost Customers                                    │
│             │  → Campaign: Re-engagement Emails & Offers         │
├──────────────────────────────────────────────────────────────────┤
│  SEGMENT 3  │  Seasonal Buyers                                   │
│             │  → Campaign: Seasonal Promotions & Personalisation │
└──────────────────────────────────────────────────────────────────┘
```

---

## ✦ Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Python 3.10+ |
| Web Framework | Flask |
| ML Engine | Scikit-Learn (K-Means) |
| Data Processing | Pandas, NumPy |
| Model Serialisation | Joblib |
| Production Server | Gunicorn |
| Deployment | Vercel (Serverless) |

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
├── 📄 app.py                      # Flask REST API & ML pipeline
├── 📄 requirements.txt            # Python dependencies
├── 📄 Procfile                    # Heroku deployment config
├── 📄 vercel.json                 # Vercel deployment config
├── 🤖 kmeans_model.joblib         # Pre-trained K-Means model
├── 📊 StyleSense_Dataset.csv      # Source dataset (original)
├── 📊 StyleSense_Dataset_updated.csv  # Testing dataset (extended)
├── 📓 kmeans.ipynb                # Model training notebook
│
├── 📁 uploads/                    # Temp storage for uploaded files
│
└── 📁 frontend/                   # React application
    ├── 📄 index.html
    ├── 📄 vite.config.ts
    ├── 📄 tailwind.config.js
    ├── 📁 src/
    │   ├── 📄 main.tsx
    │   ├── 📄 App.tsx
    │   ├── 📁 components/         # Reusable UI components
    │   │   └── 📁 ui/
    │   └── 📁 pages/              # Route-level page components
    └── 📁 public/                 # Static assets
```

---

## ✦ Getting Started

### Prerequisites

- Python `3.10+`
- Node.js `18+` & npm
- Git

---

### 1 · Clone the Repository

```bash
git clone https://github.com/your-username/cue-x.git
cd cue-x
```

---

### 2 · Backend Setup

```bash
# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the Flask server
python app.py
```

> The API will be live at **`http://localhost:5000`**

---

### 3 · Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

> The React app will be live at **`http://localhost:5174`**

---

## ✦ API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Upload CSV, run segmentation, return session ID |
| `GET` | `/download` | Download enriched output CSV |
| `GET` | `/visualization/<session_id>` | Render visualisation page |
| `GET` | `/api/segment-counts/<session_id>` | Segment distribution data |
| `GET` | `/api/spending-by-segment/<session_id>` | Avg spending per segment |
| `GET` | `/api/recency-value-scatter/<session_id>` | Recency vs. value scatter data |
| `GET` | `/api/seasonal-distribution/<session_id>` | Seasonal pattern breakdown |

---

## ✦ Input CSV Format

Your dataset must include the following columns:

```
Customer_ID | Customer_Name | Email | Product | Quantity | Price_Per_Item | Total_Price | Purchase_Date | Season
```

| Column | Type | Example |
|---|---|---|
| `Customer_ID` | int | `1` |
| `Customer_Name` | string | `Michelle Harris` |
| `Email` | string | `customer@example.com` |
| `Product` | string | `Sneakers` |
| `Quantity` | int | `5` |
| `Price_Per_Item` | float | `3148.00` |
| `Total_Price` | float | `15740.00` |
| `Purchase_Date` | `YYYY-MM-DD` | `2024-04-23` |
| `Season` | string | `Spring`, `Summer`, `Monsoon`, `Autumn`, `Winter` |

### Sample Data Preview

```csv
Customer_ID,Customer_Name,Email,Product,Quantity,Price_Per_Item,Total_Price,Purchase_Date,Season
1,Michelle Harris,zbarrett@jordan-thomas.com,Sneakers,5,3148,15740,2024-04-23,Spring
2,Leah Lee,rroberson@morales.org,Loafers,3,2049,6147,2024-11-04,Autumn
3,Sheri Espinoza,maria11@yahoo.com,Sandals,2,2649,5298,2024-06-17,Summer
```

---

## ✦ ML Pipeline

```
  CSV Upload
      │
      ▼
  Data Preprocessing
  ┌─────────────────────────────────────────┐
  │  • Season → Ordinal Encoding            │
  │  • Purchase_Date → Recency (days)       │
  │  • Avg_Order_Value = Total / Quantity   │
  │  • StandardScaler normalisation         │
  └─────────────────────────────────────────┘
      │
      ▼
  Feature Selection: [Recency, Avg_Order_Value]
      │
      ▼
  Pre-trained K-Means Model (k=4)
      │
      ▼
  Cluster Labels + Segment Names + Campaign Tags
      │
      ▼
  Enriched CSV  ←→  REST API  ←→  React Dashboard
```

---

## ✦ Deployment

### Vercel (Current Deployment)

The application is currently deployed on Vercel at [https://cue-x.vercel.app/](https://cue-x.vercel.app/)

```bash
# Install Vercel CLI
npm i -g vercel

# Login and deploy
vercel login
vercel --prod
```

### Heroku (Alternative)

```bash
# Login and create app
heroku login
heroku create cue-x-app

# Deploy
git push heroku main
```

The included `Procfile` configures **Gunicorn** as the production WSGI server:

```
web: gunicorn app:app
```

---

## ✦ Environment Variables

Create a `.env` file at the project root (never commit this):

```env
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=your-secret-key-here
```

---

## ✦ Dataset Information

### Testing Dataset Specifications
- **Filename:** `StyleSense_Dataset_updated.csv`
- **Size:** ~220KB
- **Total Records:** 1000+ customer transactions
- **Date Range:** 2023-01-24 to 2024-11-04
- **Product Categories:** Fashion & Apparel (Sneakers, Loafers, Sandals, Blazers, Jackets, etc.)
- **Seasons:** Spring, Summer, Monsoon, Autumn, Winter
- **Price Range:** ₹632 - ₹19,044

### Expected Segmentation Results
When you upload the testing dataset, the ML model will classify customers into:
- **Segment 0:** ~25% of customers (Low-Value Frequent Buyers)
- **Segment 1:** ~20% of customers (High-Value Loyal Customers)
- **Segment 2:** ~30% of customers (Lost Customers)
- **Segment 3:** ~25% of customers (Seasonal Buyers)

---

## ✦ Contributing

Contributions are welcome and appreciated! Here's how to get started:

```bash
# 1. Fork the repo
# 2. Create your feature branch
git checkout -b feature/your-amazing-feature

# 3. Make your changes and commit
git commit -m "feat: add your amazing feature"

# 4. Push and open a Pull Request
git push origin feature/your-amazing-feature
```

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## ✦ License

```
MIT License — Copyright (c) 2025 CUE-X Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files, to deal in the Software
without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software.
```

---

## ✦ Acknowledgements

- **Scikit-Learn** — for the powerful and accessible ML toolkit
- **Recharts** — for beautiful, composable React charts
- **GSAP + Framer Motion** — for buttery-smooth animations
- **Three.js** — for the immersive 3D hero experience
- **Vite** — for the blazing-fast developer experience
- **Vercel** — for seamless deployment and hosting

---

<div align="center">

```
Built with ❤️  by the CUE-X Team
Segment Smarter · Market Sharper
```

**⭐ Star this repo if CUE-X helped your project!**

**🌐 [Try the Live Demo](https://cue-x.vercel.app/)**

</div>
