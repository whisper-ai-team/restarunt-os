// restaurantConfig.js - Dynamic restaurant resolution from database

import { PrismaClient } from '@prisma/client';
import { decrypt } from './encryption.js';

const prisma = new PrismaClient();

/**
 * Get restaurant configuration by phone number
 * This is the CORE multi-tenant routing function
 * 
 * @param {string} phoneNumber - E.164 format: +12013444638
 * @returns {Promise<Object>} Restaurant configuration
 */
export async function getRestaurantByPhone(phoneNumber) {
  // Query database for restaurant
  const restaurant = await prisma.restaurant.findUnique({
    where: { phoneNumber: phoneNumber },
    include: { printers: true }
  });

  if (!restaurant) {
    throw new Error(`No restaurant found for phone number: ${phoneNumber}`);
  }

  if (!restaurant.isActive) {
    throw new Error(`Restaurant ${restaurant.name} is inactive`);
  }

  // Decrypt Clover API key
  const decryptedApiKey = decrypt(restaurant.cloverApiKey);

  // Return in format expected by agent
  return {
    id: restaurant.id,
    name: restaurant.name,
    phone: restaurant.phoneNumber,
    slug: restaurant.slug,
    
    // Clover POS credentials
    clover: {
      merchantId: restaurant.cloverMerchantId,
      apiKey: decryptedApiKey,
      ecommToken: restaurant.cloverEcommerceToken ? decrypt(restaurant.cloverEcommerceToken) : null,
      environment: restaurant.cloverEnvironment
    },
    
    // Location info (for SMS, receipts)
    location: {
      address: restaurant.address,
      city: restaurant.city,
      state: restaurant.state,
      zipCode: restaurant.zipCode,
      country: restaurant.country
    },
    
    // Cuisine & branding
    cuisineType: restaurant.cuisineType,
    logo: restaurant.logo,
    primaryColor: restaurant.primaryColor,
    
    // Voice AI settings
    voiceSelection: restaurant.voiceSelection,
    greeting: restaurant.greeting || `Welcome to ${restaurant.name}. How may I help you today?`,
    
    // POS device settings
    printing: {
      autoPrint: restaurant.autoPrint,
      defaultPrinterId: restaurant.defaultPrinterId,
      autoPrint: restaurant.autoPrint,
      defaultPrinterId: restaurant.defaultPrinterId,
      deviceId: restaurant.deviceId,
      printers: restaurant.printers || [] // Add printers array
    },
    
    // Legacy compatibility (used by some parts of agent.js)
    info: `${restaurant.name} in ${restaurant.city}, ${restaurant.state}`,
    instructions: `You are a helpful assistant at ${restaurant.name}, specializing in ${restaurant.cuisineType} cuisine.`
  };
}

/**
 * Get all active restaurants (for admin dashboard)
 */
export async function getAllRestaurants() {
  return prisma.restaurant.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      phoneNumber: true,
      city: true,
      state: true,
      cuisineType: true,
      _count: {
        select: { orders: true }
      }
    }
  });
}

/**
 * Create a new restaurant (for onboarding)
 */
export async function createRestaurant(data) {
  const { encrypt } = await import('./encryption.js');
  
  return prisma.restaurant.create({
    data: {
      ...data,
      cloverApiKey: encrypt(data.cloverApiKey), // Encrypt API key
      slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-')
    }
  });
}

/**
 * Get restaurant by ID (for admin dashboard)
 */
export async function getRestaurantById(id) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id }
  });
  
  if (!restaurant) return null;
  
  // Return without decrypting API key for security unless explicit (admin UI shouldn't show full key)
  // But we might need to verify it exists
  return {
    ...restaurant,
    cloverApiKey: '********' // Masked for security
  };
}

/**
 * Update restaurant configuration
 */
export async function updateRestaurant(id, data) {
  const { encrypt } = await import('./encryption.js');
  
  const updateData = { ...data };
  
  // Encrypt API key if it's being updated
  if (updateData.cloverApiKey && !updateData.cloverApiKey.includes('***')) {
    updateData.cloverApiKey = encrypt(updateData.cloverApiKey);
  } else {
    delete updateData.cloverApiKey; // Don't update if masked
  }
  
  return prisma.restaurant.update({
    where: { id },
    data: updateData
  });
}


/**
 * Create a new printer for a restaurant
 * @param {string} restaurantId 
 * @param {Object} data - { name, deviceId, categories, isDefault }
 */
export async function createPrinter(restaurantId, data) {
  return await prisma.printer.create({
    data: {
      ...data,
      restaurantId
    }
  });
}


/**
 * Delete a printer
 * @param {string} printerId 
 */
export async function deletePrinter(printerId) {
  return await prisma.printer.delete({
    where: { id: printerId }
  });
}

/**
 * Get internal restaurant config with decrypted keys (Use with caution!)
 */
export async function getRestaurantConfigInternal(id) {
  const { decrypt } = await import('./encryption.js');
  
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: { printers: true }
  });

  if (!restaurant) throw new Error("Restaurant not found");

  const decryptedApiKey = decrypt(restaurant.cloverApiKey);

  return {
    ...restaurant,
    clover: {
      merchantId: restaurant.cloverMerchantId,
      apiKey: decryptedApiKey,
      ecommToken: restaurant.cloverEcommerceToken ? decrypt(restaurant.cloverEcommerceToken) : null,
      environment: restaurant.cloverEnvironment
    },
    printing: {
      autoPrint: restaurant.autoPrint,
      defaultPrinterId: restaurant.defaultPrinterId,
      deviceId: restaurant.deviceId,
      printers: restaurant.printers || []
    }
  };
}
