const request = require('supertest');
const app = require('../../server');

describe('TrackIT reports buckets for multi-recipient dissemination', () => {
  const createdDocIds = [];
  let senderUser;
  let recipientUser;
  let docTypeId;
  let registrarOfficeId;

  async function createMultiReleasedDocument(titleSuffix) {
    const payload = {
      title: `Reports Multi ${titleSuffix}`,
      content: `Reports content ${titleSuffix}`,
      type_id: docTypeId,
      requester_office_id: senderUser.office_id._id || senderUser.office_id,
      current_office_id: recipientUser.office_id._id || recipientUser.office_id,
      forward_to_office_ids: [recipientUser.office_id._id || recipientUser.office_id, registrarOfficeId],
      created_by_admin_id: senderUser._id,
      status: 'RELEASED',
      attachment_count: 2
    };
    const createRes = await request(app).post('/api/documents').send(payload);
    expect(createRes.status).toBe(200);
    createdDocIds.push(createRes.body._id);
    return createRes.body;
  }

  beforeAll(async () => {
    if (app.dbReady) await app.dbReady;

    const [senderLogin, recipientLogin, docTypesRes, officesRes] = await Promise.all([
      request(app).post('/api/login').send({ username: 'csit_staff', password: 'password123' }),
      request(app).post('/api/login').send({ username: 'vpaa_staff', password: 'password123' }),
      request(app).get('/api/document-types'),
      request(app).get('/api/offices')
    ]);
    expect(senderLogin.status).toBe(200);
    expect(recipientLogin.status).toBe(200);
    expect(docTypesRes.status).toBe(200);
    expect(officesRes.status).toBe(200);

    senderUser = senderLogin.body;
    recipientUser = recipientLogin.body;

    const docTypes = Array.isArray(docTypesRes.body) ? docTypesRes.body : [];
    docTypeId = docTypes[0]?._id || docTypes[0]?.id;
    expect(docTypeId).toBeTruthy();

    const offices = Array.isArray(officesRes.body) ? officesRes.body : [];
    const registrar = offices.find((o) => String(o.office_name || '').toLowerCase().includes('registrar'));
    registrarOfficeId = registrar ? (registrar._id || registrar.id) : null;
    expect(registrarOfficeId).toBeTruthy();
  });

  afterAll(async () => {
    for (const docId of createdDocIds) {
      await request(app).delete(`/api/documents/${docId}`);
    }
  });

  test('created bucket shows sender and handled bucket shows recipient office', async () => {
    const doc = await createMultiReleasedDocument(Date.now());

    const createdReportRes = await request(app)
      .get('/api/reports/my-office?datePreset=last7')
      .set('Authorization', `Bearer ${senderUser.token}`);
    expect(createdReportRes.status).toBe(200);
    const createdDocs = Array.isArray(createdReportRes.body.created_documents)
      ? createdReportRes.body.created_documents
      : [];
    expect(createdDocs.some((d) => d.id === doc._id)).toBe(true);

    const handledReportRes = await request(app)
      .get('/api/reports/my-office?datePreset=last7')
      .set('Authorization', `Bearer ${recipientUser.token}`);
    expect(handledReportRes.status).toBe(200);
    const handledDocs = Array.isArray(handledReportRes.body.handled_documents)
      ? handledReportRes.body.handled_documents
      : [];
    const handledDoc = handledDocs.find((d) => d.id === doc._id);
    expect(handledDoc).toBeTruthy();
    const timeline = Array.isArray(handledDoc.timeline) ? handledDoc.timeline : [];
    expect(
      timeline.some((row) => String(row.status || '').toUpperCase().includes('FORWARDED BY'))
    ).toBe(true);
  });

  test('sender report lifecycle prefers RETURNED after decline flow', async () => {
    const doc = await createMultiReleasedDocument(`RETURNED-${Date.now()}`);
    const recipientOfficeId = recipientUser.office_id._id || recipientUser.office_id;

    const declineRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'decline',
        office_id: recipientOfficeId,
        user_id: recipientUser._id,
        remarks: 'Returned from recipient for revision'
      });
    expect(declineRes.status).toBe(200);

    const createdReportRes = await request(app)
      .get('/api/reports/my-office?datePreset=last7')
      .set('Authorization', `Bearer ${senderUser.token}`);
    expect(createdReportRes.status).toBe(200);

    const createdDocs = Array.isArray(createdReportRes.body.created_documents)
      ? createdReportRes.body.created_documents
      : [];
    const reportDoc = createdDocs.find((d) => String(d.id) === String(doc._id));
    expect(reportDoc).toBeTruthy();
    expect(String(reportDoc.current_status || '').toUpperCase()).toBe('RETURNED');
  });
});
