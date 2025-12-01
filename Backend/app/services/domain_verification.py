"""
Domain Verification Service

Verifies domain ownership before allowing custom domain configuration.
Supports multiple verification methods: DNS TXT, HTTP file, HTML meta tag.
"""
import logging
import secrets
import hashlib
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
import aiohttp
import asyncio
from dns import resolver, exception as dns_exception

from app.core.cache import get_cache

logger = logging.getLogger(__name__)


class DomainVerificationService:
    """Service for verifying domain ownership"""
    
    VERIFICATION_TTL = 3600  # 1 hour
    
    @staticmethod
    def generate_verification_token(domain: str) -> str:
        """
        Generate unique verification token for domain.
        
        Args:
            domain: Domain to verify
        
        Returns:
            Verification token
        """
        # Generate secure random token
        random_part = secrets.token_urlsafe(32)
        
        # Hash domain + timestamp + random for uniqueness
        timestamp = datetime.utcnow().isoformat()
        hash_input = f"{domain}:{timestamp}:{random_part}"
        token_hash = hashlib.sha256(hash_input.encode()).hexdigest()[:32]
        
        # Store in cache with TTL
        cache = get_cache()
        if cache:
            cache.set(
                f"domain_verify:{domain}",
                token_hash,
                ttl=DomainVerificationService.VERIFICATION_TTL
            )
        
        logger.info(f"Generated verification token for domain: {domain}")
        return token_hash
    
    @staticmethod
    def get_verification_methods(domain: str, token: str) -> Dict[str, Dict[str, str]]:
        """
        Get verification instructions for all methods.
        
        Args:
            domain: Domain to verify
            token: Verification token
        
        Returns:
            Dictionary of verification methods with instructions
        """
        return {
            "dns_txt": {
                "method": "DNS TXT Record",
                "record_name": f"_smb-loyalty-verify.{domain}",
                "record_type": "TXT",
                "record_value": token,
                "instructions": (
                    f"Add a TXT record to your DNS:\n"
                    f"Name: _smb-loyalty-verify.{domain}\n"
                    f"Type: TXT\n"
                    f"Value: {token}\n"
                    f"TTL: 300 (or your DNS provider's default)\n\n"
                    f"After adding the record, allow 5-10 minutes for DNS propagation, "
                    f"then click 'Verify' to complete the process."
                )
            },
            "http_file": {
                "method": "HTTP File Upload",
                "file_path": "/.well-known/smb-loyalty-verification.txt",
                "file_content": token,
                "full_url": f"http://{domain}/.well-known/smb-loyalty-verification.txt",
                "instructions": (
                    f"Upload a text file to your web server:\n"
                    f"Path: /.well-known/smb-loyalty-verification.txt\n"
                    f"Content: {token}\n\n"
                    f"The file must be accessible at:\n"
                    f"http://{domain}/.well-known/smb-loyalty-verification.txt\n\n"
                    f"After uploading, click 'Verify' to complete the process."
                )
            },
            "html_meta": {
                "method": "HTML Meta Tag",
                "tag": f'<meta name="smb-loyalty-verification" content="{token}">',
                "instructions": (
                    f"Add this meta tag to your homepage <head> section:\n"
                    f'<meta name="smb-loyalty-verification" content="{token}">\n\n'
                    f"The tag must be in the HTML <head> of your domain's homepage:\n"
                    f"http://{domain}/\n\n"
                    f"After adding the tag, click 'Verify' to complete the process."
                )
            }
        }
    
    @staticmethod
    async def verify_domain(domain: str, method: str) -> Tuple[bool, Optional[str]]:
        """
        Verify domain ownership using specified method.
        
        Args:
            domain: Domain to verify
            method: Verification method (dns_txt, http_file, html_meta)
        
        Returns:
            Tuple of (success, error_message)
        """
        # Get expected token from cache
        cache = get_cache()
        expected_token = None
        if cache:
            expected_token = cache.get(f"domain_verify:{domain}")
        
        if not expected_token:
            return False, "Verification token expired or not found. Please regenerate."
        
        try:
            if method == "dns_txt":
                return await DomainVerificationService._verify_dns_txt(
                    domain, expected_token
                )
            elif method == "http_file":
                return await DomainVerificationService._verify_http_file(
                    domain, expected_token
                )
            elif method == "html_meta":
                return await DomainVerificationService._verify_html_meta(
                    domain, expected_token
                )
            else:
                return False, f"Unknown verification method: {method}"
                
        except Exception as exc:
            logger.error(f"Domain verification failed: {exc}", exc_info=True)
            return False, f"Verification failed: {str(exc)}"
    
    @staticmethod
    async def _verify_dns_txt(domain: str, expected_token: str) -> Tuple[bool, Optional[str]]:
        """Verify via DNS TXT record"""
        try:
            record_name = f"_smb-loyalty-verify.{domain}"
            
            # Query DNS for TXT records
            answers = resolver.resolve(record_name, 'TXT')
            
            # Check if any TXT record matches our token
            for rdata in answers:
                # TXT records are returned as quoted strings, strip quotes
                txt_value = str(rdata).strip('"')
                if txt_value == expected_token:
                    logger.info(f"DNS TXT verification successful for {domain}")
                    return True, None
            
            return False, (
                f"TXT record found for {record_name}, but token doesn't match. "
                f"Please ensure the record value is exactly: {expected_token}"
            )
            
        except dns_exception.NXDOMAIN:
            return False, (
                f"DNS record not found for {record_name}. "
                f"Please add the TXT record and wait for DNS propagation (5-10 minutes)."
            )
        except dns_exception.NoAnswer:
            return False, (
                f"No TXT record found for {record_name}. "
                f"Please add the TXT record and wait for DNS propagation."
            )
        except Exception as exc:
            logger.error(f"DNS verification error: {exc}", exc_info=True)
            return False, f"DNS lookup failed: {str(exc)}"
    
    @staticmethod
    async def _verify_http_file(domain: str, expected_token: str) -> Tuple[bool, Optional[str]]:
        """Verify via HTTP file"""
        url = f"http://{domain}/.well-known/smb-loyalty-verification.txt"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as response:
                    if response.status != 200:
                        return False, (
                            f"File not accessible at {url} (HTTP {response.status}). "
                            f"Please ensure the file is uploaded and accessible."
                        )
                    
                    content = await response.text()
                    content = content.strip()
                    
                    if content == expected_token:
                        logger.info(f"HTTP file verification successful for {domain}")
                        return True, None
                    else:
                        return False, (
                            f"File found at {url}, but content doesn't match. "
                            f"Expected: {expected_token}\n"
                            f"Found: {content[:100]}"
                        )
                        
        except asyncio.TimeoutError:
            return False, f"Request timeout accessing {url}. Please check if the file is accessible."
        except aiohttp.ClientError as exc:
            return False, f"Failed to access {url}: {str(exc)}"
        except Exception as exc:
            logger.error(f"HTTP file verification error: {exc}", exc_info=True)
            return False, f"Verification failed: {str(exc)}"
    
    @staticmethod
    async def _verify_html_meta(domain: str, expected_token: str) -> Tuple[bool, Optional[str]]:
        """Verify via HTML meta tag"""
        url = f"http://{domain}/"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as response:
                    if response.status != 200:
                        return False, (
                            f"Homepage not accessible at {url} (HTTP {response.status}). "
                            f"Please ensure your website is online."
                        )
                    
                    html = await response.text()
                    
                    # Look for meta tag in HTML
                    # Simple search - could use BeautifulSoup for robustness
                    meta_pattern = f'<meta name="smb-loyalty-verification" content="{expected_token}"'
                    
                    if meta_pattern in html:
                        logger.info(f"HTML meta verification successful for {domain}")
                        return True, None
                    else:
                        # Check if meta tag exists with wrong content
                        if 'name="smb-loyalty-verification"' in html:
                            return False, (
                                f"Meta tag found in {url}, but content doesn't match. "
                                f"Please ensure the content is exactly: {expected_token}"
                            )
                        else:
                            return False, (
                                f"Meta tag not found in {url}. "
                                f"Please add the meta tag to your homepage <head> section."
                            )
                        
        except asyncio.TimeoutError:
            return False, f"Request timeout accessing {url}. Please check if your website is online."
        except aiohttp.ClientError as exc:
            return False, f"Failed to access {url}: {str(exc)}"
        except Exception as exc:
            logger.error(f"HTML meta verification error: {exc}", exc_info=True)
            return False, f"Verification failed: {str(exc)}"
    
    @staticmethod
    def clear_verification_token(domain: str):
        """Clear verification token from cache"""
        cache = get_cache()
        if cache:
            cache.delete(f"domain_verify:{domain}")
        logger.info(f"Cleared verification token for domain: {domain}")
    
    @staticmethod
    def get_verification_status(domain: str) -> Optional[Dict[str, any]]:
        """
        Get current verification status for domain.
        
        Args:
            domain: Domain to check
        
        Returns:
            Status dict or None if no pending verification
        """
        cache = get_cache()
        if not cache:
            return None
        
        token = cache.get(f"domain_verify:{domain}")
        if not token:
            return None
        
        return {
            "domain": domain,
            "token": token,
            "status": "pending",
            "expires_in_seconds": DomainVerificationService.VERIFICATION_TTL,
            "methods_available": ["dns_txt", "http_file", "html_meta"]
        }
