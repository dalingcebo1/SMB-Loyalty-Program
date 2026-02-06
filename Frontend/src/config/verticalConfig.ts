/**
 * Vertical Configuration
 * 
 * Defines terminology, features, colors, and icons for each business vertical.
 * This allows the UI to dynamically adapt based on the tenant's industry.
 */

export interface VerticalLabels {
  // Primary entities
  service: string;
  servicePlural: string;
  customer: string;
  customerPlural: string;
  order: string;
  orderPlural: string;
  
  // Actions
  createService: string;
  createOrder: string;
  viewOrder: string;
  
  // Features
  mainCTA: string; // Primary call-to-action
}

export interface VerticalFeatureFlags {
  // Core features
  appointments: boolean;
  inventory: boolean;
  pos: boolean; // Point of Sale
  vehicleTracking: boolean;
  
  // Advanced features
  staffScheduling: boolean;
  bayManagement: boolean;
  queueSystem: boolean;
  deliveryScheduling: boolean;
  compliance: boolean;
  
  // Loyalty features
  visitBasedRewards: boolean;
  purchaseBasedRewards: boolean;
  subscriptionPlans: boolean;
}

export interface VerticalNavItem {
  label: string;
  path: string;
  icon: string;
  requiredFeature?: keyof VerticalFeatureFlags;
}

export interface VerticalConfig {
  key: string;
  displayName: string;
  description: string;
  icon: string;
  primaryColor: string;
  labels: VerticalLabels;
  features: VerticalFeatureFlags;
  navItems: VerticalNavItem[];
}

/**
 * Car Wash & Detailing Configuration
 */
export const carwashConfig: VerticalConfig = {
  key: 'carwash',
  displayName: 'Car Wash & Detailing',
  description: 'Complete car wash and auto detailing management',
  icon: '🚗',
  primaryColor: '#3B82F6',
  labels: {
    service: 'Wash Service',
    servicePlural: 'Wash Services',
    customer: 'Customer',
    customerPlural: 'Customers',
    order: 'Wash Order',
    orderPlural: 'Wash Orders',
    createService: 'Add Wash Package',
    createOrder: 'Start Wash',
    viewOrder: 'View Wash Details',
    mainCTA: 'Book a Wash',
  },
  features: {
    appointments: true,
    inventory: false,
    pos: true,
    vehicleTracking: true,
    staffScheduling: true,
    bayManagement: true,
    queueSystem: true,
    deliveryScheduling: false,
    compliance: false,
    visitBasedRewards: true,
    purchaseBasedRewards: true,
    subscriptionPlans: true,
  },
  navItems: [
    { label: 'Vehicles', path: '/admin/vehicles', icon: 'car' },
    { label: 'Bay Management', path: '/admin/bays', icon: 'building', requiredFeature: 'bayManagement' },
    { label: 'Queue', path: '/admin/queue', icon: 'users', requiredFeature: 'queueSystem' },
  ],
};

/**
 * Retail Store Configuration
 */
export const retailConfig: VerticalConfig = {
  key: 'retail',
  displayName: 'Retail Store',
  description: 'Retail shop with inventory and point of sale',
  icon: '🏪',
  primaryColor: '#10B981',
  labels: {
    service: 'Product',
    servicePlural: 'Products',
    customer: 'Shopper',
    customerPlural: 'Shoppers',
    order: 'Sale',
    orderPlural: 'Sales',
    createService: 'Add Product',
    createOrder: 'New Sale',
    viewOrder: 'View Sale',
    mainCTA: 'Shop Now',
  },
  features: {
    appointments: false,
    inventory: true,
    pos: true,
    vehicleTracking: false,
    staffScheduling: true,
    bayManagement: false,
    queueSystem: false,
    deliveryScheduling: false,
    compliance: false,
    visitBasedRewards: true,
    purchaseBasedRewards: true,
    subscriptionPlans: false,
  },
  navItems: [
    { label: 'Inventory', path: '/admin/retail/inventory', icon: 'package', requiredFeature: 'inventory' },
    { label: 'POS Terminal', path: '/admin/retail/pos', icon: 'shopping-cart', requiredFeature: 'pos' },
    { label: 'Products', path: '/admin/products', icon: 'tag' },
  ],
};

/**
 * Beauty Salon & Spa Configuration
 */
export const beautyConfig: VerticalConfig = {
  key: 'beauty',
  displayName: 'Beauty Salon & Spa',
  description: 'Salon management with appointments and stylist scheduling',
  icon: '💇',
  primaryColor: '#EC4899',
  labels: {
    service: 'Treatment',
    servicePlural: 'Treatments',
    customer: 'Client',
    customerPlural: 'Clients',
    order: 'Appointment',
    orderPlural: 'Appointments',
    createService: 'Add Treatment',
    createOrder: 'Book Appointment',
    viewOrder: 'View Appointment',
    mainCTA: 'Book Now',
  },
  features: {
    appointments: true,
    inventory: true, // For product sales
    pos: true,
    vehicleTracking: false,
    staffScheduling: true,
    bayManagement: false,
    queueSystem: false,
    deliveryScheduling: false,
    compliance: false,
    visitBasedRewards: true,
    purchaseBasedRewards: true,
    subscriptionPlans: true, // Package deals
  },
  navItems: [
    { label: 'Calendar', path: '/admin/appointments', icon: 'calendar', requiredFeature: 'appointments' },
    { label: 'Stylists', path: '/admin/staff', icon: 'users', requiredFeature: 'staffScheduling' },
    { label: 'Services', path: '/admin/services', icon: 'sparkles' },
  ],
};

