// cloverPrint.js - Kitchen & Multi-Device Printer Routing

import fetch from 'node-fetch';

/**
 * Route print jobs to multiple printers based on categories
 * @param {string} cloverOrderId - Clover order ID
 * @param {Object} restaurantConfig - Config with printers list
 * @param {Array} items - Cart items with categories
 */
export async function routePrintJobs(cloverOrderId, restaurantConfig, items = []) {
  const { printers, deviceId } = restaurantConfig.printing;
  
  // Legacy Fallback: Singular Device ID
  if (!printers || printers.length === 0) {
    if (deviceId) {
      console.log(`🖨️  Legacy Routing: Printing to default device (${deviceId})`);
      await sendPrintEvent(cloverOrderId, deviceId, restaurantConfig);
    } else {
      console.log('⚠️  No printers configured for this restaurant.');
    }
    return;
  }
  
  // Smart Routing: Iterate all configured printers
  let printedCount = 0;
  
  for (const printer of printers) {
    if (shouldPrintToDevice(printer, items)) {
      console.log(`🖨️  Routing order to "${printer.name}" (${printer.deviceId})...`);
      try {
        await sendPrintEvent(cloverOrderId, printer.deviceId, restaurantConfig);
        printedCount++;
      } catch (err) {
        console.error(`❌ Print failed for ${printer.name}: ${err.message}`);
      }
    }
  }
  
  if (printedCount === 0) {
    console.log('⚠️  Order did not match any printer categories (and no default catch-all).');
  }
}

// Backward compatibility alias
export const printOrderToKitchen = routePrintJobs;

/**
 * Determine if an order should print to a specific device
 * Logic:
 * 1. If printer categories has "*", ALWAYS print.
 * 2. If printer categories has "Drinks" and order has item with "Drinks", PRINT.
 */
function shouldPrintToDevice(printer, items) {
  // 1. Wildcard check
  if (printer.categories.includes('*') || (printer.categories.length === 0 && printer.isDefault)) {
    return true;
  }
  
  // 2. Category Intersection
  // Flatten all item categories into a set
  const orderCategories = new Set();
  items.forEach(item => {
    if (item.categories && Array.isArray(item.categories)) {
      item.categories.forEach(c => orderCategories.add(c.toLowerCase()));
    }
  });
  
  // Check intersection
  return printer.categories.some(cat => orderCategories.has(cat.toLowerCase()));
}


/**
 * Core function to send print event to a specific device
 */
async function sendPrintEvent(cloverOrderId, deviceId, restaurantConfig) {
  const { merchantId, apiKey, environment } = restaurantConfig.clover;
  const baseUrl = environment === 'sandbox' 
    ? 'https://sandbox.dev.clover.com' 
    : 'https://api.clover.com';

  const response = await fetch(
    `${baseUrl}/v3/merchants/${merchantId}/print_event`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orderRef: { id: cloverOrderId },
        deviceRef: { id: deviceId }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Clover API Error: ${response.status} - ${error}`);
  }
  
  console.log(`✅ Print event sent to device ${deviceId}`);
  return await response.json();
}

/**
 * Get list of available Clover devices
 */
export async function getCloverDevices(restaurantConfig) {
  const { merchantId, apiKey, environment } = restaurantConfig.clover;
  const baseUrl = environment === 'sandbox' 
    ? 'https://sandbox.dev.clover.com' 
    : 'https://api.clover.com';

  const response = await fetch(`${baseUrl}/v3/merchants/${merchantId}/devices`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!response.ok) throw new Error(`Failed to fetch devices: ${response.statusText}`);

  const data = await response.json();
  return (data.elements || []).map(d => ({
    id: d.id,
    name: d.name || d.serial,
    model: d.model,
    isPrinter: d.model?.toLowerCase().includes('printer') || d.model?.toLowerCase().includes('station')
  }));
}
