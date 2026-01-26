import POSAdapter from './base.js';

/**
 * Square POS Adapter
 * Transforms Square API responses to universal menu format
 */
class SquareAdapter extends POSAdapter {
  getBaseUrl() {
    const env = this.credentials.environment || 'production';
    return env === 'sandbox'
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
  }

  async fetchMenu() {
    const { accessToken } = this.credentials;
    const baseUrl = this.getBaseUrl();

    try {
      // Fetch catalog from Square
      const response = await fetch(
        `${baseUrl}/v2/catalog/list?types=ITEM,CATEGORY,MODIFIER_LIST`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Square-Version': '2024-01-18',
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Square API error: ${response.status} ${response.statusText}`);
      }

      const { objects = [] } = await response.json();

      const categories = objects.filter(obj => obj.type === 'CATEGORY');
      const items = objects.filter(obj => obj.type === 'ITEM');
      const modifierLists = objects.filter(obj => obj.type === 'MODIFIER_LIST');

      console.log(`✅ Fetched ${items.length} items, ${categories.length} categories, ${modifierLists.length} modifier lists from Square`);

      // Transform to universal format
      return this.transformToUniversalMenu(items, categories, modifierLists);

    } catch (err) {
      console.error('❌ Square menu fetch failed:', err);
      throw err;
    }
  }

  transformToUniversalMenu(squareItems, squareCategories, modifierLists) {
    // Create modifier lookup map
    const modifierMap = new Map();
    modifierLists.forEach(modList => {
      modifierMap.set(modList.id, modList);
    });

    // Transform categories
    const categories = squareCategories.map(cat => ({
      id: this.generateUniversalId('square-cat', cat.id),
      posId: cat.id,
      name: cat.category_data.name,
      items: [],
      sortOrder: cat.category_data.ordinal || 0
    }));

    // Transform items
    const items = squareItems
      .filter(item => !item.is_deleted && item.item_data)
      .map(item => {
        const itemData = item.item_data;
        const variation = itemData.variations?.[0]; // Use first variation
        const variationData = variation?.item_variation_data;

        return {
          id: this.generateUniversalId('square-item', item.id),
          posId: item.id,
          variationId: variation?.id, // Store for order creation
          name: itemData.name,
          description: itemData.description || '',
          price: variationData?.price_money?.amount || 0, // Square uses cents
          category: itemData.category_id || 'uncategorized',
          available: itemData.available_online !== false && itemData.available_for_pickup !== false,
          modifiers: this.transformModifiers(itemData.modifier_list_info || [], modifierMap),
          taxable: (itemData.tax_ids?.length || 0) > 0,
          image: null, // Square images require separate API call
          tags: []
        };
      });

    // Group items by category
    categories.forEach(cat => {
      cat.items = items.filter(item => item.category === cat.posId);
    });

    // Add uncategorized items if any
    const uncategorizedItems = items.filter(item => item.category === 'uncategorized');
    if (uncategorizedItems.length > 0) {
      categories.push({
        id: this.generateUniversalId('square-cat', 'uncategorized'),
        posId: 'uncategorized',
        name: 'Other Items',
        items: uncategorizedItems,
        sortOrder: 9999
      });
    }

    return {
      posType: 'square',
      categories: categories
        .filter(cat => cat.items.length > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder),
      lastSynced: new Date(),
      version: `square-${Date.now()}`
    };
  }

  transformModifiers(modifierListInfo = [], modifierMap) {
    return modifierListInfo.map(info => {
      const modList = modifierMap.get(info.modifier_list_id);
      
      if (!modList || !modList.modifier_list_data) {
        return {
          id: this.generateUniversalId('square-mod', info.modifier_list_id),
          posId: info.modifier_list_id,
          name: 'Options',
          required: false,
          maxSelections: null,
          options: []
        };
      }

      const modListData = modList.modifier_list_data;
      
      return {
        id: this.generateUniversalId('square-mod', modList.id),
        posId: modList.id,
        name: modListData.name || 'Options',
        required: info.min_selected_modifiers > 0,
        maxSelections: info.max_selected_modifiers || null,
        options: (modListData.modifiers || []).map(mod => ({
          id: this.generateUniversalId('square-opt', mod.id),
          posId: mod.id,
          name: mod.modifier_data.name,
          priceAdjustment: mod.modifier_data.price_money?.amount || 0
        }))
      };
    });
  }

  async createOrder(orderDetails) {
    const { accessToken, locationId } = this.credentials;
    const baseUrl = this.getBaseUrl();

    if (!locationId) {
      throw new Error('Square location ID is required to create orders');
    }

    // Transform universal order to Square format
    const squareOrder = {
      order: {
        location_id: locationId,
        line_items: orderDetails.items.map(item => ({
          catalog_object_id: item.variationId || item.posId,
          quantity: (item.quantity || 1).toString(),
          modifiers: item.modifiers?.map(mod => ({
            catalog_object_id: mod.posId,
            quantity: '1'
          })) || []
        })),
        state: 'OPEN'
      }
    };

    const response = await fetch(
      `${baseUrl}/v2/orders`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(squareOrder)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Square order creation failed: ${response.status} - ${errorText}`);
    }

    const { order } = await response.json();
    console.log(`✅ Created Square order: ${order.id}`);
    
    return {
      posOrderId: order.id,
      status: 'created',
      raw: order
    };
  }

  async getOrderStatus(orderId) {
    const { accessToken } = this.credentials;
    const baseUrl = this.getBaseUrl();

    const response = await fetch(
      `${baseUrl}/v2/orders/${orderId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2024-01-18'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Square order fetch failed: ${response.status}`);
    }

    const { order } = await response.json();
    return order;
  }

  async getLocations() {
    const { accessToken } = this.credentials;
    const baseUrl = this.getBaseUrl();

    const response = await fetch(
      `${baseUrl}/v2/locations`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Square-Version': '2024-01-18'
        }
      }
    );

    if (!response.ok) {
      return [];
    }

    const { locations = [] } = await response.json();
    return locations.map(location => ({
      id: location.id,
      name: location.name,
      address: location.address,
      status: location.status
    }));
  }
}

export default SquareAdapter;

