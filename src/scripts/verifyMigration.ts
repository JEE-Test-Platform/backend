import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function verifyMigration() {
  console.log('🔍 Checking database for remaining base64 images...\n');

  try {
    // Check Questions
    const questionsWithBase64 = await prisma.question.findMany({
      where: {
        imageUrl: {
          startsWith: 'data:image/',
        },
      },
      select: {
        id: true,
        imageUrl: true,
      },
    });

    // Check Options
    const optionsWithBase64 = await prisma.option.findMany({
      where: {
        optionImageUrl: {
          startsWith: 'data:image/',
        },
      },
      select: {
        id: true,
        optionImageUrl: true,
      },
    });

    // Check all Questions with images
    const allQuestionsWithImages = await prisma.question.findMany({
      where: {
        imageUrl: {
          not: null,
        },
      },
      select: {
        id: true,
        imageUrl: true,
      },
    });

    // Check all Options with images
    const allOptionsWithImages = await prisma.option.findMany({
      where: {
        optionImageUrl: {
          not: null,
        },
      },
      select: {
        id: true,
        optionImageUrl: true,
      },
    });

    console.log('═'.repeat(60));
    console.log('📊 Migration Verification Results');
    console.log('═'.repeat(60));
    console.log();

    // Results for Questions
    console.log('📷 Questions with Images:');
    console.log(`   Total questions with images: ${allQuestionsWithImages.length}`);
    console.log(`   ❌ Questions with base64 URLs: ${questionsWithBase64.length}`);
    console.log(`   ✅ Questions with blob URLs: ${allQuestionsWithImages.length - questionsWithBase64.length}`);
    console.log();

    if (questionsWithBase64.length > 0) {
      console.log('   ⚠️  Remaining base64 images in Questions:');
      questionsWithBase64.forEach((q) => {
        const preview = q.imageUrl?.substring(0, 50) + '...';
        console.log(`      - Question ${q.id}: ${preview}`);
      });
      console.log();
    }

    // Results for Options
    console.log('📷 Options with Images:');
    console.log(`   Total options with images: ${allOptionsWithImages.length}`);
    console.log(`   ❌ Options with base64 URLs: ${optionsWithBase64.length}`);
    console.log(`   ✅ Options with blob URLs: ${allOptionsWithImages.length - optionsWithBase64.length}`);
    console.log();

    if (optionsWithBase64.length > 0) {
      console.log('   ⚠️  Remaining base64 images in Options:');
      optionsWithBase64.forEach((o) => {
        const preview = o.optionImageUrl?.substring(0, 50) + '...';
        console.log(`      - Option ${o.id}: ${preview}`);
      });
      console.log();
    }

    // Sample blob URLs
    if (allQuestionsWithImages.length > 0) {
      console.log('📎 Sample blob URLs from Questions:');
      allQuestionsWithImages.slice(0, 3).forEach((q) => {
        const url = q.imageUrl || '';
        const isBlobUrl = url.startsWith('http://') || url.startsWith('https://');
        const status = isBlobUrl ? '✅' : '❌';
        console.log(`   ${status} ${url.substring(0, 80)}...`);
      });
      console.log();
    }

    if (allOptionsWithImages.length > 0) {
      console.log('📎 Sample blob URLs from Options:');
      allOptionsWithImages.slice(0, 3).forEach((o) => {
        const url = o.optionImageUrl || '';
        const isBlobUrl = url.startsWith('http://') || url.startsWith('https://');
        const status = isBlobUrl ? '✅' : '❌';
        console.log(`   ${status} ${url.substring(0, 80)}...`);
      });
      console.log();
    }

    console.log('═'.repeat(60));

    // Final verdict
    const totalBase64 = questionsWithBase64.length + optionsWithBase64.length;
    const totalImages = allQuestionsWithImages.length + allOptionsWithImages.length;

    if (totalBase64 === 0 && totalImages > 0) {
      console.log('✅ SUCCESS: All images migrated to blob storage!');
      console.log(`   Total: ${totalImages} images, 0 base64 URLs remaining`);
    } else if (totalBase64 === 0 && totalImages === 0) {
      console.log('ℹ️  INFO: No images found in database');
    } else {
      console.log(`⚠️  WARNING: ${totalBase64} base64 URLs still remain!`);
      console.log('   Run the migration script again: npm run migrate:images');
    }
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Error verifying migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
