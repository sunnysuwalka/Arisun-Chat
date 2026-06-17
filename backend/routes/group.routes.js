const express = require('express');
const { 
  createGroup, 
  fetchGroups, 
  renameGroup, 
  updateGroupAvatar, 
  addToGroup, 
  removeFromGroup,
  deleteGroup 
} = require('../controllers/group.controller');

// 🔥 FIX: Import the function directly, do not use curly braces {}
const protect = require('../middleware/auth'); 

const router = express.Router();

router.post('/', protect, createGroup);
router.get('/', protect, fetchGroups);
router.put('/rename', protect, renameGroup);
router.put('/avatar', protect, updateGroupAvatar);
router.put('/add', protect, addToGroup);
router.put('/remove', protect, removeFromGroup);
router.put('/delete', protect, deleteGroup);

module.exports = router;