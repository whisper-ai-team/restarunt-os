import CloverAdapter from './clover.js';
import SquareAdapter from './square.js';

/**
 * POS Adapter Factory
 * Automatically creates the correct adapter based on restaurant configuration
 */
class POSAdapterFactory {
  /**
   * Create POS adapter for a restaurant
   * @param {Object} restaurant - Restaurant object from database
   * @returns {POSAdapter} Appropriate adapter instance
   */
  static create(restaurant) {
    // Check for Clover connection
    if (restaurant.clover && restaurant.clover.apiKey) {
      console.log(`🔧 Creating Clover adapter for ${restaurant.name}`);
      return new CloverAdapter({
        apiKey: restaurant.clover.apiKey,
        merchantId: restaurant.clover.merchantId,
        environment: restaurant.clover.environment || 'production'
      });
    }
    
    // Check for Square connection
    if (restaurant.square && restaurant.square.accessToken) {
      console.log(`🔧 Creating Square adapter for ${restaurant.name}`);
      return new SquareAdapter({
        accessToken: restaurant.square.accessToken,
        merchantId: restaurant.square.merchantId,
        locationId: restaurant.square.locationId || null,
        environment: restaurant.square.environment || 'production'
      });
    }
    
    // No POS connected
    throw new Error(`No POS system connected for restaurant: ${restaurant.name} (${restaurant.id})`);
  }

  /**
   * Detect which POS system is connected
   * @param {Object} restaurant - Restaurant object
   * @returns {string|null} POS type: 'clover', 'square', or null
   */
  static detectPOSType(restaurant) {
    if (restaurant.clover && restaurant.clover.apiKey) {
      return 'clover';
    }
    if (restaurant.square && restaurant.square.accessToken) {
      return 'square';
    }
    return null;
  }

  /**
   * Check if restaurant has any POS connected
   * @param {Object} restaurant - Restaurant object
   * @returns {boolean}
   */
  static hasPOS(restaurant) {
    return this.detectPOSType(restaurant) !== null;
  }
}

export default POSAdapterFactory;

