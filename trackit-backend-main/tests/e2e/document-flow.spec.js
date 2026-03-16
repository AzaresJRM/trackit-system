const { test, expect } = require('@playwright/test');
const path = require('path');

const frontendBase = 'http://127.0.0.1:5501';

async function login(page, username, password) {
  await page.goto(`${frontendBase}/index.html`);
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('#signInButton');
  await expect(page).toHaveURL(/user_dashboard\.html/);
}

test('two-user outgoing to incoming real-time flow', async ({ browser }) => {
  const attachmentPath = path.resolve(__dirname, '../fixtures/sample.pdf');
  const unique = Date.now();
  const docTitle = `PW-E2E-${unique}`;
  const docContent = `Automated flow ${unique}`;

  const user1Ctx = await browser.newContext();
  const user2Ctx = await browser.newContext();

  const user1 = await user1Ctx.newPage();
  const user2 = await user2Ctx.newPage();

  const allPages = [user1, user2];
  for (const page of allPages) {
    page.on('dialog', async (dialog) => {
      const type = dialog.type();
      if (type === 'prompt') {
        await dialog.accept('QA automated prompt input');
        return;
      }
      await dialog.accept();
    });
  }

  await login(user1, 'csit_staff', 'password123');
  await login(user2, 'vpaa_staff', 'password123');

  // Ensure User2 starts in Incoming and does not already have this doc.
  await user2.click('.nav-link[data-section="incoming"]');
  await expect(user2.locator('#incoming-container')).not.toContainText(docTitle);

  // User1 creates outgoing document for User2 office with attachment.
  await user1.click('.nav-link[data-section="outgoing"]');
  await user1.click('#outgoing-new-doc-btn');
  await user1.fill('#outgoingDocTitle', docTitle);
  await user1.selectOption('#outgoingDocType', { label: 'Memo' });
  await user1.fill('#outgoingDocContent', docContent);
  await user1.selectOption('#outgoingDocOffice', { label: 'VPAA' });
  await user1.setInputFiles('#outgoingAttachment', attachmentPath);
  await user1.click('#outgoingNewDocForm button[type="submit"]');

  const outgoingCard = user1
    .locator('#outgoing-container .document-card')
    .filter({ hasText: docTitle })
    .first();
  await expect(outgoingCard).toBeVisible();
  const documentCode = (await outgoingCard.locator('.document-code').textContent())?.trim();
  expect(documentCode).toBeTruthy();

  // User2 should see new incoming card through polling (no manual refresh).
  const incomingCard = user2
    .locator('#incoming-container .document-card')
    .filter({ hasText: docTitle })
    .first();
  await expect(incomingCard).toBeVisible({ timeout: 20_000 });

  await expect(incomingCard.getByRole('button', { name: 'See Attachment' })).toBeVisible();
  await expect(incomingCard.getByRole('button', { name: 'Receive' })).toBeVisible();
  await expect(incomingCard.getByRole('button', { name: 'Decline' })).toBeVisible();

  // Attachment should be accessible from incoming modal.
  await incomingCard.getByRole('button', { name: 'See Attachment' }).click();
  const attachmentModal = user2.locator('#incoming-attachment-modal');
  await expect(attachmentModal).toBeVisible();
  await expect(attachmentModal).toContainText('sample.pdf');
  await attachmentModal.getByRole('button', { name: 'Close' }).click();

  // Receive action updates status and removes from incoming.
  await incomingCard.getByRole('button', { name: 'Receive' }).click();
  await expect(user2.locator('#incoming-container')).not.toContainText(docTitle);

  // Logs should be visible to both sessions.
  for (const page of allPages) {
    await page.click('.nav-link[data-section="logs"]');
    const logs = page.locator('#log-container');
    await expect(logs).toContainText('TRANSFER');
    await expect(logs).toContainText('RECEIVED');
  }

  // Track should include forwarded and received history.
  await user1.click('.nav-link[data-section="track"]');
  await user1.fill('#track-doc-code', documentCode);
  await user1.click('#track-search-btn');

  const trackResults = user1.locator('#track-results');
  const trackTableContainer = user1.locator('#track-results-table-container');
  const viewInTableBtn = trackTableContainer
    .locator('tr', { hasText: documentCode })
    .locator('.track-view-btn')
    .first();

  if (await viewInTableBtn.isVisible().catch(() => false)) {
    await viewInTableBtn.click();
  }

  await expect(trackResults).toContainText(documentCode);
  await expect(user1.locator('#track-results')).toContainText('FORWARDED');
  await expect(user1.locator('#track-results')).toContainText('RECEIVED BY');

  await user1Ctx.close();
  await user2Ctx.close();
});

