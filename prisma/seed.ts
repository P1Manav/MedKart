// prisma/seed.ts
import { PrismaClient, UserRole, ScheduleType, OrderStatus, LineStatus, PrescriptionStatus } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { encryptPrescription } from '../src/lib/crypto/encrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting MedKart Seed...');

  // 1. Seed Schedule Rules
  console.log('Seeding Schedule Rules...');
  const scheduleRules = [
    {
      schedule: ScheduleType.OTC,
      canSellOnline: true,
      requiresPrescription: false,
      requiresPharmacistApproval: false,
      requiresRegisterEntry: false,
    },
    {
      schedule: ScheduleType.H,
      canSellOnline: true,
      requiresPrescription: true,
      requiresPharmacistApproval: true,
      requiresRegisterEntry: false,
    },
    {
      schedule: ScheduleType.H1,
      canSellOnline: true,
      requiresPrescription: true,
      requiresPharmacistApproval: true,
      requiresRegisterEntry: true,
    },
    {
      schedule: ScheduleType.X,
      canSellOnline: false,
      requiresPrescription: true,
      requiresPharmacistApproval: true,
      requiresRegisterEntry: false,
    },
    {
      schedule: ScheduleType.NARCOTIC,
      canSellOnline: false,
      requiresPrescription: true,
      requiresPharmacistApproval: true,
      requiresRegisterEntry: false,
    },
  ];

  for (const rule of scheduleRules) {
    await prisma.scheduleRule.upsert({
      where: { schedule: rule.schedule },
      update: rule,
      create: rule,
    });
  }

  // 2. Seed Stores (10 Stores across Kolkata & Howrah)
  console.log('Seeding Stores...');
  const stores = [
    { id: 'store_saltlake', name: 'MedKart Salt Lake (Sec 1)', lat: 22.5867, lng: 88.4172, pincode: '700064', address: 'Block CF-32, Sector 1, Salt Lake City' },
    { id: 'store_behala', name: 'MedKart Behala Chowrasta', lat: 22.4988, lng: 88.3190, pincode: '700034', address: '412 Diamond Harbour Rd, Behala' },
    { id: 'store_howrah_maidan', name: 'MedKart Howrah Maidan', lat: 22.5892, lng: 88.3245, pincode: '711101', address: '18 Grand Trunk Road South, Howrah' },
    { id: 'store_gariahat', name: 'MedKart Gariahat', lat: 22.5186, lng: 88.3653, pincode: '700019', address: '14/1 Rashbehari Avenue, Gariahat' },
    { id: 'store_shyambazar', name: 'MedKart Shyambazar', lat: 22.6027, lng: 88.3725, pincode: '700004', address: '124 Bidhan Sarani, Shyambazar Five Point' },
    { id: 'store_newtown', name: 'MedKart New Town', lat: 22.5898, lng: 88.4744, pincode: '700156', address: 'Action Area 1, Major Arterial Road, New Town' },
    { id: 'store_tollygunge', name: 'MedKart Tollygunge', lat: 22.4933, lng: 88.3473, pincode: '700033', address: '88 NSC Bose Road, Tollygunge' },
    { id: 'store_barabazar', name: 'MedKart Barabazar', lat: 22.5822, lng: 88.3546, pincode: '700007', address: '142 Cotton Street, Barabazar' },
    { id: 'store_dumdum', name: 'MedKart Dum Dum Cantt', lat: 22.6225, lng: 88.4239, pincode: '700028', address: '55 Jessore Road, Dum Dum' },
    { id: 'store_shibpur', name: 'MedKart Shibpur', lat: 22.5634, lng: 88.3182, pincode: '711102', address: '72 Mandirtala, Shibpur, Howrah' },
  ];

  for (const s of stores) {
    await prisma.store.upsert({
      where: { id: s.id },
      update: s,
      create: s,
    });
  }

  // 3. Seed Pincode Coordinates (ASSUMPTION A3)
  console.log('Seeding Pincode Coordinates...');
  const pincodes = [
    { pincode: '700064', lat: 22.5867, lng: 88.4172 }, // Salt Lake
    { pincode: '700034', lat: 22.4988, lng: 88.3190 }, // Behala
    { pincode: '711101', lat: 22.5892, lng: 88.3245 }, // Howrah Maidan
    { pincode: '700019', lat: 22.5186, lng: 88.3653 }, // Gariahat
    { pincode: '700004', lat: 22.6027, lng: 88.3725 }, // Shyambazar
    { pincode: '700156', lat: 22.5898, lng: 88.4744 }, // New Town
    { pincode: '700033', lat: 22.4933, lng: 88.3473 }, // Tollygunge
    { pincode: '700007', lat: 22.5822, lng: 88.3546 }, // Barabazar
    { pincode: '700028', lat: 22.6225, lng: 88.4239 }, // Dum Dum
    { pincode: '711102', lat: 22.5634, lng: 88.3182 }, // Shibpur
    { pincode: '700091', lat: 22.5780, lng: 88.4310 }, // Salt Lake Sec 5
    { pincode: '700029', lat: 22.5130, lng: 88.3510 }, // Kalighat
  ];

  for (const p of pincodes) {
    await prisma.pincodeCoord.upsert({
      where: { pincode: p.pincode },
      update: p,
      create: p,
    });
  }

  // 4. Seed Products (~40 products across OTC, H, H1, X, NARCOTIC)
  console.log('Seeding Products...');
  const products = [
    // Brief exact required sample medicines
    { id: 'prod_metformin_500', name: 'Metformin', strength: '500 mg', form: 'Tablet', packSize: 'strip of 15', price: 30.00, schedule: ScheduleType.H },
    { id: 'prod_telmisartan_40', name: 'Telmisartan', strength: '40 mg', form: 'Tablet', packSize: 'strip of 10', price: 95.00, schedule: ScheduleType.H },
    { id: 'prod_levothyroxine_50', name: 'Levothyroxine', strength: '50 mcg', form: 'Tablet', packSize: 'bottle of 100', price: 190.00, schedule: ScheduleType.H },

    // Chronic Schedule H items
    { id: 'prod_amlodipine_5', name: 'Amlodipine', strength: '5 mg', form: 'Tablet', packSize: 'strip of 10', price: 42.00, schedule: ScheduleType.H },
    { id: 'prod_amlodipine_10', name: 'Amlodipine', strength: '10 mg', form: 'Tablet', packSize: 'strip of 10', price: 68.00, schedule: ScheduleType.H },
    { id: 'prod_atorvastatin_10', name: 'Atorvastatin', strength: '10 mg', form: 'Tablet', packSize: 'strip of 10', price: 78.00, schedule: ScheduleType.H },
    { id: 'prod_atorvastatin_20', name: 'Atorvastatin', strength: '20 mg', form: 'Tablet', packSize: 'strip of 10', price: 135.00, schedule: ScheduleType.H },
    { id: 'prod_pantoprazole_40', name: 'Pantoprazole', strength: '40 mg', form: 'Tablet', packSize: 'strip of 15', price: 85.00, schedule: ScheduleType.H },
    { id: 'prod_losartan_50', name: 'Losartan Potassium', strength: '50 mg', form: 'Tablet', packSize: 'strip of 10', price: 62.00, schedule: ScheduleType.H },
    { id: 'prod_glimepiride_1', name: 'Glimepiride', strength: '1 mg', form: 'Tablet', packSize: 'strip of 10', price: 45.00, schedule: ScheduleType.H },
    { id: 'prod_glimepiride_2', name: 'Glimepiride', strength: '2 mg', form: 'Tablet', packSize: 'strip of 10', price: 72.00, schedule: ScheduleType.H },
    { id: 'prod_metoprolol_25', name: 'Metoprolol Succinate', strength: '25 mg', form: 'Tablet', packSize: 'strip of 10', price: 58.00, schedule: ScheduleType.H },
    { id: 'prod_escitalopram_10', name: 'Escitalopram', strength: '10 mg', form: 'Tablet', packSize: 'strip of 10', price: 82.00, schedule: ScheduleType.H },
    { id: 'prod_clopidogrel_75', name: 'Clopidogrel', strength: '75 mg', form: 'Tablet', packSize: 'strip of 10', price: 110.00, schedule: ScheduleType.H },
    { id: 'prod_montelukast_10', name: 'Montelukast', strength: '10 mg', form: 'Tablet', packSize: 'strip of 10', price: 92.00, schedule: ScheduleType.H },
    { id: 'prod_stalevo_125', name: 'Stalevo 125 (Levodopa / Carbidopa / Entacapone)', strength: '125/31.25/200 mg', form: 'Tablet', packSize: 'strip of 10', price: 340.00, schedule: ScheduleType.H },

    // Generic substitution pair (ASSUMPTION A2)
    { id: 'prod_rosuvastatin_brand', name: 'Rosuvastatin (Crestor Brand)', strength: '10 mg', form: 'Tablet', packSize: 'strip of 10', price: 180.00, schedule: ScheduleType.H, genericGroupId: 'grp_rosuva_10' },
    { id: 'prod_rosuvastatin_generic', name: 'Rosuvastatin (Generic Equivalent)', strength: '10 mg', form: 'Tablet', packSize: 'strip of 10', price: 65.00, schedule: ScheduleType.H, genericGroupId: 'grp_rosuva_10' },

    // Schedule H1 (requires register entry)
    { id: 'prod_cefixime_200', name: 'Cefixime', strength: '200 mg', form: 'Tablet', packSize: 'strip of 10', price: 125.00, schedule: ScheduleType.H1 },
    { id: 'prod_meropenem_500', name: 'Meropenem', strength: '500 mg', form: 'Injection', packSize: 'vial of 1', price: 420.00, schedule: ScheduleType.H1 },
    { id: 'prod_alprazolam_05', name: 'Alprazolam', strength: '0.5 mg', form: 'Tablet', packSize: 'strip of 10', price: 38.00, schedule: ScheduleType.H1 },

    // Schedule X & Narcotic (CANNOT BE SOLD ONLINE)
    { id: 'prod_methylphenidate_10', name: 'Methylphenidate', strength: '10 mg', form: 'Tablet', packSize: 'strip of 10', price: 110.00, schedule: ScheduleType.X },
    { id: 'prod_fentanyl_patch', name: 'Fentanyl Transdermal', strength: '25 mcg/hr', form: 'Patch', packSize: 'box of 5', price: 850.00, schedule: ScheduleType.NARCOTIC },

    // OTC items
    { id: 'prod_paracetamol_650', name: 'Paracetamol', strength: '650 mg', form: 'Tablet', packSize: 'strip of 15', price: 32.00, schedule: ScheduleType.OTC },
    { id: 'prod_electral_ors', name: 'Electral ORS Powder', strength: '21.8 g', form: 'Sachet', packSize: 'pack of 5', price: 110.00, schedule: ScheduleType.OTC },
    { id: 'prod_cetirizine_10', name: 'Cetirizine', strength: '10 mg', form: 'Tablet', packSize: 'strip of 10', price: 28.00, schedule: ScheduleType.OTC },
    { id: 'prod_digene_liquid', name: 'Digene Antacid Gel', strength: '200 ml', form: 'Syrup', packSize: 'bottle of 200 ml', price: 145.00, schedule: ScheduleType.OTC },
    { id: 'prod_vitaminc_500', name: 'Vitamin C (Limcee)', strength: '500 mg', form: 'Chewable', packSize: 'strip of 15', price: 42.00, schedule: ScheduleType.OTC },
    { id: 'prod_volini_gel', name: 'Volini Pain Relief Gel', strength: '30 g', form: 'Gel', packSize: 'tube of 30 g', price: 95.00, schedule: ScheduleType.OTC },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { id: prod.id },
      update: prod,
      create: prod,
    });
  }

  // Generic substitute link
  await prisma.genericSubstitute.upsert({
    where: {
      originalProductId_genericProductId: {
        originalProductId: 'prod_rosuvastatin_brand',
        genericProductId: 'prod_rosuvastatin_generic',
      },
    },
    update: {},
    create: {
      originalProductId: 'prod_rosuvastatin_brand',
      genericProductId: 'prod_rosuvastatin_generic',
    },
  });

  // 5. Seed Users
  console.log('Seeding Users...');
  // Customers
  const debasish = await prisma.user.upsert({
    where: { phone: '9830011111' },
    update: { name: 'Debasish Ghosh', role: UserRole.CUSTOMER },
    create: { phone: '9830011111', name: 'Debasish Ghosh', role: UserRole.CUSTOMER },
  });

  const rina = await prisma.user.upsert({
    where: { phone: '9830022222' },
    update: { name: 'Rina Sen', role: UserRole.CUSTOMER },
    create: { phone: '9830022222', name: 'Rina Sen', role: UserRole.CUSTOMER },
  });

  const arif = await prisma.user.upsert({
    where: { phone: '9830033333' },
    update: { name: 'Arif Mondal', role: UserRole.CUSTOMER },
    create: { phone: '9830033333', name: 'Arif Mondal', role: UserRole.CUSTOMER },
  });

  // Pharmacists
  const pharmacist1 = await prisma.user.upsert({
    where: { phone: '9830044444' },
    update: { name: 'Sunita Banerjee', role: UserRole.PHARMACIST, pharmacistRegNo: 'WB-PHARM-2024-4102' },
    create: { phone: '9830044444', name: 'Sunita Banerjee', role: UserRole.PHARMACIST, pharmacistRegNo: 'WB-PHARM-2024-4102' },
  });

  await prisma.user.upsert({
    where: { phone: '9830055555' },
    update: { name: 'Rajesh Dey', role: UserRole.PHARMACIST, pharmacistRegNo: 'WB-PHARM-2023-8831' },
    create: { phone: '9830055555', name: 'Rajesh Dey', role: UserRole.PHARMACIST, pharmacistRegNo: 'WB-PHARM-2023-8831' },
  });

  // Store Staff (1 per store)
  await prisma.user.upsert({
    where: { phone: '9830066661' },
    update: { name: 'Bikash Das (Staff)', role: UserRole.STORE_STAFF, storeId: 'store_saltlake' },
    create: { phone: '9830066661', name: 'Bikash Das (Staff)', role: UserRole.STORE_STAFF, storeId: 'store_saltlake' },
  });

  await prisma.user.upsert({
    where: { phone: '9830066662' },
    update: { name: 'Tapas Roy (Staff)', role: UserRole.STORE_STAFF, storeId: 'store_behala' },
    create: { phone: '9830066662', name: 'Tapas Roy (Staff)', role: UserRole.STORE_STAFF, storeId: 'store_behala' },
  });

  // Ops User
  await prisma.user.upsert({
    where: { phone: '9830099999' },
    update: { name: 'Anirban Sen (Ops)', role: UserRole.OPS },
    create: { phone: '9830099999', name: 'Anirban Sen (Ops)', role: UserRole.OPS },
  });

  // Family Profiles
  const debasishMother = await prisma.familyProfile.upsert({
    where: { id: 'prof_debasish_mother' },
    update: { name: 'Anjali Ghosh', relationship: 'mother', userId: debasish.id },
    create: { id: 'prof_debasish_mother', name: 'Anjali Ghosh', relationship: 'mother', userId: debasish.id },
  });

  const rinaSelf = await prisma.familyProfile.upsert({
    where: { id: 'prof_rina_self' },
    update: { name: 'Rina Sen', relationship: 'self', userId: rina.id },
    create: { id: 'prof_rina_self', name: 'Rina Sen', relationship: 'self', userId: rina.id },
  });

  const arifSelf = await prisma.familyProfile.upsert({
    where: { id: 'prof_arif_self' },
    update: { name: 'Arif Mondal', relationship: 'self', userId: arif.id },
    create: { id: 'prof_arif_self', name: 'Arif Mondal', relationship: 'self', userId: arif.id },
  });

  // Customer Addresses
  await prisma.customerAddress.upsert({
    where: { id: 'addr_debasish' },
    update: {},
    create: {
      id: 'addr_debasish',
      userId: debasish.id,
      label: 'Home',
      addressText: 'Block BD-12, Sector 1, Salt Lake, Kolkata',
      pincode: '700064',
      lat: 22.5875,
      lng: 88.4190,
    },
  });

  await prisma.customerAddress.upsert({
    where: { id: 'addr_rina' },
    update: {},
    create: {
      id: 'addr_rina',
      userId: rina.id,
      label: 'Home',
      addressText: '24 James Long Sarani, Behala, Kolkata',
      pincode: '700034',
      lat: 22.4990,
      lng: 88.3180,
    },
  });

  await prisma.customerAddress.upsert({
    where: { id: 'addr_arif' },
    update: {},
    create: {
      id: 'addr_arif',
      userId: arif.id,
      label: 'Home',
      addressText: '8 Nityadhan Mukherjee Rd, Howrah',
      pincode: '711101',
      lat: 22.5890,
      lng: 88.3240,
    },
  });

  // 6. Import Stock from CSV
  console.log('Importing Store Stock from CSV...');
  const csvPath = path.resolve(__dirname, '../seed/stock-2026-11-04.csv');
  if (fs.existsSync(csvPath)) {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.trim().split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length >= 3) {
        const storeId = parts[0];
        const productId = parts[1];
        const quantity = parseInt(parts[2], 10);

        await prisma.storeStock.upsert({
          where: {
            storeId_productId: {
              storeId,
              productId,
            },
          },
          update: { quantity, lastUpdated: new Date() },
          create: {
            storeId,
            productId,
            quantity,
          },
        });
      }
    }
  }

  // 7. Read sample synthetic prescription images
  console.log('Attaching synthetic prescription images to sample orders...');
  const rx1ImgPath = path.resolve(__dirname, '../seed/prescriptions/rx_50211_metformin_clean.png');
  const rx2ImgPath = path.resolve(__dirname, '../seed/prescriptions/rx_50214_telmisartan.png');
  const rx3ImgPath = path.resolve(__dirname, '../seed/prescriptions/rx_50219_levothyroxine.png');

  const rx1Buffer = fs.existsSync(rx1ImgPath) ? fs.readFileSync(rx1ImgPath) : Buffer.from('synthetic_rx1');
  const rx2Buffer = fs.existsSync(rx2ImgPath) ? fs.readFileSync(rx2ImgPath) : Buffer.from('synthetic_rx2');
  const rx3Buffer = fs.existsSync(rx3ImgPath) ? fs.readFileSync(rx3ImgPath) : Buffer.from('synthetic_rx3');

  const enc1 = encryptPrescription(rx1Buffer);
  const enc2 = encryptPrescription(rx2Buffer);
  const enc3 = encryptPrescription(rx3Buffer);

  const validity6Months = new Date();
  validity6Months.setMonth(validity6Months.getMonth() + 6);

  // 8. Seed the 3 Sample Orders from the Client Brief Verbatim
  console.log('Seeding Sample Orders (RX-50211, RX-50214, RX-50219)...');

  // Sample Order 1: RX-50211 | Debasish Ghosh, for mother | Metformin 500 mg, strip of 15 | H | Qty 4 | Price ₹120 | Approved | Salt Lake | Packed
  const order1 = await prisma.order.upsert({
    where: { displayId: 'RX-50211' },
    update: {},
    create: {
      displayId: 'RX-50211',
      customerId: debasish.id,
      familyProfileId: debasishMother.id,
      storeId: 'store_saltlake',
      status: OrderStatus.PACKED,
      addressText: 'Block BD-12, Sector 1, Salt Lake, Kolkata - 700064',
      addressLat: 22.5875,
      addressLng: 88.4190,
      paymentMethod: 'COD',
      prescriptionEncrypted: new Uint8Array(enc1.encrypted),
      prescriptionIv: new Uint8Array(enc1.iv),
      prescriptionAuthTag: new Uint8Array(enc1.authTag),
      prescriptionMime: 'image/png',
      prescriptionStatus: PrescriptionStatus.APPROVED,
      prescriptionValidUntil: validity6Months,
      aiModelName: 'microsoft/trocr-base-handwritten',
      aiLatencyMs: 820,
    },
  });

  await prisma.orderLine.deleteMany({ where: { orderId: order1.id } });
  await prisma.orderLine.create({
    data: {
      orderId: order1.id,
      productId: 'prod_metformin_500',
      rawText: 'Tab. Metformin 500 mg, strip of 15 (4 strips)',
      aiDrugName: 'Metformin',
      aiStrength: '500 mg',
      aiConfidence: 0.98,
      lineStatus: LineStatus.APPROVED,
      quantity: 4,
      unitPrice: 30.00,
      pharmacistId: pharmacist1.id,
      pharmacistRegNo: 'WB-PHARM-2024-4102',
    },
  });

  // Sample Order 2: RX-50214 | Rina Sen | Telmisartan 40 mg, strip of 10 | H | Qty 3 | Price ₹285 | Pending | Behala | Awaiting pharmacist
  const order2 = await prisma.order.upsert({
    where: { displayId: 'RX-50214' },
    update: {},
    create: {
      displayId: 'RX-50214',
      customerId: rina.id,
      familyProfileId: rinaSelf.id,
      storeId: 'store_behala',
      status: OrderStatus.SUBMITTED,
      addressText: '24 James Long Sarani, Behala, Kolkata - 700034',
      addressLat: 22.4990,
      addressLng: 88.3180,
      paymentMethod: 'MOCK_UPI',
      prescriptionEncrypted: new Uint8Array(enc2.encrypted),
      prescriptionIv: new Uint8Array(enc2.iv),
      prescriptionAuthTag: new Uint8Array(enc2.authTag),
      prescriptionMime: 'image/png',
      prescriptionStatus: PrescriptionStatus.PENDING,
      prescriptionValidUntil: validity6Months,
      aiModelName: 'microsoft/trocr-base-handwritten',
      aiLatencyMs: 910,
    },
  });

  await prisma.orderLine.deleteMany({ where: { orderId: order2.id } });
  await prisma.orderLine.create({
    data: {
      orderId: order2.id,
      productId: 'prod_telmisartan_40',
      rawText: 'Tab. Telmisartan 40 mg, strip of 10 (3 strips)',
      aiDrugName: 'Telmisartan',
      aiStrength: '40 mg',
      aiConfidence: 0.95,
      lineStatus: LineStatus.PENDING,
      quantity: 3,
      unitPrice: 95.00,
    },
  });

  // Sample Order 3: RX-50219 | Arif Mondal | Levothyroxine 50 mcg, bottle of 100 | H | Qty 1 | Price ₹190 | Re-upload asked | Howrah Maidan | On hold
  const order3 = await prisma.order.upsert({
    where: { displayId: 'RX-50219' },
    update: {},
    create: {
      displayId: 'RX-50219',
      customerId: arif.id,
      familyProfileId: arifSelf.id,
      storeId: 'store_howrah_maidan',
      status: OrderStatus.ON_HOLD,
      addressText: '8 Nityadhan Mukherjee Rd, Howrah - 711101',
      addressLat: 22.5890,
      addressLng: 88.3240,
      paymentMethod: 'COD',
      prescriptionEncrypted: new Uint8Array(enc3.encrypted),
      prescriptionIv: new Uint8Array(enc3.iv),
      prescriptionAuthTag: new Uint8Array(enc3.authTag),
      prescriptionMime: 'image/png',
      prescriptionStatus: PrescriptionStatus.RE_UPLOAD_ASKED,
      prescriptionValidUntil: validity6Months,
      manualEntryNeeded: true,
      aiModelName: 'microsoft/trocr-base-handwritten',
      aiLatencyMs: 1100,
    },
  });

  await prisma.orderLine.deleteMany({ where: { orderId: order3.id } });
  await prisma.orderLine.create({
    data: {
      orderId: order3.id,
      productId: 'prod_levothyroxine_50',
      rawText: 'Tab. Levothyroxine 50 mcg, bottle of 100',
      aiDrugName: 'Levothyroxine',
      aiStrength: '50 mcg',
      aiConfidence: 0.72,
      lineStatus: LineStatus.PENDING,
      quantity: 1,
      unitPrice: 190.00,
      rejectReason: 'Prescription image is blurry and illegible. Please upload a clear photo showing doctor signature and date.',
    },
  });

  // 9. Seed Refill Tracker for Debasish (mother)
  console.log('Seeding Refill Trackers...');
  const runOutDate = new Date();
  runOutDate.setDate(runOutDate.getDate() + 30); // 30 days of supply

  await prisma.refillTracker.upsert({
    where: {
      familyProfileId_productId: {
        familyProfileId: debasishMother.id,
        productId: 'prod_metformin_500',
      },
    },
    update: {
      unitsDispensed: 60,
      unitsPerDay: 2,
      daysOfSupply: 30,
      runOutDate,
      remindDaysBefore: 5,
      reminderSent: false,
    },
    create: {
      familyProfileId: debasishMother.id,
      productId: 'prod_metformin_500',
      unitsDispensed: 60,
      unitsPerDay: 2,
      daysOfSupply: 30,
      runOutDate,
      remindDaysBefore: 5,
      reminderSent: false,
      lastOrderId: order1.id,
    },
  });

  console.log('✅ MedKart Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
