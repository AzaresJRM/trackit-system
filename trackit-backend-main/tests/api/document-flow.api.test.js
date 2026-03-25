const path = require('path');
const request = require('supertest');
const app = require('../../server');

describe('TrackIT document flow API', () => {
  const createdDocs = [];
  let user1;
  let user2;
  let docTypeId;
  let registrarOfficeId;
  const samplePdfPath = path.resolve(__dirname, '../fixtures/sample.pdf');

  function getOfficeId(user) {
    return user?.office_id?._id || user?.office_id;
  }

  function trackCreatedDocument(docId, ownerToken) {
    if (!docId) return;
    createdDocs.push({ id: docId, ownerToken: ownerToken || null });
  }

  async function createReleasedDocumentFromSender(senderUser, titleSuffix, destinationOfficeIds) {
    const recipientIds = Array.isArray(destinationOfficeIds) && destinationOfficeIds.length
      ? destinationOfficeIds
      : [getOfficeId(user2)];
    const payload = {
      title: `API Flow ${titleSuffix}`,
      content: `Automated content ${titleSuffix}`,
      type_id: docTypeId,
      requester_office_id: getOfficeId(senderUser),
      current_office_id: recipientIds[0],
      forward_to_office_id: recipientIds.length === 1 ? recipientIds[0] : null,
      forward_to_office_ids: recipientIds,
      created_by_admin_id: senderUser?._id,
      status: 'RELEASED',
      attachment_count: 1
    };

    const createRes = await request(app).post('/api/documents').send(payload);
    expect(createRes.status).toBe(200);
    const doc = createRes.body;
    trackCreatedDocument(doc._id, senderUser?.token);
    return doc;
  }

  async function createReleasedDocument(titleSuffix, destinationOfficeIds) {
    return createReleasedDocumentFromSender(user1, titleSuffix, destinationOfficeIds);
  }

  beforeAll(async () => {
    if (app.dbReady) {
      await app.dbReady;
    }

    const [login1, login2, docTypesRes, officesRes] = await Promise.all([
      request(app).post('/api/login').send({ username: 'csit_staff', password: 'password123' }),
      request(app).post('/api/login').send({ username: 'vpaa_staff', password: 'password123' }),
      request(app).get('/api/document-types'),
      request(app).get('/api/offices')
    ]);

    expect(login1.status).toBe(200);
    expect(login2.status).toBe(200);
    expect(docTypesRes.status).toBe(200);
    expect(officesRes.status).toBe(200);

    user1 = login1.body;
    user2 = login2.body;

    const docTypes = Array.isArray(docTypesRes.body) ? docTypesRes.body : [];
    const memoType = docTypes.find(
      (t) => String(t.type_name || '').toLowerCase() === 'memorandum'
    );
    docTypeId = memoType ? memoType._id || memoType.id : docTypes[0]?._id || docTypes[0]?.id;
    expect(docTypeId).toBeTruthy();

    const offices = Array.isArray(officesRes.body) ? officesRes.body : [];
    const registrar = offices.find((o) => String(o.office_name || '').toLowerCase().includes('registrar'));
    registrarOfficeId = registrar ? (registrar._id || registrar.id) : null;
    expect(registrarOfficeId).toBeTruthy();
  });

  afterAll(async () => {
    for (const docMeta of createdDocs) {
      if (!docMeta?.id) continue;
      let deleteReq = request(app).delete(`/api/documents/${docMeta.id}`);
      if (docMeta.ownerToken) {
        deleteReq = deleteReq.set('Authorization', `Bearer ${docMeta.ownerToken}`);
      }
      await deleteReq;
    }
  });

  test('create released doc, upload attachment, and retrieve incoming + download', async () => {
    const unique = Date.now();
    const doc = await createReleasedDocument(unique);

    const uploadRes = await request(app)
      .post(`/api/documents/${doc._id}/attachments`)
      .attach('files[]', samplePdfPath);
    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.success).toBe(true);
    expect(Array.isArray(uploadRes.body.attachments)).toBe(true);
    expect(uploadRes.body.attachments.length).toBeGreaterThan(0);

    const incomingRes = await request(app)
      .get('/api/documents/incoming')
      .query({ office_id: user2.office_id._id || user2.office_id });
    expect(incomingRes.status).toBe(200);
    const incoming = Array.isArray(incomingRes.body) ? incomingRes.body : [];
    expect(incoming.some((d) => d._id === doc._id)).toBe(true);

    const listAttachmentsRes = await request(app)
      .get(`/api/documents/${doc._id}/attachments`)
      .set('Authorization', `Bearer ${user2.token}`);
    expect(listAttachmentsRes.status).toBe(200);
    const list = listAttachmentsRes.body.attachments || [];
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].url).toContain('/api/attachments/');
    expect(list[0].previewUrl).toContain('/api/attachments/');
    expect(list[0].downloadUrl).toContain('/api/attachments/');

    const attachmentId = uploadRes.body.attachments[0].id;
    const downloadRes = await request(app)
      .get(`/api/attachments/${attachmentId}/download`)
      .set('Authorization', `Bearer ${user2.token}`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-disposition']).toContain('sample.pdf');

    const previewRes = await request(app)
      .get(`/api/attachments/${attachmentId}/preview`)
      .set('Authorization', `Bearer ${user2.token}`);
    expect(previewRes.status).toBe(200);
    expect(String(previewRes.headers['content-disposition'] || '').toLowerCase()).toContain('inline');
  });

  test('released create validates required attachment count bounds', async () => {
    const recipientId = user2.office_id._id || user2.office_id;
    const basePayload = {
      title: `ATTACHMENT-COUNT-${Date.now()}`,
      content: 'Attachment count validation',
      type_id: docTypeId,
      requester_office_id: user1.office_id._id || user1.office_id,
      current_office_id: recipientId,
      forward_to_office_id: recipientId,
      forward_to_office_ids: [recipientId],
      created_by_admin_id: user1._id,
      status: 'RELEASED'
    };

    const missingCountRes = await request(app)
      .post('/api/documents')
      .send({ ...basePayload, attachment_count: 0 });
    expect(missingCountRes.status).toBe(400);

    const excessiveCountRes = await request(app)
      .post('/api/documents')
      .send({ ...basePayload, attachment_count: 6 });
    expect(excessiveCountRes.status).toBe(400);
  });

  test('accepts .doc upload and rejects exceeding max attachments', async () => {
    const doc = await createReleasedDocument(`DOC-UPLOAD-${Date.now()}`);

    const wordUploadRes = await request(app)
      .post(`/api/documents/${doc._id}/attachments`)
      .attach('files[]', Buffer.from('legacy-word-content'), {
        filename: 'sample.doc',
        contentType: 'application/msword'
      });
    expect(wordUploadRes.status).toBe(200);
    expect(wordUploadRes.body.success).toBe(true);

    let tooManyReq = request(app).post(`/api/documents/${doc._id}/attachments`);
    for (let i = 0; i < 5; i += 1) {
      tooManyReq = tooManyReq.attach('files[]', samplePdfPath);
    }
    const tooManyRes = await tooManyReq;
    expect(tooManyRes.status).toBe(400);
    expect(String(tooManyRes.body.error || '').toLowerCase()).toContain('up to 5');
  });

  test('sender can remove and replace attachments on same document', async () => {
    const doc = await createReleasedDocument(`ATTACH-EDIT-${Date.now()}`);

    const firstUploadRes = await request(app)
      .post(`/api/documents/${doc._id}/attachments`)
      .attach('files[]', samplePdfPath);
    expect(firstUploadRes.status).toBe(200);
    const firstAttachmentId = firstUploadRes.body.attachments?.[0]?.id;
    expect(firstAttachmentId).toBeTruthy();

    const removeRes = await request(app)
      .delete(`/api/documents/${doc._id}/attachments/${firstAttachmentId}`)
      .set('Authorization', `Bearer ${user1.token}`);
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.success).toBe(true);

    const replacementUploadRes = await request(app)
      .post(`/api/documents/${doc._id}/attachments`)
      .attach('files[]', Buffer.from('replacement-pdf-content'), {
        filename: 'replacement.pdf',
        contentType: 'application/pdf'
      });
    expect(replacementUploadRes.status).toBe(200);

    const listRes = await request(app)
      .get(`/api/documents/${doc._id}/attachments`)
      .set('Authorization', `Bearer ${user1.token}`);
    expect(listRes.status).toBe(200);
    const listed = Array.isArray(listRes.body.attachments) ? listRes.body.attachments : [];
    expect(listed.some((item) => String(item.name || '').toLowerCase() === 'replacement.pdf')).toBe(true);
  });

  test('create released doc with multiple recipients and write one log per recipient', async () => {
    const multiRecipients = [user2.office_id._id || user2.office_id, registrarOfficeId];
    const doc = await createReleasedDocument(`MULTI-${Date.now()}`, multiRecipients);

    const vpaaIncomingRes = await request(app)
      .get('/api/documents/incoming')
      .query({ office_id: user2.office_id._id || user2.office_id });
    expect(vpaaIncomingRes.status).toBe(200);
    const vpaaIncoming = Array.isArray(vpaaIncomingRes.body) ? vpaaIncomingRes.body : [];
    expect(vpaaIncoming.some((d) => d._id === doc._id)).toBe(true);

    const registrarIncomingRes = await request(app)
      .get('/api/documents/incoming')
      .query({ office_id: registrarOfficeId });
    expect(registrarIncomingRes.status).toBe(200);
    const registrarIncoming = Array.isArray(registrarIncomingRes.body) ? registrarIncomingRes.body : [];
    expect(registrarIncoming.some((d) => d._id === doc._id)).toBe(true);

    const incomingMatch = vpaaIncoming.find((d) => d._id === doc._id);
    expect(incomingMatch?.content).toBe(doc.content);

    const timelineRes = await request(app).get(`/api/documents/${doc._id}/timeline`);
    expect(timelineRes.status).toBe(200);
    expect(timelineRes.body.title).toBe(doc.title);
    expect(timelineRes.body.content).toBe(doc.content);
    expect(timelineRes.body.type_name).toBeTruthy();
    const timeline = Array.isArray(timelineRes.body.timeline) ? timelineRes.body.timeline : [];
    const forwardRows = timeline.filter((row) =>
      String(row.status || '').toUpperCase().includes('FORWARDED BY')
    );
    expect(forwardRows.length).toBeGreaterThanOrEqual(2);
  });

  test('receive action writes logs and track status history', async () => {
    const unique = Date.now();
    const doc = await createReleasedDocument(unique);

    const receiveRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'receive',
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id,
        remarks: 'API receive test'
      });
    expect(receiveRes.status).toBe(200);
    expect(receiveRes.body.success).toBe(true);

    const logsRes = await request(app).get('/api/logs');
    expect(logsRes.status).toBe(200);
    const logs = Array.isArray(logsRes.body) ? logsRes.body : [];
    const hasReleaseOrTransferLog = logs.some(
      (l) =>
        String(l.action_type || '').toUpperCase().includes('RELEASED') ||
        String(l.action_type || '').toUpperCase().includes('TRANSFER')
    );
    const hasReceiveLog = logs.some((l) =>
      String(l.action_type || '').toUpperCase().includes('RECEIVED BY')
    );
    expect(hasReleaseOrTransferLog).toBe(true);
    expect(hasReceiveLog).toBe(true);

    const searchRes = await request(app).get('/api/documents/search').query({
      document_code: doc.document_code
    });
    expect(searchRes.status).toBe(200);
    const found = Array.isArray(searchRes.body) ? searchRes.body.find((d) => d._id === doc._id) : null;
    expect(found).toBeTruthy();
    const statuses = (found.status_history || []).map((h) => String(h.status || '').toUpperCase());
    expect(statuses.some((s) => s.includes('FORWARDED BY'))).toBe(true);
    expect(statuses.some((s) => s.includes('RECEIVED BY'))).toBe(true);
  });

  test('hold action is rejected and receive/decline/return require remarks for recipient lifecycle', async () => {
    const declineDoc = await createReleasedDocument(`DECLINE-${Date.now()}`);

    const holdRes = await request(app)
      .post(`/api/documents/${declineDoc._id}/action`)
      .send({
        action: 'hold',
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id,
        remarks: ''
      });
    expect(holdRes.status).toBe(400);

    const declineMissingRemarksRes = await request(app)
      .post(`/api/documents/${declineDoc._id}/action`)
      .send({
        action: 'decline',
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id
      });
    expect(declineMissingRemarksRes.status).toBe(400);

    const receiveMissingRemarksRes = await request(app)
      .post(`/api/documents/${declineDoc._id}/action`)
      .send({
        action: 'receive',
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id
      });
    expect(receiveMissingRemarksRes.status).toBe(400);

    const declineRes = await request(app)
      .post(`/api/documents/${declineDoc._id}/action`)
      .send({
        action: 'decline',
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id,
        remarks: 'Missing required fields from requester'
      });
    expect(declineRes.status).toBe(200);
    expect(String(declineRes.body.document.status || '').toUpperCase()).toContain('RETURNED TO');
    const declinedDoc = declineRes.body.document;
    const latestStatus = (declinedDoc.status_history || [])[declinedDoc.status_history.length - 1];
    expect(String(latestStatus?.remarks || '')).toBe('Missing required fields from requester');

    const senderIncomingRes = await request(app)
      .get('/api/documents/incoming')
      .query({ office_id: user1.office_id._id || user1.office_id });
    expect(senderIncomingRes.status).toBe(200);
    const senderIncomingDocs = Array.isArray(senderIncomingRes.body) ? senderIncomingRes.body : [];
    const returnedDoc = senderIncomingDocs.find((d) => d._id === declineDoc._id);
    expect(returnedDoc).toBeTruthy();
    const senderRecipient = Array.isArray(returnedDoc.recipients)
      ? returnedDoc.recipients.find(
        (r) => String(r.recipient_office_id?._id || r.recipient_office_id || '') === String(user1.office_id._id || user1.office_id)
      )
      : null;
    expect(String(senderRecipient?.recipient_status || '').toUpperCase()).toBe('RETURNED');

    const returnDoc = await createReleasedDocument(`RETURN-${Date.now()}`);
    const receiveRes = await request(app)
      .post(`/api/documents/${returnDoc._id}/action`)
      .send({
        action: 'receive',
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id,
        remarks: 'Receive before return checks'
      });
    expect(receiveRes.status).toBe(200);

    const declineAfterReceiveRes = await request(app)
      .post(`/api/documents/${returnDoc._id}/action`)
      .send({
        action: 'decline',
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id,
        remarks: 'Should now use return action'
      });
    expect(declineAfterReceiveRes.status).toBe(409);
    expect(String(declineAfterReceiveRes.body.current_phase || '').toUpperCase()).toBe('RECEIVED');

    const returnMissingRemarksRes = await request(app)
      .post(`/api/documents/${returnDoc._id}/action`)
      .send({
        action: 'return',
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id
      });
    expect(returnMissingRemarksRes.status).toBe(400);

    const returnRes = await request(app)
      .post(`/api/documents/${returnDoc._id}/action`)
      .send({
        action: 'return',
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id,
        remarks: 'Returning to sender after review'
      });
    expect(returnRes.status).toBe(200);
    expect(String(returnRes.body.document.status || '').toUpperCase()).toContain('RETURNED TO');
  });

  test('timeline remains chronological and clear for receive -> return', async () => {
    const doc = await createReleasedDocument(`TIMELINE-ORDER-${Date.now()}`);

    const receiveRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'receive',
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id,
        remarks: 'Received for timeline ordering test'
      });
    expect(receiveRes.status).toBe(200);

    const returnRemarks = 'Returned due to missing approval details';
    const returnRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'return',
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id,
        remarks: returnRemarks
      });
    expect(returnRes.status).toBe(200);

    const timelineRes = await request(app).get(`/api/documents/${doc._id}/timeline`);
    expect(timelineRes.status).toBe(200);
    const timeline = Array.isArray(timelineRes.body.timeline) ? timelineRes.body.timeline : [];
    expect(timeline.length).toBeGreaterThan(0);

    for (let i = 1; i < timeline.length; i += 1) {
      const prevTime = new Date(timeline[i - 1].date).getTime();
      const currentTime = new Date(timeline[i].date).getTime();
      expect(Number.isFinite(prevTime)).toBe(true);
      expect(Number.isFinite(currentTime)).toBe(true);
      expect(currentTime).toBeGreaterThanOrEqual(prevTime);
    }

    const normalizedStatuses = timeline.map((row) => String(row.status || '').toUpperCase());
    const receivedIndex = normalizedStatuses.findIndex((s) => s.includes('RECEIVED BY'));
    const returnedIndex = normalizedStatuses.findIndex((s) => s.includes('RETURNED TO'));

    expect(receivedIndex).toBeGreaterThanOrEqual(0);
    expect(returnedIndex).toBeGreaterThanOrEqual(0);
    expect(returnedIndex).toBeGreaterThan(receivedIndex);

    const returnedRow = timeline[returnedIndex];
    expect(String(returnedRow?.remarks || '')).toBe(returnRemarks);
    expect(String(returnedRow?.status || '').toUpperCase()).toContain('RETURNED TO');
  });

  test('return routing ignores non-routing attachment logs and never returns to self across office pairs', async () => {
    const officeA = { user: user1, officeId: getOfficeId(user1) };
    const officeB = { user: user2, officeId: getOfficeId(user2) };
    const scenarios = [
      { sender: officeA, recipient: officeB, label: 'A_TO_B' },
      { sender: officeB, recipient: officeA, label: 'B_TO_A' }
    ];

    for (const scenario of scenarios) {
      const doc = await createReleasedDocumentFromSender(
        scenario.sender.user,
        `RETURN-NO-SELF-${scenario.label}-${Date.now()}`,
        [scenario.recipient.officeId]
      );

      const senderUploadRes = await request(app)
        .post(`/api/documents/${doc._id}/attachments`)
        .set('Authorization', `Bearer ${scenario.sender.user.token}`)
        .attach('files[]', samplePdfPath);
      expect(senderUploadRes.status).toBe(200);
      const initialAttachmentId = senderUploadRes.body.attachments?.[0]?.id;
      expect(initialAttachmentId).toBeTruthy();

      const receiveRes = await request(app)
        .post(`/api/documents/${doc._id}/action`)
        .send({
          action: 'receive',
          office_id: scenario.recipient.officeId,
          user_id: scenario.recipient.user._id,
          remarks: `Receive ${scenario.label}`
        });
      expect(receiveRes.status).toBe(200);

      const receivedAttachmentEditRes = await request(app)
        .post(`/api/documents/${doc._id}/received-attachments`)
        .set('Authorization', `Bearer ${scenario.recipient.user.token}`)
        .field('remove_attachment_ids', JSON.stringify([initialAttachmentId]))
        .field('remarks', `Attachment update ${scenario.label}`)
        .attach('files[]', Buffer.from(`replacement-${scenario.label}`), {
          filename: `replacement-${scenario.label}.pdf`,
          contentType: 'application/pdf'
        });
      expect(receivedAttachmentEditRes.status).toBe(200);

      const returnRes = await request(app)
        .post(`/api/documents/${doc._id}/action`)
        .send({
          action: 'return',
          office_id: scenario.recipient.officeId,
          user_id: scenario.recipient.user._id,
          remarks: `Return ${scenario.label}`
        });
      expect(returnRes.status).toBe(200);
      const returnedDoc = returnRes.body.document || {};
      const returnedOfficeId = String(returnedDoc.current_office_id?._id || returnedDoc.current_office_id || '');
      expect(returnedOfficeId).toBe(String(scenario.sender.officeId));
      expect(returnedOfficeId).not.toBe(String(scenario.recipient.officeId));

      const timelineRes = await request(app).get(`/api/documents/${doc._id}/timeline`);
      expect(timelineRes.status).toBe(200);
      const timeline = Array.isArray(timelineRes.body.timeline) ? timelineRes.body.timeline : [];
      const returnedRows = timeline.filter((row) => String(row.status || '').toUpperCase().includes('RETURNED'));
      expect(returnedRows.length).toBeGreaterThan(0);
      const latestReturned = returnedRows[returnedRows.length - 1];
      const fromOfficeId = String(latestReturned?.from_office?.id || '');
      const toOfficeId = String(latestReturned?.to_office?.id || '');
      expect(fromOfficeId).toBe(String(scenario.recipient.officeId));
      expect(toOfficeId).toBe(String(scenario.sender.officeId));
      expect(fromOfficeId).not.toBe(toOfficeId);
    }
  });

  test('returned document can be acknowledged without remarks and moves incoming to received with audit log', async () => {
    const senderOfficeId = getOfficeId(user1);
    const recipientOfficeId = getOfficeId(user2);
    const doc = await createReleasedDocument(`ACK-RETURNED-${Date.now()}`, [recipientOfficeId]);

    const receiveRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'receive',
        office_id: recipientOfficeId,
        user_id: user2._id,
        remarks: 'Initial receive before return'
      });
    expect(receiveRes.status).toBe(200);

    const returnRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'return',
        office_id: recipientOfficeId,
        user_id: user2._id,
        remarks: 'Returning to sender for acknowledgement test'
      });
    expect(returnRes.status).toBe(200);

    const senderIncomingBeforeAckRes = await request(app)
      .get('/api/documents/incoming')
      .query({ office_id: senderOfficeId });
    expect(senderIncomingBeforeAckRes.status).toBe(200);
    const senderIncomingBeforeAck = Array.isArray(senderIncomingBeforeAckRes.body) ? senderIncomingBeforeAckRes.body : [];
    expect(senderIncomingBeforeAck.some((d) => String(d._id || d.id) === String(doc._id))).toBe(true);

    const acknowledgeReturnedRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'receive',
        office_id: senderOfficeId,
        user_id: user1._id
      });
    expect(acknowledgeReturnedRes.status).toBe(200);

    const senderIncomingAfterAckRes = await request(app)
      .get('/api/documents/incoming')
      .query({ office_id: senderOfficeId });
    expect(senderIncomingAfterAckRes.status).toBe(200);
    const senderIncomingAfterAck = Array.isArray(senderIncomingAfterAckRes.body) ? senderIncomingAfterAckRes.body : [];
    expect(senderIncomingAfterAck.some((d) => String(d._id || d.id) === String(doc._id))).toBe(false);

    const senderReceivedAfterAckRes = await request(app)
      .get('/api/documents/received')
      .query({ office_id: senderOfficeId });
    expect(senderReceivedAfterAckRes.status).toBe(200);
    const senderReceivedAfterAck = Array.isArray(senderReceivedAfterAckRes.body) ? senderReceivedAfterAckRes.body : [];
    expect(senderReceivedAfterAck.some((d) => String(d._id || d.id) === String(doc._id))).toBe(true);

    const timelineRes = await request(app).get(`/api/documents/${doc._id}/timeline`);
    expect(timelineRes.status).toBe(200);
    const statuses = (timelineRes.body.timeline || []).map((row) => String(row.status || '').toUpperCase());
    expect(statuses.some((s) => s.includes('ACKNOWLEDGED RETURNED BY'))).toBe(true);
  });

  test('forward action updates current office and appears in destination incoming', async () => {
    const doc = await createReleasedDocument(`FORWARD-${Date.now()}`);

    const receiveRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'receive',
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id,
        remarks: 'Prepare for forward'
      });
    expect(receiveRes.status).toBe(200);

    const forwardRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'forward',
        acting_office_id: user2.office_id._id || user2.office_id,
        to_office_id: registrarOfficeId,
        user_id: user2._id,
        remarks: 'Forwarding to registrar'
      });
    expect(forwardRes.status).toBe(200);
    expect(forwardRes.body.success).toBe(true);
    expect(String(forwardRes.body.document.status || '').toUpperCase()).toContain('FORWARDED BY');
    expect(String(forwardRes.body.document.current_office_id?._id || '')).toBe(String(registrarOfficeId));

    const incomingDestRes = await request(app)
      .get('/api/documents/incoming')
      .query({ office_id: registrarOfficeId });
    expect(incomingDestRes.status).toBe(200);
    const incomingDest = Array.isArray(incomingDestRes.body) ? incomingDestRes.body : [];
    expect(incomingDest.some((d) => d._id === doc._id)).toBe(true);
  });

  test('forward is rejected unless document is received first', async () => {
    const doc = await createReleasedDocument(`FORWARD-BLOCKED-${Date.now()}`);

    const forwardRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'forward',
        acting_office_id: user2.office_id._id || user2.office_id,
        to_office_id: registrarOfficeId,
        user_id: user2._id,
        remarks: 'Trying to forward without receiving first'
      });

    expect(forwardRes.status).toBe(409);
    expect(String(forwardRes.body.current_phase || '').toUpperCase()).toBe('RELEASED');
  });

  test('current holder can complete and further actions are blocked', async () => {
    const doc = await createReleasedDocument(`COMPLETE-${Date.now()}`);

    const receiveRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'receive',
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id,
        remarks: 'Prepare for completion'
      });
    expect(receiveRes.status).toBe(200);

    const completeRes = await request(app)
      .post(`/api/documents/${doc._id}/complete`)
      .send({
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id,
        remarks: 'Completed in API test'
      });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);
    expect(String(completeRes.body.document.status || '').toUpperCase()).toContain('COMPLETED BY');
    expect(completeRes.body.document.completed_at).toBeTruthy();
    expect(String(completeRes.body.document.completed_by_office_id?._id || '')).toBe(String(user2.office_id._id || user2.office_id));
    expect(String(completeRes.body.document.completed_by_user_id?._id || '')).toBe(String(user2._id));

    const completeListRes = await request(app)
      .get('/api/documents/complete')
      .query({ office_id: user2.office_id._id || user2.office_id });
    expect(completeListRes.status).toBe(200);
    const completeList = Array.isArray(completeListRes.body) ? completeListRes.body : [];
    expect(completeList.some((d) => d._id === doc._id)).toBe(true);

    const blockedForwardRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'forward',
        acting_office_id: user2.office_id._id || user2.office_id,
        to_office_id: registrarOfficeId,
        user_id: user2._id,
        remarks: 'Should be blocked after completion'
      });
    expect(blockedForwardRes.status).toBe(409);
    expect(String(blockedForwardRes.body.current_phase || '').toUpperCase()).toBe('COMPLETED');
  });

  test('sender can edit before receive and is blocked after receive', async () => {
    const doc = await createReleasedDocument(`EDIT-GUARD-${Date.now()}`);

    const typeRes = await request(app).get('/api/document-types');
    expect(typeRes.status).toBe(200);
    const types = Array.isArray(typeRes.body) ? typeRes.body : [];
    const fallbackTypeId = types[0]?._id || types[0]?.id;
    expect(fallbackTypeId).toBeTruthy();

    const preReceiveEditRes = await request(app)
      .put(`/api/documents/${doc._id}`)
      .set('Authorization', `Bearer ${user1.token}`)
      .send({
        title: `${doc.title} (Edited)`,
        content: `${doc.content} - edited`,
        type_id: fallbackTypeId,
        remarks: 'Corrected details before destination received'
      });
    expect(preReceiveEditRes.status).toBe(200);
    expect(String(preReceiveEditRes.body.title || '')).toContain('(Edited)');

    const preReceiveTimelineRes = await request(app).get(`/api/documents/${doc._id}/timeline`);
    expect(preReceiveTimelineRes.status).toBe(200);
    const preReceiveTimeline = Array.isArray(preReceiveTimelineRes.body.timeline)
      ? preReceiveTimelineRes.body.timeline
      : [];
    expect(
      preReceiveTimeline.some((row) => String(row.status || '').toUpperCase().includes('EDITED BY'))
    ).toBe(true);

    const receiveRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'receive',
        office_id: user2.office_id._id || user2.office_id,
        user_id: user2._id,
        remarks: 'Received after sender edit'
      });
    expect(receiveRes.status).toBe(200);

    const postReceiveEditRes = await request(app)
      .put(`/api/documents/${doc._id}`)
      .set('Authorization', `Bearer ${user1.token}`)
      .send({
        title: `${doc.title} (Edited Again)`,
        content: `${doc.content} - second edit`,
        type_id: fallbackTypeId
      });
    expect(postReceiveEditRes.status).toBe(409);
  });

  test('returned document edit/resend keeps same doc and appears in incoming/outgoing', async () => {
    const doc = await createReleasedDocument(`RETURN-EDIT-${Date.now()}`);
    const originalId = doc._id;
    const originalCode = doc.document_code;
    const user2OfficeId = user2.office_id._id || user2.office_id;

    const declineRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'decline',
        office_id: user2OfficeId,
        user_id: user2._id,
        remarks: 'Return for corrections'
      });
    expect(declineRes.status).toBe(200);
    expect(String(declineRes.body.document.status || '').toUpperCase()).toContain('RETURNED TO');

    const rerouteRes = await request(app)
      .put(`/api/documents/${doc._id}`)
      .set('Authorization', `Bearer ${user1.token}`)
      .send({
        title: `${doc.title} (Revised)`,
        content: `${doc.content} - revised`,
        type_id: docTypeId,
        remarks: 'Updated and resent after return',
        forward_to_office_ids: [user2OfficeId]
      });
    expect(rerouteRes.status).toBe(200);
    expect(String(rerouteRes.body._id || rerouteRes.body.id || '')).toBe(String(originalId));
    expect(String(rerouteRes.body.document_code || '')).toBe(String(originalCode));
    expect(String(rerouteRes.body.status || '').toUpperCase()).toContain('FORWARDED BY');

    const timelineRes = await request(app).get(`/api/documents/${doc._id}/timeline`);
    expect(timelineRes.status).toBe(200);
    const statuses = (timelineRes.body.timeline || []).map((row) => String(row.status || '').toUpperCase());
    expect(statuses.some((s) => s.includes('EDITED BY'))).toBe(true);
    expect(statuses.some((s) => s.includes('RESENT BY'))).toBe(true);
    expect(statuses.some((s) => s.includes('FORWARDED BY'))).toBe(true);

    const recipientIncomingRes = await request(app)
      .get('/api/documents/incoming')
      .query({ office_id: user2OfficeId });
    expect(recipientIncomingRes.status).toBe(200);
    const recipientIncoming = Array.isArray(recipientIncomingRes.body) ? recipientIncomingRes.body : [];
    expect(recipientIncoming.some((d) => d._id === doc._id)).toBe(true);
    const senderIncomingRes = await request(app)
      .get('/api/documents/incoming')
      .query({ office_id: user1.office_id._id || user1.office_id });
    expect(senderIncomingRes.status).toBe(200);
    const senderIncoming = Array.isArray(senderIncomingRes.body) ? senderIncomingRes.body : [];
    expect(senderIncoming.some((d) => String(d._id || d.id) === String(doc._id))).toBe(false);

    const senderOutgoingRes = await request(app)
      .get('/api/documents/outgoing')
      .set('Authorization', `Bearer ${user1.token}`);
    expect(senderOutgoingRes.status).toBe(200);
    const senderOutgoing = Array.isArray(senderOutgoingRes.body?.items) ? senderOutgoingRes.body.items : [];
    const resentOutgoing = senderOutgoing.find((d) => String(d._id || d.id) === String(doc._id));
    expect(Boolean(resentOutgoing)).toBe(true);
    expect(String(resentOutgoing?.document_code || '')).toBe(String(originalCode));
    expect(String(resentOutgoing?.status || '').toUpperCase()).toContain('FORWARDED BY');
  });

  test('returned document edit requires destination office selection', async () => {
    const doc = await createReleasedDocument(`RETURN-RESEND-REQ-${Date.now()}`);
    const user2OfficeId = user2.office_id._id || user2.office_id;

    const declineRes = await request(app)
      .post(`/api/documents/${doc._id}/action`)
      .send({
        action: 'decline',
        office_id: user2OfficeId,
        user_id: user2._id,
        remarks: 'Return for updates'
      });
    expect(declineRes.status).toBe(200);

    const missingDestinationRes = await request(app)
      .put(`/api/documents/${doc._id}`)
      .set('Authorization', `Bearer ${user1.token}`)
      .send({
        title: `${doc.title} (Edited no resend target)`,
        content: `${doc.content} - edited without destination`,
        type_id: docTypeId,
        remarks: 'Edited only'
      });
    expect(missingDestinationRes.status).toBe(400);
    expect(String(missingDestinationRes.body?.error || '').toUpperCase()).toContain('DESTINATION OFFICE');
  });
});