test('returned incoming row shows acknowledge and edit-resend actions, and acknowledge moves to received', async ({ browser }) => {
  const attachmentPath = path.resolve(__dirname, '../fixtures/sample.pdf');
  const unique = Date.now();
  const docTitle = `PW-RETURNED-${unique}`;
  const docContent = `Returned flow ${unique}`;

  const user1Ctx = await browser.newContext();
  const user2Ctx = await browser.newContext();
  const user1 = await user1Ctx.newPage();
  const user2 = await user2Ctx.newPage();

  const allPages = [user1, user2];
  for (const page of allPages) {
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        await dialog.accept('QA automated prompt input');
        return;
      }
      await dialog.accept();
    });
  }

  await login(user1, 'csit_staff', 'password123');
  await login(user2, 'vpaa_staff', 'password123');

  await user1.click('.nav-link[data-section="outgoing"]');
  await user1.click('#outgoing-new-doc-btn');
  await user1.fill('#outgoingDocTitle', docTitle);
  await user1.selectOption('#outgoingDocType', { label: 'Memo' });
  await user1.fill('#outgoingDocContent', docContent);
  await user1.selectOption('#outgoingDocOffice', { label: 'VPAA' });
  await user1.setInputFiles('#outgoingAttachment', attachmentPath);
  await user1.click('#outgoingNewDocForm button[type="submit"]');

  await user2.click('.nav-link[data-section="incoming"]');
  const incomingRowForUser2 = user2.locator('#incoming-table-body tr').filter({ hasText: docTitle }).first();
  await expect(incomingRowForUser2).toBeVisible({ timeout: 20_000 });
  await incomingRowForUser2.getByRole('button', { name: 'Receive' }).click();
  await user2.locator('#incoming-action-confirm-btn').click();

  await user2.click('.nav-link[data-section="received"]');
  const receivedRowForUser2 = user2.locator('#received-table-body tr').filter({ hasText: docTitle }).first();
  await expect(receivedRowForUser2).toBeVisible({ timeout: 20_000 });
  await receivedRowForUser2.getByRole('button', { name: 'Return' }).click();
  await user2.locator('#incoming-action-remarks-input').fill('Returning for sender acknowledgment');
  await user2.locator('#incoming-action-confirm-btn').click();

  await user1.click('.nav-link[data-section="incoming"]');
  const returnedIncomingRowForUser1 = user1.locator('#incoming-table-body tr').filter({ hasText: docTitle }).first();
  await expect(returnedIncomingRowForUser1).toBeVisible({ timeout: 20_000 });
  await expect(returnedIncomingRowForUser1.getByRole('button', { name: 'Acknowledge / Receive Returned' })).toBeVisible();
  await expect(returnedIncomingRowForUser1.getByRole('button', { name: 'Edit & Resend' })).toBeVisible();

  await returnedIncomingRowForUser1.getByRole('button', { name: 'Acknowledge / Receive Returned' }).click();
  await user1.locator('#incoming-action-confirm-btn').click();

  await expect(user1.locator('#incoming-table-body')).not.toContainText(docTitle);
  await user1.click('.nav-link[data-section="received"]');
  await expect(user1.locator('#received-table-body')).toContainText(docTitle);

  await user1Ctx.close();
  await user2Ctx.close();
});
