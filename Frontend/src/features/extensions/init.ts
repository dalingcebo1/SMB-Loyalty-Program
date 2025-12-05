import { registerExtension } from './registry';
import { RetailPostRedemption } from './retail/RetailExtensions';
import { CarwashPinDisplay } from './carwash/CarwashExtensions';

export const initExtensions = () => {
  registerExtension('RETAIL_POST_REDEMPTION', RetailPostRedemption);
  registerExtension('CARWASH_SHOW_PIN', CarwashPinDisplay);
  console.log('Extensions initialized');
};
