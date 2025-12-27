import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length);
console.log('REDIS_URL:', process.env.REDIS_URL);
console.log('AZURE_STORAGE_CONTAINER_NAME:', process.env.AZURE_STORAGE_CONTAINER_NAME);
console.log('AZURE_STORAGE_CONNECTION_STRING exists:', !!process.env.AZURE_STORAGE_CONNECTION_STRING);
