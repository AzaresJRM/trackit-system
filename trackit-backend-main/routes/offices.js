const express = require('express');
const { Office } = require('../models');
const { requireAdmin } = require('../middleware/adminAuth');
const router = express.Router();

// Get all offices
router.get('/', async (req, res) => {
  try {
    const offices = await Office.findAll({
      where: { is_active: true },
      order: [['office_name', 'ASC']]
    });
    // Map id to _id for frontend compatibility
    const mapped = offices.map(o => ({
      ...o.toJSON(),
      _id: o.id
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create office
router.post('/', requireAdmin, async (req, res) => {
  const { office_name, office_code, description, is_active } = req.body;
  try {
    const newOffice = await Office.create({
      office_name, office_code, description, is_active
    });
    res.json({ ...newOffice.toJSON(), _id: newOffice.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update office
router.put('/:id', requireAdmin, async (req, res) => {
  const { office_name, office_code, description, is_active } = req.body;
  try {
    const office = await Office.findByPk(req.params.id);
    if (!office) return res.status(404).json({ error: 'Office not found' });

    await office.update({ office_name, office_code, description, is_active });
    res.json({ ...office.toJSON(), _id: office.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete office (soft deactivate for backwards compatibility)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const office = await Office.findByPk(req.params.id);
    if (!office) return res.status(404).json({ error: 'Office not found' });
    await office.update({ is_active: false });
    res.json({ _id: req.params.id, message: 'Office deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;