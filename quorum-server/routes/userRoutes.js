const express = require('express');
const verifyToken = require('../middleware/verifyToken');
const { upsertUser, getMe, getBySlug } = require('../controllers/userController');
const verifyFirebase = require('../middleware/verifyFirebase');
const validate = require('../middleware/validate');
const { upsertUserSchema } = require('../schemas/userSchemas');

const router = express.Router();

router.post('/', verifyFirebase, validate(upsertUserSchema), upsertUser);
router.get('/me', verifyToken, getMe);
router.get('/:slug', getBySlug);

module.exports = router;
