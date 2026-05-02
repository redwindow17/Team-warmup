/**
 * Storage Service — Google Cloud Storage
 * File uploads, downloads, and management.
 */

const { uploadFile, getSignedUrl, deleteFile, listFiles } = require('../config/storage');
const { v4: uuidv4 } = require('uuid');

async function handleFileUpload(file, metadata) {
  const ext = file.originalname.split('.').pop();
  const destination = `${metadata.teamId}/${metadata.taskId || 'general'}/${uuidv4()}.${ext}`;
  const result = await uploadFile(file.buffer, destination, file.mimetype, {
    originalName: file.originalname,
    uploadedBy: metadata.userId,
    teamId: metadata.teamId,
    taskId: metadata.taskId || null
  });
  return { ...result, originalName: file.originalname, destination };
}

async function getDownloadUrl(fileName) {
  return await getSignedUrl(fileName, 60);
}

async function removeFile(fileName) {
  await deleteFile(fileName);
}

async function getTaskFiles(teamId, taskId) {
  return await listFiles(`${teamId}/${taskId}/`);
}

module.exports = { handleFileUpload, getDownloadUrl, removeFile, getTaskFiles };
