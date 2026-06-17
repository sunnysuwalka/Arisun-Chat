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

console.log("Checking imports...");
console.log("createGroup:", typeof createGroup); // Should be 'function'
console.log("protect:", typeof protect);         // Should be 'function'
console.log("deleteGroup:", typeof deleteGroup); // Should be 'function'
console.log("fetchGroups:", typeof fetchGroups); // Should be 'function'
console.log("renameGroup:", typeof renameGroup);
console.log("updateGroupAvatar:",typeof updateGroupAvatar )
console.log("addTogroup:", typeof addToGroup)
console.log("removeFromGroup", typeof removeFromGroup)

router.post('/', protect, createGroup);
router.get('/', protect, fetchGroups);
router.put('/rename', protect, renameGroup);
router.put('/avatar', protect, updateGroupAvatar);
router.put('/add', protect, addToGroup);
router.put('/remove', protect, removeFromGroup);
router.put('/delete', protect, deleteGroup);

module.exports = router;