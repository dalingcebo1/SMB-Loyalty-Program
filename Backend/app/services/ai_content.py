"""
AI Content Generation Service

Generates marketing content (emails, SMS, newsletters) using AI APIs.
Supports multiple providers with fallback to template-based generation.

Supported Providers:
- Hugging Face Inference API (free tier)
- Groq (fast,free)
- Ollama (local, optional)
- Template-based (fallback)
"""
import os
import logging
from typing import Optional, Dict, Any, Literal
from enum import Enum
import httpx
from datetime import datetime

logger = logging.getLogger(__name__)


class ContentType(str, Enum):
    """Type of marketing content to generate."""
    EMAIL = "email"
    SMS = "sms"
    NEWSLETTER = "newsletter"
    PROMOTION = "promotion"
    ANNOUNCEMENT = "announcement"
    REMINDER = "reminder"


class AIProvider(str, Enum):
    """Supported AI providers"""
    HUGGINGFACE = "huggingface"
    GROQ = "groq"
    OLLAMA = "ollama"
    TEMPLATE = "template"  # Fallback


class AIContentGenerator:
    """AI-powered marketing content generator."""
    
    def __init__(self):
        self.hf_api_key = os.getenv("HUGGINGFACE_API_KEY")
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        self.ollama_url = os.getenv("OLLAMA_API_URL", "http://localhost:11434")
        
        # Determine available provider
        self.provider = self._detect_provider()
        logger.info(f"AI Content Generator initialized with provider: {self.provider}")
    
    def _detect_provider(self) -> AIProvider:
        """Detect which AI provider is available."""
        if self.groq_api_key:
            return AIProvider.GROQ
        elif self.hf_api_key:
            return AIProvider.HUGGINGFACE
        else:
            logger.warning("No AI API keys found, using template-based generation")
            return AIProvider.TEMPLATE
    
    async def generate_content(
        self,
        content_type: ContentType,
        business_name: str,
        business_type: str,
        prompt: str,
        max_length: int = 500,
        tone: str = "friendly",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate marketing content using AI or templates.
        
        Args:
            content_type: Type of content (email, SMS, etc.)
            business_name: Name of the business
            business_type: Type of business (salon, retail, etc.)
            prompt: User's content request/idea
            max_length: Maximum character length
            tone: Writing tone (friendly, professional, urgent, etc.)
            **kwargs: Additional context (customer_name, offer_details, etc.)
        
        Returns:
            Dict with 'subject', 'content', 'ai_generated', 'provider'
        """
        logger.info(f"Generating {content_type} content for {business_name} ({business_type})")
        
        try:
            if self.provider == AIProvider.GROQ:
                return await self._generate_with_groq(
                    content_type, business_name, business_type, prompt, max_length, tone, **kwargs
                )
            elif self.provider == AIProvider.HUGGINGFACE:
                return await self._generate_with_huggingface(
                    content_type, business_name, business_type, prompt, max_length, tone, **kwargs
                )
            elif self.provider == AIProvider.OLLAMA:
                return await self._generate_with_ollama(
                    content_type, business_name, business_type, prompt, max_length, tone, **kwargs
                )
            else:
                return self._generate_with_template(
                    content_type, business_name, business_type, prompt, tone, **kwargs
                )
        except Exception as e:
            logger.error(f"AI generation failed: {e}, falling back to templates")
            return self._generate_with_template(
                content_type, business_name, business_type, prompt, tone, **kwargs
            )
    
    async def _generate_with_groq(
        self, content_type, business_name, business_type, prompt, max_length, tone, **kwargs
    ) -> Dict[str, Any]:
        """Generate content using Groq API (fast Llama inference)."""
        system_prompt = self._build_system_prompt(content_type, business_type, tone, max_length)
        user_prompt = self._build_user_prompt(business_name, prompt, **kwargs)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.groq_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama3-8b-8192",  # Fast Llama 3 model
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                    "max_tokens": 1024,
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            
            content = data["choices"][0]["message"]["content"]
            return self._parse_ai_response(content, True, AIProvider.GROQ)
    
    async def _generate_with_huggingface(
        self, content_type, business_name, business_type, prompt, max_length, tone, **kwargs
    ) -> Dict[str, Any]:
        """Generate content using Hugging Face Inference API."""
        system_prompt = self._build_system_prompt(content_type, business_type, tone, max_length)
        user_prompt = self._build_user_prompt(business_name, prompt, **kwargs)
        
        full_prompt = f"{system_prompt}\n\n{user_prompt}"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
                headers={"Authorization": f"Bearer {self.hf_api_key}"},
                json={
                    "inputs": full_prompt,
                    "parameters": {
                        "max_new_tokens": 512,
                        "temperature": 0.7,
                        "top_p": 0.95,
                        "return_full_text": False,
                    },
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            
            content = data[0]["generated_text"] if isinstance(data, list) else data["generated_text"]
            return self._parse_ai_response(content, True, AIProvider.HUGGINGFACE)
    
    async def _generate_with_ollama(
        self, content_type, business_name, business_type, prompt, max_length, tone, **kwargs
    ) -> Dict[str, Any]:
        """Generate content using local Ollama instance."""
        system_prompt = self._build_system_prompt(content_type, business_type, tone, max_length)
        user_prompt = self._build_user_prompt(business_name, prompt, **kwargs)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": "llama2",  # or "mistral", "codellama", etc.
                    "prompt": f"{system_prompt}\n\n{user_prompt}",
                    "stream": False,
                },
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()
            
            content = data["response"]
            return self._parse_ai_response(content, True, AIProvider.OLLAMA)
    
    def _generate_with_template(
        self, content_type, business_name, business_type, prompt, tone, **kwargs
    ) -> Dict[str, Any]:
        """Fallback to template-based generation."""
        logger.info("Using template-based content generation")
        
        templates = {
            ContentType.EMAIL: self._email_template,
            ContentType.SMS: self._sms_template,
            ContentType.NEWSLETTER: self._newsletter_template,
            ContentType.PROMOTION: self._promotion_template,
            ContentType.ANNOUNCEMENT: self._announcement_template,
            ContentType.REMINDER: self._reminder_template,
        }
        
        template_func = templates.get(content_type, self._generic_template)
        return template_func(business_name, business_type, prompt, tone, **kwargs)
    
    def _build_system_prompt(self, content_type: ContentType, business_type: str, tone: str, max_length: int) -> str:
        """Build system prompt for AI model."""
        return f"""You are an expert marketing copywriter specializing in {business_type} businesses.
        
Your task is to write compelling {content_type.value} content that:
- Uses a {tone} tone
- Is personalized and engaging
- Includes a clear call-to-action
- Stays under {max_length} characters
- Follows marketing best practices

Format your response as:
SUBJECT: [subject line if applicable]
CONTENT: [main message body]

Be creative, persuasive, and authentic."""
    
    def _build_user_prompt(self, business_name: str, prompt: str, **kwargs) -> str:
        """Build user prompt with context."""
        context_parts = [f"Business: {business_name}", f"Request: {prompt}"]
        
        if kwargs.get("customer_name"):
            context_parts.append(f"Customer: {kwargs['customer_name']}")
        if kwargs.get("offer_details"):
            context_parts.append(f"Offer: {kwargs['offer_details']}")
        if kwargs.get("event_date"):
            context_parts.append(f"Date: {kwargs['event_date']}")
        
        return "\n".join(context_parts)
    
    def _parse_ai_response(self, content: str, ai_generated: bool, provider: AIProvider) -> Dict[str, Any]:
        """Parse AI response into structured format."""
        subject = ""
        body = content.strip()
        
        # Try to extract subject if present
        if "SUBJECT:" in content:
            lines = content.split("\n")
            for i, line in enumerate(lines):
                if line.strip().startswith("SUBJECT:"):
                    subject = line.replace("SUBJECT:", "").strip()
                    # Rest is content
                    body = "\n".join(lines[i+1:]).replace("CONTENT:", "").strip()
                    break
        
        return {
            "subject": subject,
            "content": body,
            "ai_generated": ai_generated,
            "provider": provider.value,
            "generated_at": datetime.now().isoformat(),
        }
    
    # Template functions
    def _email_template(self, business_name, business_type, prompt, tone, **kwargs) -> Dict[str, Any]:
        """Email template."""
        customer_name = kwargs.get("customer_name", "Valued Customer")
        
        subject = f"Special Message from {business_name}"
        content = f"""Dear {customer_name},

{prompt}

Thank you for being a valued customer of {business_name}.

Best regards,
{business_name} Team"""
        
        return {
            "subject": subject,
            "content": content,
            "ai_generated": False,
            "provider": "template",
        }
    
    def _sms_template(self, business_name, business_type, prompt, tone, **kwargs) -> Dict[str, Any]:
        """SMS template (160 chars max)."""
        content = f"{business_name}: {prompt[:130]}. Reply STOP to opt out."
        
        return {
            "subject": "",
            "content": content,
            "ai_generated": False,
            "provider": "template",
        }
    
    def _newsletter_template(self, business_name, business_type, prompt, tone, **kwargs) -> Dict[str, Any]:
        """Newsletter template."""
        subject = f"{business_name} Newsletter - {datetime.now().strftime('%B %Y')}"
        content = f"""# {business_name} Newsletter

{prompt}

---
Stay connected with {business_name}!
Unsubscribe: [link]"""
       
        return {
            "subject": subject,
            "content": content,
            "ai_generated": False,
            "provider": "template",
        }
    
    def _promotion_template(self, business_name, business_type, prompt, tone, **kwargs) -> Dict[str, Any]:
        """Promotion template."""
        offer = kwargs.get("offer_details", "special offer")
        
        subject = f"🎉 Exclusive Offer from {business_name}!"
        content = f"""Don't miss out!

{prompt}

{offer}

Visit us today at {business_name}!"""
        
        return {
            "subject": subject,
            "content": content,
            "ai_generated": False,
            "provider": "template",
        }
    
    def _announcement_template(self, business_name, business_type, prompt, tone, **kwargs) -> Dict[str, Any]:
        """Announcement template."""
        subject = f"Important Update from {business_name}"
        content = f"""Hello!

We have an important announcement:

{prompt}

Thank you,
{business_name}"""
        
        return {
            "subject": subject,
            "content": content,
            "ai_generated": False,
            "provider": "template",
        }
    
    def _reminder_template(self, business_name, business_type, prompt, tone, **kwargs) -> Dict[str, Any]:
        """Reminder template."""
        subject = f"Reminder from {business_name}"
        content = f"""Hi!

Friendly reminder: {prompt}

See you soon!
{business_name}"""
        
        return {
            "subject": subject,
            "content": content,
            "ai_generated": False,
            "provider": "template",
        }
    
    def _generic_template(self, business_name, business_type, prompt, tone, **kwargs) -> Dict[str, Any]:
        """Generic fallback template."""
        return {
            "subject": f"Message from {business_name}",
            "content": prompt,
            "ai_generated": False,
            "provider": "template",
        }


# Global instance
_generator_instance = None


def get_ai_generator() -> AIContentGenerator:
    """Get or create the global AI generator instance."""
    global _generator_instance
    if _generator_instance is None:
        _generator_instance = AIContentGenerator()
    return _generator_instance
