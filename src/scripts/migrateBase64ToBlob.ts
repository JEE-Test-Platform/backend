import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import blobStorageService from '../services/blobStorageService';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

/**
 * Migration script to convert base64 images to blob storage
 * Migrates both Question and Option images
 */
async function migrateBase64Images() {
  console.log('🚀 Starting base64 to blob migration...');
  console.log('📊 Environment:', process.env.NODE_ENV || 'development');
  console.log('🗄️  Database:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Unknown');
  console.log('');

  let totalQuestions = 0;
  let migratedQuestions = 0;
  let failedQuestions = 0;

  let totalOptions = 0;
  let migratedOptions = 0;
  let failedOptions = 0;

  try {
    // Initialize blob storage
    console.log('☁️  Initializing Azure Blob Storage...');
    await blobStorageService.initializeContainer();
    console.log('✅ Blob storage initialized');
    console.log('');

    // ====================
    // Migrate Question images
    // ====================
    console.log('📷 Migrating Question images...');
    console.log('─'.repeat(50));

    const questionsWithImages = await prisma.question.findMany({
      where: {
        imageUrl: {
          startsWith: 'data:image/', // Only base64 images
        },
      },
    });

    totalQuestions = questionsWithImages.length;
    console.log(`📊 Found ${totalQuestions} questions with base64 images`);
    console.log('');

    for (const question of questionsWithImages) {
      try {
        console.log(`Processing question ${question.id}...`);

        // Migrate base64 to blob
        const blobUrl = await blobStorageService.migrateBase64ToBlob(
          question.imageUrl!,
          `question-${question.id}.png`
        );

        // Update database with blob URL
        await prisma.question.update({
          where: { id: question.id },
          data: { imageUrl: blobUrl },
        });

        migratedQuestions++;
        console.log(`✅ Migrated question ${question.id} → ${blobUrl.substring(0, 80)}...`);
      } catch (error: any) {
        failedQuestions++;
        console.error(`❌ Failed to migrate question ${question.id}:`, error.message);
      }
    }

    console.log('');
    console.log('─'.repeat(50));
    console.log(`📊 Question Migration Summary:`);
    console.log(`   Total: ${totalQuestions}`);
    console.log(`   ✅ Migrated: ${migratedQuestions}`);
    console.log(`   ❌ Failed: ${failedQuestions}`);
    console.log('');

    // ====================
    // Migrate Option images
    // ====================
    console.log('📷 Migrating Option images...');
    console.log('─'.repeat(50));

    const optionsWithImages = await prisma.option.findMany({
      where: {
        optionImageUrl: {
          startsWith: 'data:image/',
        },
      },
    });

    totalOptions = optionsWithImages.length;
    console.log(`📊 Found ${totalOptions} options with base64 images`);
    console.log('');

    for (const option of optionsWithImages) {
      try {
        console.log(`Processing option ${option.id}...`);

        // Migrate base64 to blob
        const blobUrl = await blobStorageService.migrateBase64ToBlob(
          option.optionImageUrl!,
          `option-${option.id}.png`
        );

        // Update database with blob URL
        await prisma.option.update({
          where: { id: option.id },
          data: { optionImageUrl: blobUrl },
        });

        migratedOptions++;
        console.log(`✅ Migrated option ${option.id} → ${blobUrl.substring(0, 80)}...`);
      } catch (error: any) {
        failedOptions++;
        console.error(`❌ Failed to migrate option ${option.id}:`, error.message);
      }
    }

    console.log('');
    console.log('─'.repeat(50));
    console.log(`📊 Option Migration Summary:`);
    console.log(`   Total: ${totalOptions}`);
    console.log(`   ✅ Migrated: ${migratedOptions}`);
    console.log(`   ❌ Failed: ${failedOptions}`);
    console.log('');

    // ====================
    // Final Summary
    // ====================
    console.log('═'.repeat(50));
    console.log('🎉 Migration Completed!');
    console.log('═'.repeat(50));
    console.log('📊 Overall Summary:');
    console.log(`   Questions: ${migratedQuestions}/${totalQuestions} migrated`);
    console.log(`   Options: ${migratedOptions}/${totalOptions} migrated`);
    console.log(`   Total Migrated: ${migratedQuestions + migratedOptions}`);
    console.log(`   Total Failed: ${failedQuestions + failedOptions}`);
    console.log('');

    if (failedQuestions + failedOptions > 0) {
      console.log('⚠️  Warning: Some images failed to migrate. Please review the errors above.');
    } else {
      console.log('✅ All images successfully migrated to blob storage!');
    }

  } catch (error: any) {
    console.error('❌ Migration failed with error:', error);
    throw error;
  } finally {
    // Disconnect from database
    await prisma.$disconnect();
    console.log('');
    console.log('🔌 Database connection closed');
  }
}

// Run migration
migrateBase64Images()
  .then(() => {
    console.log('✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
