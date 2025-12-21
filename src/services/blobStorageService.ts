import { BlobServiceClient } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';

/**
 * Blob Storage Service for Azure Blob Storage / Azurite
 * Handles image upload, deletion, and migration from base64
 */
class BlobStorageService {
  private blobServiceClient: BlobServiceClient;
  private containerName: string;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is not defined in environment variables');
    }

    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'jeetest-images';
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }

  /**
   * Initialize blob container (create if not exists)
   * Sets container to allow public read access for blobs
   */
  async initializeContainer(): Promise<void> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const exists = await containerClient.exists();

      if (!exists) {
        await containerClient.create({ access: 'blob' }); // Public read access
        console.log(`✅ Container '${this.containerName}' created successfully`);
      } else {
        console.log(`✅ Container '${this.containerName}' already exists`);
      }
    } catch (error) {
      console.error('Error initializing blob container:', error);
      throw error;
    }
  }

  /**
   * Upload image to blob storage
   * @param buffer - Image buffer
   * @param fileName - Original file name
   * @param mimeType - MIME type (e.g., image/png)
   * @returns Public URL of uploaded blob
   */
  async uploadImage(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    try {
      // Generate unique blob name
      const blobName = `${uuidv4()}-${fileName}`;
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Upload buffer to blob storage
      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: mimeType
        }
      });

      console.log(`✅ Image uploaded: ${blobName}`);
      return blockBlobClient.url;
    } catch (error) {
      console.error('Error uploading image to blob storage:', error);
      throw error;
    }
  }

  /**
   * Delete image from blob storage
   * @param blobUrl - Full URL of the blob to delete
   */
  async deleteImage(blobUrl: string): Promise<void> {
    try {
      const blobName = this.extractBlobNameFromUrl(blobUrl);
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const deleteResponse = await blockBlobClient.deleteIfExists();

      if (deleteResponse.succeeded) {
        console.log(`✅ Image deleted: ${blobName}`);
      } else {
        console.log(`⚠️ Image not found: ${blobName}`);
      }
    } catch (error) {
      console.error('Error deleting image from blob storage:', error);
      throw error;
    }
  }

  /**
   * Migrate base64 image to blob storage
   * Extracts base64 data and uploads as blob
   * @param base64Data - Base64 data URL (e.g., data:image/png;base64,...)
   * @param fileName - Desired file name
   * @returns Public URL of uploaded blob
   */
  async migrateBase64ToBlob(base64Data: string, fileName: string): Promise<string> {
    try {
      // Parse base64 data URL
      const matches = base64Data.match(/^data:(.+);base64,(.+)$/);

      if (!matches) {
        throw new Error('Invalid base64 data URL format');
      }

      const mimeType = matches[1];
      const base64Content = matches[2];

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Content, 'base64');

      // Upload to blob storage
      return await this.uploadImage(buffer, fileName, mimeType);
    } catch (error) {
      console.error('Error migrating base64 to blob:', error);
      throw error;
    }
  }

  /**
   * Extract blob name from full URL
   * @param url - Full blob URL
   * @returns Blob name
   */
  private extractBlobNameFromUrl(url: string): string {
    try {
      // URL format: http://localhost:10000/devstoreaccount1/container/blobname
      // or https://account.blob.core.windows.net/container/blobname
      const urlParts = url.split('/');
      return urlParts[urlParts.length - 1];
    } catch (error) {
      console.error('Error extracting blob name from URL:', error);
      throw new Error('Invalid blob URL');
    }
  }

  /**
   * Check if a URL is a blob storage URL
   * @param url - URL to check
   * @returns true if URL is a blob storage URL
   */
  isBlobUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * Check if a URL is a base64 data URL
   * @param url - URL to check
   * @returns true if URL is a base64 data URL
   */
  isBase64Url(url: string): boolean {
    return url.startsWith('data:image/');
  }
}

// Export singleton instance
export default new BlobStorageService();
