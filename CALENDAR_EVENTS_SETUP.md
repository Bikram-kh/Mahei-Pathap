# Calendar events setup

The calendar works immediately with browser storage. Complete these steps once to sync events through Appwrite and let them follow each signed-in student across devices.

## 1. Create the collection

Use an Appwrite API key with database and collection permissions only in a trusted terminal:

```bash
export APPWRITE_ENDPOINT="https://sgp.cloud.appwrite.io/v1"
export APPWRITE_PROJECT_ID="your-project-id"
export APPWRITE_DATABASE_ID="your-database-id"
export APPWRITE_API_KEY="your-temporary-setup-key"
npm run setup:calendar
```

The script creates the `calendar-events` collection with document security, private per-user document permissions, its attributes, and the required query index. Delete or revoke the temporary setup key afterward.

## 2. Enable it in the web app

Add this to `.env` and restart Vite:

```dotenv
VITE_APPWRITE_CALENDAR_EVENTS_COLLECTION_ID=calendar-events
```

## 3. Deploy Mahei Assistance

Deploy both updated functions from their folders, or upload the ready archives from `deployments/` in Appwrite Console:

- `mahei-ai-agent-calendar-events.tar.gz`
- `mahei-ai-coach-calendar-events.tar.gz`

Keep each function's entrypoint set to `src/main.js`. The Agent function creates events; the Coach function reads events when answering schedule questions.
