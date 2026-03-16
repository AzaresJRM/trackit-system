const express = require('express');
const { Attachment } = require('../models');
const { requireUser } = require('../middleware/requireUser');
const { userCanAccessDocument } = require('../middleware/documentAccess');
const router = express.Router();

async function getAuthorizedAttachment(req, res) {
    const att = await Attachment.findByPk(req.params.id);
    if (!att) {
        res.status(404).json({ error: 'Attachment not found.' });
        return null;
    }
    const canAccess = await userCanAccessDocument(req.userRecord, att.document_id);
    if (!canAccess) {
        res.status(403).json({ error: 'You are not authorized to access this attachment.' });
        return null;
    }
    return att;
}

// GET /api/attachments/:id/download
router.get('/:id/download', requireUser, async (req, res) => {
    try {
        const att = await getAuthorizedAttachment(req, res);
        if (!att) return;

        // Stream the BYTEA buffer as a downloadable response
        res.setHeader('Content-Type', att.mime_type);
        res.setHeader('Content-Disposition', `attachment; filename="${att.filename}"`);
        res.setHeader('Content-Length', att.size_bytes);

        // `.file_data` is a raw Buffer object automatically decoded by pg/Sequelize
        res.send(att.file_data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/attachments/:id/preview
router.get('/:id/preview', requireUser, async (req, res) => {
    try {
        const att = await getAuthorizedAttachment(req, res);
        if (!att) return;

        res.setHeader('Content-Type', att.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${att.filename}"`);
        res.setHeader('Content-Length', att.size_bytes);
        res.send(att.file_data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
