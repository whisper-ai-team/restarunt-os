import POSAdapter from './base.js';

/**
 * Clover POS Adapter
 * Transforms Clover API responses to universal menu format
 */
class CloverAdapter extends POSAdapter {
  getBaseUrl() {
    const env = this.credentials.environment || 'production';
    return env === 'sandbox' 
      ? 'https://sandbox.dev.clover.com'
      : 'https://api.clover.com';
  }

  async fetchMenu() {
    const { apiKey, merchantId } = this.credentials;
    const baseUrl = this.getBaseUrl();

    try {
      // Fetch items from Clover
      const itemsRes = await fetch(
        `${baseUrl}/v3/merchants/${merchantId}/items?expand=categories,modifierGroups,taxRates`,
        { 
          headers: { 
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!itemsRes.ok) {
        throw new Error(`Clover API error: ${itemsRes.status} ${itemsRes.statusText}`);
      }

      const { elements: cloverItems } = await itemsRes.json();

      // Fetch categories
      const categoriesRes = await fetch(
        `${baseUrl}/v3/merchants/${merchantId}/categories`,
        { 
          headers: { 
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!categoriesRes.ok) {
        throw new Error(`Clover API error: ${categoriesRes.status} ${categoriesRes.statusText}`);
      }

      const { elements: cloverCategories } = await categoriesRes.json();

      console.log(`✅ Fetched ${cloverItems.length} items and ${cloverCategories.length} categories from Clover`);

      // Transform to universal format
      return this.transformToUniversalMenu(cloverItems, cloverCategories);

    } catch (err) {
      console.error('❌ Clover menu fetch failed:', err);
      throw err;
    }
  }

  transformToUniversalMenu(cloverItems, cloverCategories) {
    // Transform categories
    const categories = cloverCategories.map(cat => ({
      id: this.generateUniversalId('clover-cat', cat.id),
      posId: cat.id,
      name: cat.name,
      items: [],
      sortOrder: cat.sortOrder || 0
    }));

    // Transform items
    const items = cloverItems
      .filter(item => !item.hidden) // Filter out hidden items
      .map(item => ({
        id: this.generateUniversalId('clover-item', item.id),
        posId: item.id,
        name: item.name,
        description: item.description || '',
        price: item.price || 0, // Clover uses cents
        category: item.categories?.elements?.[0]?.id || 'uncategorized',
        available: item.available !== false,
        modifiers: this.transformModifiers(item.modifierGroups?.elements || []),
        taxable: item.defaultTaxRates?.elements?.length > 0,
        image: null, // Clover images require separate API call
        tags: []
      }));

    // Group items by category
    categories.forEach(cat => {
      cat.items = items.filter(item => item.category === cat.posId);
    });

    // Add uncategorized items if any
    const uncategorizedItems = items.filter(item => item.category === 'uncategorized');
    if (uncategorizedItems.length > 0) {
      categories.push({
        id: this.generateUniversalId('clover-cat', 'uncategorized'),
        posId: 'uncategorized',
        name: 'Other Items',
        items: uncategorizedItems,
        sortOrder: 9999
      });
    }

    return {
      posType: 'clover',
      categories: categories
        .filter(cat => cat.items.length > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder),
      lastSynced: new Date(),
      version: `clover-${Date.now()}`
    };
  }

  transformModifiers(modifierGroups = []) {
    return modifierGroups.map(group => ({
      id: this.generateUniversalId('clover-mod', group.id),
      posId: group.id,
      name: group.name,
      required: (group.minRequired || 0) > 0,
      maxSelections: group.maxAllowed || null,
      options: (group.modifiers?.elements || []).map(mod => ({
        id: this.generateUniversalId('clover-opt', mod.id),
        posId: mod.id,
        name: mod.name,
        priceAdjustment: mod.price || 0
      }))
    }));
  }

  async createOrder(orderDetails) {
    const { apiKey, merchantId } = this.credentials;
    const baseUrl = this.getBaseUrl();

    // Transform universal order to Clover format
    const cloverOrder = {
      state: 'open',
      lineItems: orderDetails.items.map(item => ({
        item: { id: item.posId },
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        modifications: item.modifiers?.map(mod => ({
          modifier: { id: mod.posId },
          name: mod.name,
          amount: mod.priceAdjustment
        })) || []
      }))
    };

    const response = await fetch(
      `${baseUrl}/v3/merchants/${merchantId}/orders`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(cloverOrder)
      }
    );

    if (!response.ok) {
      throw new Error(`Clover order creation failed: ${response.status}`);
    }

    const createdOrder = await response.json();
    console.log(`✅ Created Clover order: ${createdOrder.id}`);
    
    return {
      posOrderId: createdOrder.id,
      status: 'created',
      raw: createdOrder
    };
  }

  async getOrderStatus(orderId) {
    const { apiKey, merchantId } = this.credentials;
    const baseUrl = this.getBaseUrl();

    const response = await fetch(
      `${baseUrl}/v3/merchants/${merchantId}/orders/${orderId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Clover order fetch failed: ${response.status}`);
    }

    return await response.json();
  }

  async getPrinters() {
    const { apiKey, merchantId } = this.credentials;
    const baseUrl = this.getBaseUrl();

    const response = await fetch(
      `${baseUrl}/v3/merchants/${merchantId}/printers`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      return [];
    }

    const { elements: printers } = await response.json();
    return printers.map(printer => ({
      id: printer.id,
      name: printer.name,
      type: printer.type,
      enabled: printer.enabled
    }));
  }
}

export default CloverAdapter;

