/**
 * Base POS Adapter
 * All POS adapters must extend this class and implement the required methods
 */
class POSAdapter {
  constructor(credentials) {
    this.credentials = credentials;
  }

  /**
   * Fetch menu from POS system in universal format
   * @returns {Promise<Menu>} Universal menu object
   */
  async fetchMenu() {
    throw new Error('fetchMenu() must be implemented by subclass');
  }

  /**
   * Create an order in the POS system
   * @param {Object} orderDetails - Order details in universal format
   * @returns {Promise<Object>} Created order with POS-specific ID
   */
  async createOrder(orderDetails) {
    throw new Error('createOrder() must be implemented by subclass');
  }

  /**
   * Get order status from POS system
   * @param {string} orderId - POS-specific order ID
   * @returns {Promise<Object>} Order status
   */
  async getOrderStatus(orderId) {
    throw new Error('getOrderStatus() must be implemented by subclass');
  }

  /**
   * Get locations/stores (optional)
   * @returns {Promise<Array>} List of locations
   */
  async getLocations() {
    return [];
  }

  /**
   * Get printers/devices (optional)
   * @returns {Promise<Array>} List of printers
   */
  async getPrinters() {
    return [];
  }

  /**
   * Helper: Generate universal ID
   */
  generateUniversalId(posType, posId) {
    return `${posType}-${posId}`;
  }
}

export default POSAdapter;

