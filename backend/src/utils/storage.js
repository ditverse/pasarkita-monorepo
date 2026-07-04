const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { AppError } = require('./app-error');

const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Saves an uploaded file asynchronously to the local file system.
 * @param {string} bucketName - Name of the bucket/directory under uploads.
 * @param {string} subFolder - Subfolder inside the bucket (e.g. userId or sellerId).
 * @param {object} file - Multer file object.
 * @param {string} [customPrefix=''] - Optional prefix for the filename.
 * @returns {Promise<{ url: string, path: string }>}
 */
const saveUploadedFile = async (bucketName, subFolder, file, customPrefix = '') => {
  if (!file) {
    throw new AppError(400, 'FILE_REQUIRED', 'File wajib dikirim');
  }

  const extension = IMAGE_EXTENSIONS[file.mimetype];
  if (!extension) {
    throw new AppError(400, 'INVALID_IMAGE_TYPE', 'Format gambar harus JPG, PNG, atau WebP');
  }

  const fileName = `${customPrefix}${randomUUID()}.${extension}`;
  const uploadDir = path.join(__dirname, '../../../uploads', bucketName, subFolder);
  
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, fileName), file.buffer);

  const filePath = `${subFolder}/${fileName}`;
  const fileUrl = `/uploads/${bucketName}/${filePath}`;

  return { url: fileUrl, path: filePath };
};

module.exports = {
  IMAGE_EXTENSIONS,
  saveUploadedFile,
};
