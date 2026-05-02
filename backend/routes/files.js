/**
 * File Routes — Google Cloud Storage
 */

const router = require('express').Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const storageService = require('../services/storageService');
const { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } = require('../utils/constants');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

router.use(authenticate);

// Upload file to GCS
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const result = await storageService.handleFileUpload(req.file, {
      userId: req.user.id,
      teamId: req.body.teamId,
      taskId: req.body.taskId
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// Get download URL
router.get('/download', async (req, res) => {
  try {
    const url = await storageService.getDownloadUrl(req.query.fileName);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

// Delete file
router.delete('/', async (req, res) => {
  try {
    await storageService.removeFile(req.body.fileName);
    res.json({ message: 'File deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// List task files
router.get('/task/:teamId/:taskId', async (req, res) => {
  try {
    const files = await storageService.getTaskFiles(req.params.teamId, req.params.taskId);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

module.exports = router;
