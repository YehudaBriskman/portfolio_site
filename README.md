
# Yehuda Briskman — Personal Portfolio Website

A full-stack **portfolio site** showcasing my work, skills, and projects as a **Full-Stack Developer & Team Leader**.  
It combines high-performance frontend animations (Three.js, Framer Motion, Tailwind) with a minimal backend that serves static images and will later handle contact emails.

---

## Project Overview

### Frontend (Main Application)
- **React + Vite + TypeScript**
- **TailwindCSS** for modern styling
- **Framer Motion** for smooth animations and transitions
- **Three.js / WebGL** for interactive 3D visuals
- **Lazy image loading** from API using `LazyApiImage`
- Organized data structure for:
  - Projects
  - Skills
  - Hero, About, Contact, and more sections

### Backend (Support API)
- **Node.js + Express**
- **TypeScript**
- **CORS + dotenv**
- Handles:
  - `GET /api/images/:imageId` → Serves project images from `/uploads`
  - (Future) `POST /api/contact` → Send emails from contact form
- Includes **request logger middleware** with status/time per request

---

## older Structure

```
root/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   └── images.controller.ts
│   │   ├── middleware/
│   │   │   └── logger.ts
│   │   ├── models/
│   │   │   └── portfolioItem.ts
│   │   ├── routes/
│   │   │   └── images.route.ts
│   │   ├── services/
│   │   │   └── images.service.ts
│   │   ├── types/
│   │   └── server.ts
│   ├── uploads/
│   └── package.json
│
├── glassglow-folio-space/            # frontend (React + Vite)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/
│   │   │       ├── AboutSection.tsx
│   │   │       ├── ContactSection.tsx
│   │   │       ├── HeroSection.tsx
│   │   │       ├── LazyApiImage.tsx
│   │   │       ├── Navigation.tsx
│   │   │       ├── ParticleSystem.tsx
│   │   │       ├── ProjectsSection.tsx
│   │   │       ├── SkillsSection.tsx
│   │   │       ├── ThemeToggle.tsx
│   │   │       └── ThreeScene.tsx
│   │   ├── data/
│   │   ├── hooks/
│   │   │   ├── use-mobile.tsx
│   │   │   └── use-toast.ts
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   ├── pages/
│   │   │   ├── Index.tsx
│   │   │   └── NotFound.tsx
│   │   ├── App.tsx
│   │   ├── App.css
│   │   └── index.css
│   ├── vite.config.ts
│   └── package.json
│
└── README.md
````

---

## Backend Endpoints

| Method | Route | Description |
| ------- | ------ | ------------ |
| `GET` | `/api/images/:imageId` | Streams an image by name (e.g. `icaros.png`) |
| `GET` | `/health` | Health check |
| (Future) `POST` | `/api/contact` | Send email messages from contact form |

The backend simply serves the portfolio images stored locally in `uploads/`.

---

## Environment Variables

Create `.env` in the backend root:

```bash
PORT=5000
NODE_ENV=development
JWT_SECRET=><Futuer_needed>
UPLOADS_DIR=src/uploads/
````

Frontend `.env.development`:

```
VITE_API_TARGET=http://localhost:5000
```

---

## Local Development

1. **Backend**

   ```bash
   cd backend
   npm install --save-dev --legacy-peer-deps
   npm start
   ```

2. **Frontend**

   ```bash
   cd frontend
   npm install --save-dev --legacy-peer-deps
   npm run dev
   ```

   Runs on [http://localhost:8080](http://localhost:8080)

---

## Tech Summary

| Category | Tech                                                         |
| -------- | ------------------------------------------------------------ |
| Frontend | React, Vite, TypeScript, Tailwind, Framer Motion, Three.js   |
| Backend  | Node.js, Express, TypeScript                                 |
| Tools    | Docker (optional), AWS (future), Netlify/Vercel (deployment) |
| Other    | Lazy Loading, Clean Architecture, Modern UI/UX               |

---

## Logging Example

Backend logs every request:

```
[2025-11-03T09:15:04.421Z] GET /api/images/icaros.png → 200 27ms
[2025-11-03T09:15:09.033Z] GET /health → 200 3ms
```

---

## Deployment Options

* **Frontend:** Vercel / Netlify
* **Backend:** Render / Railway / Fly.io
  → Update frontend `.env` → `VITE_API_TARGET=https://your-api-domain.com`

---

## Future Plans

* Contact form with email sending (NodeMailer / SendGrid)
* Image CDN optimization (Cloudflare R2 or S3)
* 3D interactive homepage
* Multi-language support (i18next)
* Blog section with markdown articles

---

## Author

**Yehuda Briskman**
📍 Tel Aviv, Israel
📧 [yr0556772363@gmail.com](mailto:yr0556772363@gmail.com)
💼 [LinkedIn](https://www.linkedin.com/in/yehuda-briskman-ab923b2b8) · [GitHub](https://github.com/YehudaBriskman) · [Portfolio (Local)](http://localhost:8080)
   npm install
   npm install