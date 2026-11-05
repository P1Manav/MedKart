// scripts/test_real_ocr.ts
import fs from 'fs';
import path from 'path';
import { HfOcrReader } from '../src/lib/ai/hf-ocr-reader';

async function run() {
  console.log('=== REAL OCR PERCEPTION & EXTRACTION TEST ===\n');

  const reader = new HfOcrReader();

  // Test 1: Clean synthetic prescription
  const cleanImgPath = path.join(process.cwd(), 'seed/prescriptions/rx_50211_metformin_clean.png');
  const cleanBytes = fs.readFileSync(cleanImgPath);

  console.log(`[Test 1] Processing ${path.basename(cleanImgPath)} (${cleanBytes.length} bytes)...`);
  const cleanResult = await reader.read(cleanBytes, 'image/png');

  console.log('Tier / Model used:', cleanResult.modelName);
  console.log('Latency (ms):', cleanResult.latencyMs);
  console.log('Success:', cleanResult.success);
  console.log('Manual Entry Needed:', cleanResult.manualEntryNeeded);
  console.log('Legibility:', cleanResult.data?.image_legibility);
  console.log('Prescriber:', cleanResult.data?.prescriber_text);
  console.log('Date:', cleanResult.data?.date_text);
  console.log('Extracted Prescription Lines:');
  cleanResult.data?.lines.forEach((line, i) => {
    console.log(`  Line ${i + 1}:`, {
      raw_text: line.raw_text,
      drug_name: line.drug_name,
      strength: line.strength,
      form: line.form,
      quantity: line.quantity,
      frequency: line.frequency_text,
      confidence: line.confidence,
    });
  });

  // Test 2: Blurry / Unreadable synthetic prescription
  console.log('\n--------------------------------------------------\n');
  const blurryImgPath = path.join(process.cwd(), 'seed/prescriptions/rx_sample_blurry_unreadable.png');
  const blurryBytes = fs.readFileSync(blurryImgPath);

  console.log(`[Test 2] Processing ${path.basename(blurryImgPath)} (${blurryBytes.length} bytes)...`);
  const blurryResult = await reader.read(blurryBytes, 'image/png');

  console.log('Tier / Model used:', blurryResult.modelName);
  console.log('Latency (ms):', blurryResult.latencyMs);
  console.log('Success:', blurryResult.success);
  console.log('Manual Entry Needed:', blurryResult.manualEntryNeeded);
  console.log('Legibility:', blurryResult.data?.image_legibility);
  console.log('Lines count:', blurryResult.data?.lines.length);
  console.log('Error message:', blurryResult.errorMessage);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

