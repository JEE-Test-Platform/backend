import multer from 'multer';

/**
 * Multer configuration for image uploads
 * Uses memory storage to keep images in buffer for blob upload
 */
const storage = multer.memoryStorage();

/**
 * Image upload middleware
 * Accepts single image file with field name 'image'
 * Max file size: 10MB
 * Allowed types: JPEG, PNG, GIF, WEBP
 */
export const imageUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP images are allowed.'));
    }
  },
}).single('image');
