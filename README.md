# Skylark Drones - BI Dashboard & AI Executive Assistant

Production-grade Business Intelligence dashboard and conversational AI leadership agent for Skylark Drones. Integrates real-time Monday.com sales pipeline and operations work orders, data quality scoring, metrics calculation, and AI-powered executive report generation.

## Features

- **Real-Time Monday.com Synchronization**: Syncs Deals and Work Orders boards with automated column auto-discovery.
- **Deterministic Business Metrics Engine**: Calculates pipeline value, won revenue, win rates, operational completion rates, duration averages, and delayed work order tracking without AI hallucination.
- **AI Executive Assistant**:
  - 1-Click Executive Analysis Generation (Insights, Opportunities, Risks with severity, Recommendations).
  - 1-Click Leadership Update (Key numbers, Wins, Attention areas, Priority action items).
  - Interactive Conversational Founder QA Agent powered by Gemini AI.
- **Data Quality Scorecard**: Automatic schema validation, unparsable financial detection, missing dates identification, and missing customer links tracking.

## Environment Configuration

Create a `.env` file in the root directory:

```env
MONDAY_API_TOKEN=your_monday_api_token
MONDAY_DEALS_BOARD_ID=5030968518
MONDAY_WORK_ORDERS_BOARD_ID=5030968512
GEMINI_API_KEY=your_gemini_api_key
```

## Development

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

Build for production:

```sh
npm run build
```
