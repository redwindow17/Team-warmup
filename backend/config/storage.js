/**
 * Google Cloud Storage Configuration
 * 
 * Service: Google Cloud Storage (GCS)
 * Used for: File attachments, report exports, user avatars
 */

const { Storage } = require('@google-cloud/storage');

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';

const storage = new Storage({
  projectId: process.env.GOOGLE_PROJECT_ID || 'redwindow-482406',
  keyFilename: require('fs').existsSync(keyPath) ? keyPath : undefined
});
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'redwindow-482406-syncsphere-files';
const bucket = storage.bucket(BUCKET_NAME);

/**
 * Upload a file to Google Cloud Storage
 * @param {Buffer} fileBuffer - File data
 * @param {string} destination - Destination path in bucket
 * @param {string} contentType - MIME type
 * @param {Object} metadata - Custom metadata
 * @returns {Object} Upload result with public URL
 */
async function uploadFile(fileBuffer, destination, contentType, metadata = {}) {
  try {
    const file = bucket.file(destination);
    await file.save(fileBuffer, {
      contentType,
      metadata: {
        metadata: {
          ...metadata,
          uploadedAt: new Date().toISOString()
        }
      },
      resumable: false
    });

    console.log(`[GCS] File uploaded: ${destination}`);
    return {
      fileName: destination,
      bucket: BUCKET_NAME,
      contentType,
      size: fileBuffer.length
    };
  } catch (error) {
    console.error('[GCS] Upload error:', error.message);
    throw error;
  }
}

/**
 * Generate a signed URL for temporary file access
 * @param {string} fileName - File path in bucket
 * @param {number} expiresInMinutes - URL expiration time
 * @returns {string} Signed download URL
 */
async function getSignedUrl(fileName, expiresInMinutes = 60) {
  try {
    const file = bucket.file(fileName);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000
    });
    return url;
  } catch (error) {
    console.error('[GCS] Signed URL error:', error.message);
    throw error;
  }
}

/**
 * Delete a file from Google Cloud Storage
 * @param {string} fileName - File path in bucket
 */
async function deleteFile(fileName) {
  try {
    await bucket.file(fileName).delete();
    console.log(`[GCS] File deleted: ${fileName}`);
  } catch (error) {
    console.error('[GCS] Delete error:', error.message);
    throw error;
  }
}

/**
 * List files with a given prefix
 * @param {string} prefix - Path prefix to filter
 * @returns {Array} List of file metadata
 */
async function listFiles(prefix) {
  try {
    const [files] = await bucket.getFiles({ prefix });
    return files.map(file => ({
      name: file.name,
      size: file.metadata.size,
      contentType: file.metadata.contentType,
      updated: file.metadata.updated
    }));
  } catch (error) {
    console.error('[GCS] List error:', error.message);
    throw error;
  }
}

module.exports = {
  storage,
  bucket,
  uploadFile,
  getSignedUrl,
  deleteFile,
  listFiles,
  BUCKET_NAME
};
