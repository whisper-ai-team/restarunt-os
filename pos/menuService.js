import POSAdapterFactory from './adapters/factory.js';

/**
 * Menu Service
 * Manages menu fetching, caching, and synchronization across different POS systems
 */
class MenuService {
  constructor() {
    // In-memory cache (use Redis in production for multi-instance deployments)
    this.cache = new Map();
    
    // Cache TTL in minutes
    this.cacheTTL = 30;
    
    console.log('📋 Menu Service initialized');
  }

  /**
   * Get menu for a restaurant (with caching)
   * @param {Object} restaurant - Restaurant object from database
   * @param {Object} prisma - Prisma client instance
   * @returns {Promise<Menu>} Universal menu object
   */
  async getMenu(restaurant, prisma = null) {
    const cacheKey = `menu:${restaurant.id}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      const ageMinutes = (Date.now() - cached.timestamp) / 1000 / 60;
      
      // Return cached if still valid
      if (ageMinutes < this.cacheTTL) {
        console.log(`📦 Serving cached menu for ${restaurant.name} (age: ${Math.round(ageMinutes)}m)`);
        return cached.menu;
      } else {
        console.log(`⏰ Cache expired for ${restaurant.name} (age: ${Math.round(ageMinutes)}m)`);
      }
    }
    
    // Check if POS is connected
    if (!POSAdapterFactory.hasPOS(restaurant)) {
      console.warn(`⚠️ No POS connected for ${restaurant.name}, returning empty menu`);
      return this.getEmptyMenu(restaurant);
    }
    
    // Fetch fresh menu from POS
    console.log(`🔄 Fetching fresh menu for ${restaurant.name}`);
    
    try {
      const adapter = POSAdapterFactory.create(restaurant);
      const menu = await adapter.fetchMenu();
      
      // Add restaurant metadata
      menu.restaurantId = restaurant.id;
      menu.restaurantName = restaurant.name;
      
      // Update cache
      this.cache.set(cacheKey, {
        menu,
        timestamp: Date.now()
      });
      
      console.log(`✅ Cached menu for ${restaurant.name} (${menu.categories.length} categories, ${this.countItems(menu)} items)`);
      
      // Save to database for offline fallback (if prisma available)
      if (prisma) {
        await this.saveMenuToDatabase(restaurant.id, menu, prisma);
      }
      
      return menu;
      
    } catch (err) {
      console.error(`❌ Failed to fetch menu for ${restaurant.name}:`, err.message);
      
      // Try to load from database as fallback
      if (prisma) {
        console.log(`🔄 Attempting to load menu from database...`);
        const fallbackMenu = await this.loadMenuFromDatabase(restaurant.id, prisma);
        if (fallbackMenu) {
          return fallbackMenu;
        }
      }
      
      // Return empty menu as last resort
      return this.getEmptyMenu(restaurant);
    }
  }

  /**
   * Invalidate cache for a restaurant
   * @param {string} restaurantId - Restaurant ID
   */
  invalidateCache(restaurantId) {
    const cacheKey = `menu:${restaurantId}`;
    if (this.cache.has(cacheKey)) {
      this.cache.delete(cacheKey);
      console.log(`🗑️ Menu cache invalidated for restaurant ${restaurantId}`);
      return true;
    }
    return false;
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    const count = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ Cleared ${count} cached menus`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const stats = {
      totalCached: this.cache.size,
      entries: []
    };
    
    this.cache.forEach((value, key) => {
      const ageMinutes = (Date.now() - value.timestamp) / 1000 / 60;
      stats.entries.push({
        key,
        ageMinutes: Math.round(ageMinutes),
        expired: ageMinutes >= this.cacheTTL,
        itemCount: this.countItems(value.menu)
      });
    });
    
    return stats;
  }

  /**
   * Save menu to database
   */
  async saveMenuToDatabase(restaurantId, menu, prisma) {
    try {
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: {
          menuCache: menu,
          menuLastSynced: new Date()
        }
      });
      console.log(`💾 Saved menu to database for restaurant ${restaurantId}`);
    } catch (err) {
      console.error(`Failed to save menu to database:`, err.message);
    }
  }

  /**
   * Load menu from database fallback
   */
  async loadMenuFromDatabase(restaurantId, prisma) {
    try {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { menuCache: true, menuLastSynced: true }
      });
      
      if (restaurant && restaurant.menuCache) {
        console.log(`✅ Loaded menu from database (last synced: ${restaurant.menuLastSynced})`);
        return restaurant.menuCache;
      }
    } catch (err) {
      console.error(`Failed to load menu from database:`, err.message);
    }
    
    return null;
  }

  /**
   * Get empty menu structure
   */
  getEmptyMenu(restaurant) {
    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      posType: null,
      categories: [],
      lastSynced: new Date(),
      version: `empty-${Date.now()}`
    };
  }

  /**
   * Count total items in menu
   */
  countItems(menu) {
    return menu.categories.reduce((total, cat) => total + cat.items.length, 0);
  }

  /**
   * Find item by name (fuzzy search)
   */
  findItem(menu, itemName) {
    const searchTerm = itemName.toLowerCase().trim();
    
    for (const category of menu.categories) {
      for (const item of category.items) {
        if (item.name.toLowerCase().includes(searchTerm)) {
          return item;
        }
      }
    }
    
    return null;
  }

  /**
   * Get all items as flat array
   */
  getAllItems(menu) {
    const items = [];
    menu.categories.forEach(cat => {
      items.push(...cat.items);
    });
    return items;
  }
}

// Singleton instance
const menuService = new MenuService();

export default menuService;

