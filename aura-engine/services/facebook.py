import asyncio
import logging
import json
import httpx
from playwright.async_api import async_playwright
from typing import Optional

log = logging.getLogger("aura.fb")


class FacebookService:
    def __init__(self):
        self._browser = None
        self._context = None
        self._page = None
        self._cookies_loaded = False

    async def load_cookies(self, cookies_b64: str) -> bool:
        """Load Facebook cookies from base64 string."""
        try:
            cookies = json.loads(__import__("base64").b64decode(cookies_b64).decode())
            pw = await async_playwright().start()
            self._browser = await pw.chromium.launch(headless=True)
            self._context = await self._browser.new_context()
            await self._context.add_cookies(cookies)
            self._page = await self._context.new_page()
            await self._page.goto("https://www.facebook.com/", wait_until="networkidle", timeout=30000)
            if "login" in self._page.url.lower():
                log.error("FB cookies expired - redirected to login")
                await self.close()
                return False
            self._cookies_loaded = True
            log.info("FB session loaded from cookies")
            return True
        except Exception as e:
            log.error(f"FB cookie load failed: {e}")
            return False

    async def login(self, email: str, password: str) -> bool:
        """Login with email and password."""
        try:
            pw = await async_playwright().start()
            self._browser = await pw.chromium.launch(headless=True)
            self._context = await self._browser.new_context()
            self._page = await self._context.new_page()
            await self._page.goto("https://www.facebook.com/")
            await self._page.fill('input[name="email"]', email)
            await self._page.fill('input[name="pass"]', password)
            await self._page.click('button[name="login"]')
            await self._page.wait_for_url("https://www.facebook.com/", timeout=15000)
            self._cookies_loaded = True
            return True
        except Exception as e:
            log.error(f"FB login failed: {e}")
            return False

    async def ensure_page(self) -> bool:
        """Ensure we have a browser page with active session."""
        if self._page and self._cookies_loaded:
            try:
                await self._page.goto("https://www.facebook.com/", timeout=15000)
                return "login" not in self._page.url.lower()
            except:
                pass
        return False

    async def send_dm(self, target_name: str, message: str) -> dict:
        """Send a DM via Facebook Messenger."""
        try:
            # Navigate to Messenger
            await self._page.goto(f"https://www.facebook.com/messages/t/{target_name}", wait_until="networkidle", timeout=30000)
            await asyncio.sleep(3)
            # Type message
            editor = await self._page.query_selector('[contenteditable="true"][role="textbox"]')
            if not editor:
                # Try alternate selector
                editor = await self._page.query_selector('[aria-label="Message"]') or await self._page.query_selector('p[contenteditable="true"]')
            if not editor:
                return {"success": False, "error": "Message box not found", "target": target_name}
            await editor.click()
            await editor.type(message, delay=50)
            await asyncio.sleep(1)
            # Press Enter to send
            await editor.press("Enter")
            await asyncio.sleep(2)
            return {"success": True, "target": target_name}
        except Exception as e:
            return {"success": False, "error": str(e), "target": target_name}

    async def send_dm_graph_api(self, page_token: str, page_id: str, target_id: str, message: str) -> dict:
        """Send DM via Graph API (only to people who already messaged the page)."""
        try:
            url = f"https://graph.facebook.com/v21.0/{page_id}/messages"
            async with httpx.AsyncClient() as client:
                r = await client.post(url, params={"access_token": page_token}, json={"recipient": {"id": target_id}, "message": {"text": message}})
                if r.status_code == 200:
                    return {"success": True, "target": target_id}
                return {"success": False, "error": r.text}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_page_conversations(self, page_token: str, page_id: str) -> list:
        """Get page conversations via Graph API."""
        try:
            url = f"https://graph.facebook.com/v21.0/{page_id}/conversations"
            async with httpx.AsyncClient() as client:
                r = await client.get(url, params={"access_token": page_token, "fields": "id,participants,snippet,updated_time", "limit": "20"})
                if r.status_code == 200:
                    return r.json().get("data", [])
                return []
        except:
            return []

    async def publish_post(self, page_token: str, page_id: str, message: str, image_url: str = None) -> dict:
        """Publish a post to the Facebook page via Graph API."""
        try:
            url = f"https://graph.facebook.com/v21.0/{page_id}/feed"
            payload = {"message": message}
            if image_url:
                payload["link"] = image_url
            async with httpx.AsyncClient() as client:
                r = await client.post(url, params={"access_token": page_token}, json=payload)
                if r.status_code == 200:
                    return {"success": True, "post_id": r.json().get("id")}
                return {"success": False, "error": r.text}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def publish_story(self, page_token: str, page_id: str, image_url: str) -> dict:
        """
        Publica uma story na pagina do Facebook via Graph API.
        NOTA: O Graph API do Facebook nao suporta nativamente stories de paginas
        de forma simples. Este metodo usa o endpoint /photos com published=false
        para fazer staging da foto, e depois tenta publicar como story.
        Workaround: publicar a foto na pagina directamente, ja que stories de
        paginas requerem o WhatsApp Business API ou a app nativa do Facebook.

        Retorna detalhes sobre o que foi feito.
        """
        try:
            # Passo 1: Fazer upload da foto sem publicar (staging)
            stage_url = f"https://graph.facebook.com/v21.0/{page_id}/photos"
            async with httpx.AsyncClient(timeout=60) as client:
                # Fazer download da imagem primeiro
                img_resp = await client.get(image_url)
                if img_resp.status_code != 200:
                    return {"success": False, "error": f"Falha ao baixar imagem: HTTP {img_resp.status_code}"}

                # Tentar publicar como foto na pagina (workaround para stories)
                # O Graph API nao tem endpoint dedicado para stories de paginas
                upload_resp = await client.post(
                    stage_url,
                    params={
                        "access_token": page_token,
                        "published": "true",
                        "message": "",  # Stories normalmente nao tem caption no FB
                    },
                    files={"source": ("story.jpg", img_resp.content, "image/jpeg")},
                )

                if upload_resp.status_code == 200:
                    photo_data = upload_resp.json()
                    photo_id = photo_data.get("id")
                    log.info(f"FB: foto publicada como workaround para story, photo_id={photo_id}")
                    return {
                        "success": True,
                        "photo_id": photo_id,
                        "note": "O Graph API do Facebook nao suporta stories de paginas nativamente. A imagem foi publicada como foto na pagina. Para stories reais, usar a app do Facebook ou WhatsApp Business API.",
                        "workaround": "foto_publicada",
                    }
                else:
                    error_data = upload_resp.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", upload_resp.text),
                        "note": "O Graph API do Facebook nao suporta stories de paginas nativamente.",
                    }
        except Exception as e:
            log.error(f"FB publish_story falhou: {e}")
            return {"success": False, "error": str(e), "note": "O Graph API do Facebook nao suporta stories de paginas nativamente."}

    async def get_page_posts(self, page_token: str, page_id: str, limit: int = 10) -> list:
        """Get page posts via Graph API."""
        try:
            url = f"https://graph.facebook.com/v21.0/{page_id}/posts"
            async with httpx.AsyncClient() as client:
                r = await client.get(url, params={"access_token": page_token, "fields": "id,message,created_time,likes.limit(0).summary(true),comments.limit(0).summary(true)", "limit": str(limit)})
                if r.status_code == 200:
                    posts = []
                    for p in r.json().get("data", []):
                        posts.append({
                            "id": p.get("id"),
                            "message": p.get("message", "")[:500],
                            "created_at": p.get("created_time"),
                            "likes": p.get("likes", {}).get("summary", {}).get("total_count", 0),
                            "comments": p.get("comments", {}).get("summary", {}).get("total_count", 0),
                        })
                    return posts
                return []
        except:
            return []

    async def get_post_comments(self, page_token: str, post_id: str) -> list:
        """Get comments on a page post."""
        try:
            url = f"https://graph.facebook.com/v21.0/{post_id}/comments"
            async with httpx.AsyncClient() as client:
                r = await client.get(url, params={"access_token": page_token, "fields": "id,from,message,created_time", "limit": "50"})
                if r.status_code == 200:
                    return [{"id": c.get("id"), "user": c.get("from", {}).get("name"), "text": c.get("message"), "created": c.get("created_time")} for c in r.json().get("data", [])]
                return []
        except:
            return []

    async def reply_comment(self, page_token: str, comment_id: str, message: str) -> dict:
        """Reply to a comment on a page post."""
        try:
            url = f"https://graph.facebook.com/v21.0/{comment_id}/comments"
            async with httpx.AsyncClient() as client:
                r = await client.post(url, params={"access_token": page_token}, json={"message": message})
                if r.status_code == 200:
                    return {"success": True}
                return {"success": False, "error": r.text}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_page_analytics(self, page_token: str, page_id: str) -> dict:
        """Get basic page analytics via Graph API."""
        try:
            async with httpx.AsyncClient() as client:
                # Page info
                r = await client.get(f"https://graph.facebook.com/v21.0/{page_id}", params={"access_token": page_token, "fields": "name,fan_count,followers_count,engagement"})
                data = r.json() if r.status_code == 200 else {}
                return {
                    "page_name": data.get("name"),
                    "likes": data.get("fan_count", 0),
                    "followers": data.get("followers_count", 0),
                }
        except:
            return {}

    async def close(self):
        if self._browser:
            await self._browser.close()
            self._browser = None
            self._context = None
            self._page = None
            self._cookies_loaded = False


fb_service = FacebookService()