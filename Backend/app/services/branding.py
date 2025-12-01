"""
Enhanced Branding Service

Provides white-label branding capabilities including:
- Theme management (multiple themes per tenant)
- CSS variable generation
- Theme preview
- Custom domain verification
"""

from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from app.models import Tenant, TenantBranding
import logging
import colorsys

logger = logging.getLogger(__name__)


class BrandingService:
    """Service for managing tenant branding and white-label themes."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_branding(self, tenant_id: str) -> Optional[TenantBranding]:
        """
        Get branding configuration for a tenant.
        
        Args:
            tenant_id: The tenant identifier
            
        Returns:
            TenantBranding or None if not configured
        """
        return self.db.query(TenantBranding).filter(
            TenantBranding.tenant_id == tenant_id
        ).first()
    
    def generate_css_variables(self, branding: TenantBranding) -> str:
        """
        Generate CSS custom properties (variables) from branding config.
        
        This allows dynamic theme injection without rebuilding frontend.
        
        Args:
            branding: TenantBranding instance
            
        Returns:
            CSS string with :root variable declarations
        """
        css_vars = {}
        
        # Color variables
        if branding.primary_color:
            css_vars['--color-primary'] = branding.primary_color
            # Generate light/dark variants
            css_vars['--color-primary-light'] = self._lighten_color(branding.primary_color, 0.2)
            css_vars['--color-primary-dark'] = self._darken_color(branding.primary_color, 0.2)
        
        if branding.secondary_color:
            css_vars['--color-secondary'] = branding.secondary_color
            css_vars['--color-secondary-light'] = self._lighten_color(branding.secondary_color, 0.2)
            css_vars['--color-secondary-dark'] = self._darken_color(branding.secondary_color, 0.2)
        
        if branding.accent_color:
            css_vars['--color-accent'] = branding.accent_color
        
        # Logo URLs
        if branding.logo_light_url:
            css_vars['--logo-url'] = f'url({branding.logo_light_url})'
        
        if branding.logo_dark_url:
            css_vars['--logo-dark-url'] = f'url({branding.logo_dark_url})'
        
        # Build CSS string
        css_lines = [':root {']
        for key, value in css_vars.items():
            css_lines.append(f'  {key}: {value};')
        css_lines.append('}')
        
        return '\n'.join(css_lines)
    
    def get_theme_metadata(self, branding: TenantBranding) -> Dict[str, Any]:
        """
        Get theme metadata for frontend consumption.
        
        Args:
            branding: TenantBranding instance
            
        Returns:
            Dictionary with theme configuration
        """
        return {
            'public_name': branding.public_name,
            'short_name': branding.short_name,
            'colors': {
                'primary': branding.primary_color,
                'secondary': branding.secondary_color,
                'accent': branding.accent_color,
            },
            'logos': {
                'light': branding.logo_light_url,
                'dark': branding.logo_dark_url,
                'favicon': branding.favicon_url,
                'app_icon': branding.app_icon_url,
            },
            'contact': {
                'email': branding.support_email,
                'phone': branding.support_phone,
            },
            'extra': branding.extra or {},
        }
    
    def validate_branding(self, branding_data: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        Validate branding configuration.
        
        Args:
            branding_data: Dictionary with branding fields
            
        Returns:
            Dictionary with validation errors (empty if valid)
        """
        errors = {}
        
        # Validate colors are valid hex codes
        color_fields = ['primary_color', 'secondary_color', 'accent_color']
        for field in color_fields:
            if field in branding_data and branding_data[field]:
                if not self._is_valid_hex_color(branding_data[field]):
                    errors[field] = [f"Invalid hex color: {branding_data[field]}"]
        
        # Validate URLs
        url_fields = ['logo_light_url', 'logo_dark_url', 'favicon_url', 'app_icon_url']
        for field in url_fields:
            if field in branding_data and branding_data[field]:
                if not self._is_valid_url(branding_data[field]):
                    errors[field] = [f"Invalid URL: {branding_data[field]}"]
        
        # Validate email
        if 'support_email' in branding_data and branding_data['support_email']:
            if not self._is_valid_email(branding_data['support_email']):
                errors['support_email'] = ["Invalid email address"]
        
        return errors
    
    def create_default_branding(self, tenant: Tenant) -> TenantBranding:
        """
        Create default branding for a new tenant.
        
        Args:
            tenant: Tenant instance
            
        Returns:
            TenantBranding instance with defaults
        """
        # Get vertical-specific defaults
        from app.verticals import registry
        vertical = registry.get(tenant.vertical_type)
        
        default_config = {}
        if vertical:
            default_config = vertical.get_default_config().get('branding', {})
        
        branding = TenantBranding(
            tenant_id=tenant.id,
            public_name=tenant.name,
            short_name=tenant.name[:20] if len(tenant.name) > 20 else tenant.name,
            primary_color=default_config.get('primary_color', '#0066CC'),
            secondary_color=default_config.get('secondary_color', '#FF6600'),
            accent_color=default_config.get('accent_color', '#00CC66'),
            extra={}
        )
        
        self.db.add(branding)
        self.db.commit()
        
        logger.info(f"Created default branding for tenant {tenant.id}")
        return branding
    
    # Helper methods
    
    def _is_valid_hex_color(self, color: str) -> bool:
        """Validate hex color code."""
        if not color.startswith('#'):
            return False
        hex_part = color[1:]
        if len(hex_part) not in [3, 6]:
            return False
        try:
            int(hex_part, 16)
            return True
        except ValueError:
            return False
    
    def _is_valid_url(self, url: str) -> bool:
        """Basic URL validation."""
        return url.startswith(('http://', 'https://'))
    
    def _is_valid_email(self, email: str) -> bool:
        """Basic email validation."""
        return '@' in email and '.' in email.split('@')[1]
    
    def _hex_to_rgb(self, hex_color: str) -> tuple:
        """Convert hex color to RGB tuple."""
        hex_color = hex_color.lstrip('#')
        if len(hex_color) == 3:
            hex_color = ''.join([c*2 for c in hex_color])
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    def _rgb_to_hex(self, rgb: tuple) -> str:
        """Convert RGB tuple to hex color."""
        return '#{:02x}{:02x}{:02x}'.format(
            max(0, min(255, int(rgb[0]))),
            max(0, min(255, int(rgb[1]))),
            max(0, min(255, int(rgb[2])))
        )
    
    def _lighten_color(self, hex_color: str, amount: float = 0.2) -> str:
        """
        Lighten a hex color by a percentage.
        
        Args:
            hex_color: Hex color code (e.g., '#0066CC')
            amount: Amount to lighten (0.0 to 1.0)
            
        Returns:
            Lightened hex color
        """
        try:
            rgb = self._hex_to_rgb(hex_color)
            h, l, s = colorsys.rgb_to_hls(rgb[0]/255.0, rgb[1]/255.0, rgb[2]/255.0)
            l = min(1.0, l + amount)
            r, g, b = colorsys.hls_to_rgb(h, l, s)
            return self._rgb_to_hex((r*255, g*255, b*255))
        except Exception:
            return hex_color
    
    def _darken_color(self, hex_color: str, amount: float = 0.2) -> str:
        """
        Darken a hex color by a percentage.
        
        Args:
            hex_color: Hex color code (e.g., '#0066CC')
            amount: Amount to darken (0.0 to 1.0)
            
        Returns:
            Darkened hex color
        """
        try:
            rgb = self._hex_to_rgb(hex_color)
            h, l, s = colorsys.rgb_to_hls(rgb[0]/255.0, rgb[1]/255.0, rgb[2]/255.0)
            l = max(0.0, l - amount)
            r, g, b = colorsys.hls_to_rgb(h, l, s)
            return self._rgb_to_hex((r*255, g*255, b*255))
        except Exception:
            return hex_color
