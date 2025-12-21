import { Request, Response, NextFunction } from 'express';

/**
 * Image URL Handler Middleware
 * Provides dual support for base64 and blob storage URLs
 * Allows gradual migration without breaking existing functionality
 */

/**
 * Check if imageUrl is a base64 data URL
 * @param url - URL to check
 * @returns true if URL is base64 format
 */
export const isBase64Image = (url: string | null): boolean => {
  if (!url) return false;
  return url.startsWith('data:image/');
};

/**
 * Check if imageUrl is a valid blob storage URL
 * @param url - URL to check
 * @returns true if URL is HTTP/HTTPS format
 */
export const isBlobUrl = (url: string | null): boolean => {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
};

/**
 * Validate image URL format
 * Accepts both base64 data URLs and blob storage URLs
 * @param url - URL to validate
 * @returns true if URL is valid
 */
export const validateImageUrl = (url: string | null): boolean => {
  if (!url) return true; // null is valid (optional field)

  // Accept base64 data URLs (for backward compatibility)
  if (isBase64Image(url)) return true;

  // Accept blob storage URLs (http/https)
  if (isBlobUrl(url)) return true;

  return false;
};

/**
 * Express middleware to validate image URLs in request body
 * Checks all image-related fields in the request
 */
export const imageUrlValidator = (req: Request, res: Response, next: NextFunction): void => {
  // Image fields that may contain URLs
  const imageFields = [
    'questionImageUrl',
    'optionAImageUrl',
    'optionBImageUrl',
    'optionCImageUrl',
    'optionDImageUrl',
    'imageUrl' // Generic field
  ];

  // Check if request body exists
  if (!req.body) {
    return next();
  }

  // Validate each image field
  for (const field of imageFields) {
    const url = req.body[field];

    // Skip if field doesn't exist
    if (url === undefined) continue;

    // Validate URL format
    if (!validateImageUrl(url)) {
      res.status(400).json({
        error: `Invalid image URL format for field '${field}'`,
        message: 'Image URL must be either a base64 data URL (data:image/...) or HTTP/HTTPS URL',
        field: field
      });
      return;
    }
  }

  // Check questions array if present (for bulk operations)
  if (req.body.questions && Array.isArray(req.body.questions)) {
    for (let i = 0; i < req.body.questions.length; i++) {
      const question = req.body.questions[i];

      for (const field of imageFields) {
        const url = question[field];

        if (url !== undefined && !validateImageUrl(url)) {
          res.status(400).json({
            error: `Invalid image URL format in questions[${i}].${field}`,
            message: 'Image URL must be either a base64 data URL (data:image/...) or HTTP/HTTPS URL',
            field: `questions[${i}].${field}`
          });
          return;
        }
      }
    }
  }

  next();
};

/**
 * Get image URL type
 * @param url - URL to check
 * @returns 'base64', 'blob', or 'unknown'
 */
export const getImageUrlType = (url: string | null): 'base64' | 'blob' | 'unknown' => {
  if (!url) return 'unknown';
  if (isBase64Image(url)) return 'base64';
  if (isBlobUrl(url)) return 'blob';
  return 'unknown';
};
