<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1JwORH03ZOmp_EFwdk4Lhp6X1Qx7g0AVA

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run frontend only:
   `npm run dev`

## Run (frontend + backend)

This repo now includes a lightweight Node/Express backend that owns the NightfallEngine.
The frontend is an A2UI renderer that calls the backend for bootstrap + actions.

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) if you want LLM-backed bundles.
3. Run both frontend and backend:
   `npm run dev:full`

- Frontend: http://localhost:3000
- Backend: http://localhost:4000


## Skills-ready engineering shape

This PoC includes an A2UI render loop and a production-shaped backend interface (server-side):

- A2UI runtime + renderer: `a2ui/*`
- Skills runtime + policies + audit: `runtime/*`
- Stage manager adapter: `a2ui/orchestrator.ts` (thin wrapper over `runtime/nightfallEngine.ts`)

See **SKILLS_ENGINEERING.md** for the integration contract and next milestones.
