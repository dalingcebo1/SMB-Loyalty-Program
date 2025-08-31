from fastapi import FastAPI
from sqlalchemy import MetaData
from app.core.plugin_manager import PluginProtocol
from .vertical_dispatch import register_hook

class Plugin:  # registers vertical stubs collectively (meta plugin)
    name = "verticals"

    def register_models(self, metadata: MetaData):
        # No models; purely behavioral
        pass

    def register_routes(self, app: FastAPI):  # no routes, just hooks
        # Register specialization hooks first so they get precedence
        # Carwash specialization example
        def carwash_loyalty(order) -> int:
            if getattr(order, 'vertical_type', '') == 'carwash':
                return max(1, (getattr(order, 'amount', 0) or 0) // 80)
            return None
        register_hook('compute_loyalty_earn', carwash_loyalty)

        # Flowershop specialization example
        def flowershop_loyalty(order) -> int:
            if getattr(order, 'vertical_type', '') == 'flowershop':
                return max(1, (getattr(order, 'amount', 0) or 0) // 120)
            return None
        register_hook('compute_loyalty_earn', flowershop_loyalty)

        # Generic fallback loyalty earn: 1 point per order amount unit
        def default_loyalty(order) -> int:
            amt = getattr(order, 'amount', 0) or 0
            return amt // 100  # cents -> points baseline
        register_hook('compute_loyalty_earn', default_loyalty)

        # Tenant meta decoration example
        def decorate_meta(meta: dict, tenant):
            # Add vertical tagline if missing
            if 'tagline' not in meta.get('branding', {}):
                branding = meta.setdefault('branding', {})
                vt = tenant.vertical_type
                branding['tagline'] = {
                    'carwash': 'Shine Every Time',
                    'flowershop': 'Blooms That Last',
                    'padel': 'Game On',
                    'beauty': 'Radiate Confidence',
                    'dispensary': 'Elevate Your Day'
                }.get(vt, 'Trusted Service')
        register_hook('decorate_tenant_meta', decorate_meta)
