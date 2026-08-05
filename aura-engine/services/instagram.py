from instagrapi import Client
import json
import base64
import os
import pickle
import logging
from typing import Optional

log = logging.getLogger("aura.ig")

SESSION_FILE = "/tmp/ig_session.pkl"


class InstagramService:
    def __init__(self):
        self.cl = Client()
        self._logged_in = False

    def load_session_from_cookies(self, cookies_b64: str) -> bool:
        """Load Instagram session from base64-encoded cookies (from browser export)."""
        try:
            cookies = json.loads(base64.b64decode(cookies_b64))
            session = self.cl.cookie_container
            # Clear existing
            session.clear()
            for c in cookies:
                cookie = {
                    "name": c["name"],
                    "value": c["value"],
                    "domain": c.get("domain", ".instagram.com"),
                    "path": c.get("path", "/"),
                }
                session.set(**cookie)
            # Try to get current user to verify session
            self.cl.get_timeline_feed()
            self._logged_in = True
            log.info("IG session loaded from cookies successfully")
            self.save_session()
            return True
        except Exception as e:
            log.error(f"IG session load failed: {e}")
            return False

    def login_with_sessionid(self, sessionid: str) -> bool:
        """Login using sessionid cookie directly."""
        try:
            self.cl.login_by_sessionid(sessionid)
            self._logged_in = True
            log.info("IG login by sessionid successful")
            self.save_session()
            return True
        except Exception as e:
            log.error(f"IG login by sessionid failed: {e}")
            return False

    def login_with_password(self, username: str, password: str) -> bool:
        """Login with username and password."""
        try:
            self.cl.login(username, password)
            self._logged_in = True
            log.info("IG login with password successful")
            self.save_session()
            return True
        except Exception as e:
            log.error(f"IG login with password failed: {e}")
            return False

    def relogin(self) -> bool:
        """
        Tenta relogin na sequencia: sessionid -> cookies b64 -> password.
        Cada metodo verifica se a sessao fica valida apos o tentativa.
        """
        # 1) Tentar com sessionid
        sid = os.getenv("IG_SESSIONID", "")
        if sid:
            log.info("relogin: a tentar via sessionid...")
            if self.login_with_sessionid(sid):
                log.info("relogin: sucesso via sessionid")
                return True
            log.warning("relogin: falhou via sessionid")

        # 2) Tentar com cookies b64
        b64 = os.getenv("AURA_IG_COOKIES_B64", "")
        if not b64:
            # Tambem tentar config.IG_COOKIES_B64 se ja foi importado
            try:
                import config
                b64 = getattr(config, "IG_COOKIES_B64", "")
            except Exception:
                pass
        if b64:
            log.info("relogin: a tentar via cookies b64...")
            if self.load_session_from_cookies(b64):
                log.info("relogin: sucesso via cookies b64")
                return True
            log.warning("relogin: falhou via cookies b64")

        # 3) Tentar com password
        username = os.getenv("IG_USERNAME", "")
        password = os.getenv("IG_PASSWORD", "")
        if username and password:
            log.info("relogin: a tentar via password...")
            if self.login_with_password(username, password):
                log.info("relogin: sucesso via password")
                return True
            log.warning("relogin: falhou via password")

        # 4) Tentar carregar sessao gravada em ficheiro
        if self.load_session():
            log.info("relogin: sucesso via ficheiro de sessao")
            return True

        log.error("relogin: todas as tentativas falharam")
        return False

    def save_session(self) -> bool:
        """Grava as settings do instagrapi (incluindo cookies) em /tmp/ig_session.pkl."""
        try:
            settings = self.cl.get_settings()
            with open(SESSION_FILE, "wb") as f:
                pickle.dump(settings, f)
            log.info(f"IG sessao gravada em {SESSION_FILE}")
            return True
        except Exception as e:
            log.error(f"Falha ao gravar sessao IG: {e}")
            return False

    def load_session(self) -> bool:
        """Carrega as settings do instagrapi a partir de /tmp/ig_session.pkl."""
        try:
            if not os.path.exists(SESSION_FILE):
                return False
            with open(SESSION_FILE, "rb") as f:
                settings = pickle.load(f)
            self.cl.set_settings(settings)
            self.cl.login("__dummy__", "__dummy__")  # trigger session restore
            # Verificar sessao
            self.cl.get_timeline_feed()
            self._logged_in = True
            log.info(f"IG sessao carregada de {SESSION_FILE}")
            return True
        except Exception as e:
            log.error(f"Falha ao carregar sessao IG do ficheiro: {e}")
            self._logged_in = False
            return False

    def ensure_logged_in(self) -> bool:
        """Ensure we have an active session."""
        if self._logged_in:
            try:
                self.cl.get_timeline_feed()
                return True
            except:
                self._logged_in = False
        # Tentar relogin automatico
        if self.relogin():
            return True
        return False

    def get_session_cookies_b64(self) -> str:
        """Export current session cookies as base64."""
        try:
            cookies = self.cl.get_settings().get("cookies", {})
            cookie_list = []
            for name, value in cookies.items():
                cookie_list.append({
                    "name": name,
                    "value": value,
                    "domain": ".instagram.com"
                })
            return base64.b64encode(json.dumps(cookie_list).encode()).decode()
        except Exception as e:
            log.error(f"Failed to export cookies: {e}")
            return ""

    def send_dm(self, target_username: str, message: str) -> dict:
        """Send a DM to a user."""
        try:
            user_id = self.cl.user_id_from_username(target_username)
            result = self.cl.direct_send(message, user_id)
            log.info(f"DM sent to {target_username}: {result}")
            return {"success": True, "message_id": str(result), "target": target_username}
        except Exception as e:
            log.error(f"DM send failed to {target_username}: {e}")
            return {"success": False, "error": str(e), "target": target_username}

    def send_bulk_dms(self, targets: list, message: str, delay: int = 15) -> dict:
        """Send DMs to multiple users with delay."""
        import time
        results = []
        sent = 0
        failed = 0
        for target in targets:
            r = self.send_dm(target, message)
            results.append(r)
            if r["success"]:
                sent += 1
            else:
                failed += 1
            if target != targets[-1]:
                time.sleep(delay + (hash(target) % 10))  # 15-25s random
        return {"total": len(targets), "sent": sent, "failed": failed, "results": results}

    def get_inbox(self, limit: int = 20) -> list:
        """Get DM inbox threads."""
        try:
            threads = self.cl.direct_threads(amount=limit)
            result = []
            for t in threads:
                messages = t.messages or []
                last_msg = messages[0].text if messages else ""
                result.append({
                    "thread_id": str(t.id),
                    "users": [str(u.pk) for u in t.users],
                    "last_message": last_msg[:200],
                    "unread": t.unread_count or 0,
                })
            return result
        except Exception as e:
            log.error(f"Get inbox failed: {e}")
            return []

    def get_inbox_detailed(self, limit: int = 20) -> list:
        """Get DM inbox com detalhes completos para auto-reply (inclui mensagens recentes)."""
        try:
            threads = self.cl.direct_threads(amount=limit)
            result = []
            for t in threads:
                messages = t.messages or []
                thread_msgs = []
                for m in messages[:5]:
                    thread_msgs.append({
                        "text": getattr(m, "text", ""),
                        "user_id": str(getattr(m, "user_id", "")),
                        "timestamp": str(getattr(m, "timestamp", "")),
                    })
                last_msg = messages[0].text if messages else ""
                # Identificar o outro utilizador (nao o dono da conta)
                other_users = []
                try:
                    me_id = str(self.cl.user_id)
                    for u in t.users:
                        uid = str(u.pk)
                        if uid != me_id:
                            other_users.append({"pk": uid, "username": u.username})
                except Exception:
                    other_users = [{"pk": str(u.pk), "username": getattr(u, "username", "")} for u in t.users]
                result.append({
                    "thread_id": str(t.id),
                    "users": other_users,
                    "last_message": last_msg[:200],
                    "unread": t.unread_count or 0,
                    "messages": thread_msgs,
                })
            return result
        except Exception as e:
            log.error(f"Get inbox detailed failed: {e}")
            return []

    def reply_to_dm(self, thread_id: str, message: str) -> dict:
        """Reply to an existing DM thread."""
        try:
            result = self.cl.direct_send(message, thread_ids=[int(thread_id)])
            return {"success": True, "thread_id": thread_id}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_user_info(self, username: str) -> dict:
        """Get user profile info."""
        try:
            user = self.cl.user_info_by_username(username)
            return {
                "success": True,
                "username": user.username,
                "full_name": user.full_name,
                "bio": user.biography or "",
                "followers": user.follower_count,
                "following": user.following_count,
                "is_private": user.is_private,
                "profile_pic": user.profile_pic_url or "",
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_followers(self, username: str, amount: int = 100) -> list:
        """Get followers list."""
        try:
            user_id = self.cl.user_id_from_username(username)
            followers = self.cl.user_followers(user_id, amount=amount)
            return [{"username": f.username, "full_name": f.full_name, "pk": str(f.pk)} for f in followers]
        except Exception as e:
            log.error(f"Get followers failed: {e}")
            return []

    def get_media_comments(self, media_id: str) -> list:
        """Get comments on a media post."""
        try:
            comments = self.cl.media_comments(media_id)
            return [{"id": str(c.pk), "user": c.user.username, "text": c.text, "created": str(c.created_at_utc)} for c in comments]
        except Exception as e:
            log.error(f"Get comments failed: {e}")
            return []

    def reply_comment(self, media_id: str, comment_id: str, text: str) -> dict:
        """Reply to a comment."""
        try:
            self.cl.media_comment_reply(media_id, comment_id, text)
            return {"success": True, "comment_id": comment_id}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def upload_post(self, image_path: str, caption: str = "") -> dict:
        """Upload a feed post."""
        try:
            if not os.path.exists(image_path):
                return {"success": False, "error": f"File not found: {image_path}"}
            media_id = self.cl.photo_upload(image_path, caption=caption)
            return {"success": True, "media_id": str(media_id)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def upload_story(self, image_path: str, caption: str = "") -> dict:
        """Upload a story."""
        try:
            if not os.path.exists(image_path):
                return {"success": False, "error": f"File not found: {image_path}"}
            media_id = self.cl.photo_upload_to_story(image_path)
            return {"success": True, "media_id": str(media_id)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_user_feed(self, username: str, amount: int = 10) -> list:
        """Get user's recent posts."""
        try:
            user_id = self.cl.user_id_from_username(username)
            medias = self.cl.user_medias(user_id, amount=amount)
            return [{"id": str(m.pk), "caption": m.caption_text or "", "likes": m.like_count, "comments": m.comment_count, "type": m.media_type} for m in medias]
        except Exception as e:
            return []


# Singleton
ig_service = InstagramService()
