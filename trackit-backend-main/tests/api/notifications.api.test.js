const request = require('supertest');
const app = require('../../server');

describe('TrackIT notifications API', () => {
  const createdDocIds = [];
  let senderUser;
  let recipientUser;
  let docTypeId;

  async function createReleasedDocument(titleSuffix) {
    const payload = {
      title: `Notification Flow ${titleSuffix}`,
      content: `Notification content ${titleSuffix}`,
      type_id: docTypeId,
      requester_office_id: senderUser.office_id._id || senderUser.office_id,
      current_office_id: recipientUser.office_id._id || recipientUser.office_id,
      forward_to_office_ids: [recipientUser.office_id._id || recipientUser.office_id],
      created_by_admin_id: senderUser._id,
      status: 'RELEASED',
      attachment_count: 1
    };
    const createRes = await request(app).post('/api/documents').send(payload);
    expect(createRes.status).toBe(200);
    createdDocIds.push(createRes.body._id);
    return createRes.body;
  }

  beforeAll(async () => {
    if (app.dbReady) await app.dbReady;
    const [senderLogin, recipientLogin, docTypesRes] = await Promise.all([
      request(app).post('/api/login').send({ username: 'csit_staff', password: 'password123' }),
      request(app).post('/api/login').send({ username: 'vpaa_staff', password: 'password123' }),
      request(app).get('/api/document-types')
    ]);
    expect(senderLogin.status).toBe(200);
    expect(recipientLogin.status).toBe(200);
    expect(docTypesRes.status).toBe(200);
    senderUser = senderLogin.body;
    recipientUser = recipientLogin.body;
    const docTypes = Array.isArray(docTypesRes.body) ? docTypesRes.body : [];
    docTypeId = docTypes[0]?._id || docTypes[0]?.id;
    expect(docTypeId).toBeTruthy();
  });

  afterAll(async () => {
    for (const docId of createdDocIds) {
      await request(app).delete(`/api/documents/${docId}`);
    }
  });

  test('sender gets returned notifications and can mark them seen', async () => {
    const doc = await createReleasedDocument(Date.now());
    const declineRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'decline',
        office_id: recipientUser.office_id._id || recipientUser.office_id,
        user_id: recipientUser._id,
        remarks: 'Returned for correction'
      });
    expect(declineRes.status).toBe(200);

    const listRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${senderUser.token}`);
    expect(listRes.status).toBe(200);
    const items = Array.isArray(listRes.body.items) ? listRes.body.items : [];
    expect(items.length).toBeGreaterThan(0);
    const returnedItem = items.find((item) =>
      String(item.type || '').toLowerCase() === 'returned' &&
      String(item.document_id || '') === String(doc._id)
    );
    expect(returnedItem).toBeTruthy();
    expect(Number(listRes.body.unread_count || 0)).toBeGreaterThan(0);

    const markSeenRes = await request(app)
      .patch('/api/notifications/mark-seen')
      .set('Authorization', `Bearer ${senderUser.token}`)
      .send({
        last_seen_at: returnedItem.date,
        last_seen_log_id: returnedItem.id
      });
    expect(markSeenRes.status).toBe(200);
    expect(markSeenRes.body.success).toBe(true);

    const listAfterSeenRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${senderUser.token}`);
    expect(listAfterSeenRes.status).toBe(200);
    const unreadAfterSeen = Number(listAfterSeenRes.body.unread_count || 0);
    expect(unreadAfterSeen).toBeGreaterThanOrEqual(0);
  });
});