/**
 * Padel Courts Configuration
 */
export const padelConfig: VerticalConfig = {
  key: 'padel',
  displayName: 'Padel Courts',
  description: 'Court booking and tournament management',
  icon: '🎾',
  primaryColor: '#F59E0B',
  labels: {
    service: 'Court',
    servicePlural: 'Courts',
    customer: 'Player',
    customerPlural: 'Players',
    order: 'Booking',
    orderPlural: 'Bookings',
    createService: 'Add Court',
    createOrder: 'Book Court',
    viewOrder: 'View Booking',
    mainCTA: 'Book a Court',
  },
  features: {
    appointments: true, // Court bookings
    inventory: true, // Equipment rental
    pos: false,
    vehicleTracking: false,
    staffScheduling: false,
    bayManagement: false,
    queueSystem: false,
    deliveryScheduling: false,
    compliance: false,
    visitBasedRewards: true,
    purchaseBasedRewards: true,
    subscriptionPlans: true, // Recurring bookings
  },
  navItems: [
    { label: 'Bookings', path: '/admin/bookings', icon: 'calendar', requiredFeature: 'appointments' },
    { label: 'Courts', path: '/admin/courts', icon: 'map' },
    { label: 'Equipment', path: '/admin/equipment', icon: 'package', requiredFeature: 'inventory' },
  ],
};

/**
 * Flower Shop Configuration
 */
export const flowershopConfig: VerticalConfig = {
  key: 'flowershop',
  displayName: 'Flower Shop',
  description: 'Florist with delivery scheduling and occasion reminders',
  icon: '🌸',
  primaryColor: '#8B5CF6',
  labels: {
    service: 'Arrangement',
    servicePlural: 'Arrangements',
    customer: 'Customer',
    customerPlural: 'Customers',
    order: 'Order',
    orderPlural: 'Orders',
    createService: 'Add Arrangement',
    createOrder: 'New Order',
    viewOrder: 'View Order',
    mainCTA: 'Order Flowers',
  },
  features: {
    appointments: false,
    inventory: true,
    pos: true,
    vehicleTracking: false,
    staffScheduling: false,
    bayManagement: false,
    queueSystem: false,
    deliveryScheduling: true,
    compliance: false,
    visitBasedRewards: false,
    purchaseBasedRewards: true,
    subscriptionPlans: true, // Weekly/monthly flowers
  },
  navItems: [
    { label: 'Products', path: '/admin/products', icon: 'flower' },
    { label: 'Deliveries', path: '/admin/deliveries', icon: 'truck', requiredFeature: 'deliveryScheduling' },
    { label: 'Inventory', path: '/admin/inventory', icon: 'package', requiredFeature: 'inventory' },
  ],
};

/**
 * Cannabis Dispensary Configuration
 */
export const dispensaryConfig: VerticalConfig = {
  key: 'dispensary',
  displayName: 'Cannabis Dispensary',
  description: 'Dispensary with compliance tracking and age verification',
  icon: '🌿',
  primaryColor: '#059669',
  labels: {
    service: 'Product',
    servicePlural: 'Products',
    customer: 'Patient',
    customerPlural: 'Patients',
    order: 'Order',
    orderPlural: 'Orders',
    createService: 'Add Product',
    createOrder: 'New Order',
    viewOrder: 'View Order',
    mainCTA: 'Shop Products',
  },
  features: {
    appointments: false,
    inventory: true,
    pos: true,
    vehicleTracking: false,
    staffScheduling: true,
    bayManagement: false,
    queueSystem: false,
    deliveryScheduling: false,
    compliance: true, // Regulatory compliance
    visitBasedRewards: true,
    purchaseBasedRewards: true,
    subscriptionPlans: false,
  },
  navItems: [
    { label: 'Products', path: '/admin/products', icon: 'cannabis' },
    { label: 'Compliance', path: '/admin/compliance', icon: 'shield', requiredFeature: 'compliance' },
    { label: 'Inventory', path: '/admin/inventory', icon: 'package', requiredFeature: 'inventory' },
  ],
};

/**
 * All vertical configurations indexed by key
 */
export const verticalConfigs: Record<string, VerticalConfig> = {
  carwash: carwashConfig,
  retail: retailConfig,
  beauty: beautyConfig,
  padel: padelConfig,
  flowershop: flowershopConfig,
  dispensary: dispensaryConfig,
};

/**
 * Get vertical configuration by key
 */
export function getVerticalConfig(verticalKey: string): VerticalConfig {
  return verticalConfigs[verticalKey] || carwashConfig; // Default to carwash if not found
}

/**
 * Check if a vertical supports a specific feature
 */
export function hasVerticalFeature(
  verticalKey: string,
  feature: keyof VerticalFeatureFlags
): boolean {
  const config = getVerticalConfig(verticalKey);
  return config.features[feature];
}

/**
 * Get labels for a specific vertical
 */
export function getVerticalLabels(verticalKey: string): VerticalLabels {
  return getVerticalConfig(verticalKey).labels;
}

/**
 * Get navigation items for a vertical (filtered by enabled features)
 */
export function getVerticalNavItems(verticalKey: string): VerticalNavItem[] {
  const config = getVerticalConfig(verticalKey);
  return config.navItems.filter(item => {
    if (!item.requiredFeature) return true;
    return config.features[item.requiredFeature];
  });
}

/**
 * List all available verticals
 */
export function listAllVerticals(): VerticalConfig[] {
  return Object.values(verticalConfigs);
}
