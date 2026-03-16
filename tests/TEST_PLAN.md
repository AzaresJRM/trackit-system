# TrackIT Local Test Strategy (Manual + Automated)

## Scope
- Flow under test:
  - Login as User1 (Office A).
  - Create outgoing document with title, type, content, destination office, and attachment.
  - User2 (Office B) sees incoming item via polling auto-refresh.
  - User2 can use attachment action and Receive/Hold/Decline actions.
  - Logs are visible to both users.
  - Track timeline reflects status progression.

## System Mapping (implemented behavior)
- Auth: `POST /api/login` (`trackit-backend-main/routes/auth.js`)
- Create outgoing: `POST /api/documents` (`trackit-backend-main/routes/documents.js`)
- Incoming list: `GET /api/documents/incoming?office_id=...`
- Receive/Hold/Decline: `POST /api/documents/:id/action`
- Attachments upload/list/download:
  - `POST /api/documents/:id/attachments`
  - `GET /api/documents/:id/attachments`
  - `GET /api/attachments/:id/download`
- Logs: `GET /api/logs`
- Track: `GET /api/documents/search`
- Realtime mechanism: polling in `trackit-frontend/js/dashboard.js` every 4s.

## Test Data / Accounts
- Seed command (idempotent): `npm run seed` (in `trackit-backend-main`)
- Test users from seed:
  - User1: `csit_staff` / `password123` (CSIT Office)
  - User2: `vpaa_staff` / `password123` (VPAA)
- Fixture file:
  - `trackit-backend-main/tests/fixtures/sample.pdf`

## Local Setup
1. Start PostgreSQL and ensure `DATABASE_URL` is configured in backend `.env`.
2. Install backend dependencies:
   - `cd trackit-backend-main`
   - `npm install`
3. Seed baseline data:
   - `npm run seed`

## Automated Tests

### E2E (Playwright)
- Command: `npm run test:e2e`
- Test file: `trackit-backend-main/tests/e2e/document-flow.spec.js`
- What it validates:
  - Two independent browser sessions (User1 + User2).
  - Outgoing create with attachment.
  - Incoming card appears for User2 without manual refresh (polling).
  - Incoming card has `See Attachment`, `Receive`, `Hold`, `Decline`.
  - Attachment is visible/openable from incoming attachment modal.
  - Receive action updates queues.
  - Logs section shows release + receive entries for both users.
  - Track search returns timeline with `RELEASED` and `RECEIVED BY`.

### API (Jest + Supertest)
- Command: `npm run test:api`
- Test file: `trackit-backend-main/tests/api/document-flow.api.test.js`
- What it validates:
  - Create released document.
  - Upload/list/download attachment.
  - Incoming retrieval by office.
  - Receive/Hold/Decline action endpoints.
  - Logs generated for released + action transitions.
  - Track search includes status history entries.

## Manual Test Cases

### TC-M1 Login
- Steps:
  - Open `http://localhost:5500/index.html`.
  - Login as `csit_staff`.
- Expected:
  - Redirect to `user_dashboard.html`.

### TC-M2 Outgoing Create + Attachment
- Steps:
  - Open Outgoing section.
  - Create new outgoing doc to VPAA with `sample.pdf`.
- Expected:
  - Success alert appears.
  - New card appears in Outgoing list with generated document code.

### TC-M3 Incoming Auto-Update (Polling)
- Steps:
  - Keep User2 in Incoming section.
  - User1 submits outgoing to VPAA.
- Expected:
  - New incoming card appears for User2 within 4-8 seconds without manual refresh.

### TC-M4 Incoming Actions + Attachment Access
- Steps:
  - In User2 incoming card, click `See Attachment`.
  - Use `Receive` (repeat with separate docs for `Hold` and `Decline`).
- Expected:
  - Attachment list appears and file can be opened/downloaded.
  - Selected action updates status and queue placement.

### TC-M5 Logs Visibility (Both Users)
- Steps:
  - Open Logs section in User1 and User2 sessions.
- Expected:
  - Both sessions show release/action entries for the tested document flow.

### TC-M6 Track Timeline
- Steps:
  - Search Track using the generated document code.
- Expected:
  - Timeline shows ordered status history including released and action status.

## PASS Acceptance Checklist
- [ ] `npm run test:e2e` passes.
- [ ] `npm run test:api` passes.
- [ ] Incoming polling updates User2 without manual refresh.
- [ ] Incoming cards show `See Attachment`, `Receive`, `Hold`, `Decline`.
- [ ] Upload/list/download attachment flow succeeds.
- [ ] Logs visible to both users for submit and action updates.
- [ ] Track timeline displays expected status progression.
