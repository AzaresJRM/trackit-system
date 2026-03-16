const express = require('express');
const { DocumentType } = require('../models');
const router = express.Router();

// Get all document types
router.get('/', async (req, res) => {
  try {
    const types = await DocumentType.findAll();
    const allowedNames = new Set(['memorandum', 'memo', 'endorsement', 'communication letter']);
    const mapped = types.map(t => ({
      ...t.toJSON(),
      _id: t.id
    }))
      .filter((t) => allowedNames.has(String(t.type_name || '').trim().toLowerCase()))
      .sort((a, b) => String(a.type_name || '').localeCompare(String(b.type_name || '')));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;