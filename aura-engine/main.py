"""
Aura v4 - Mwango Brain Social Media Engine
Complete API: Cold DMs, Posts, Stories, Comments, Auto-Reply, Scheduling, Leads, Campaigns, Analytics
Enhanced: APScheduler, Auto-DM-Reply, FB Stories, Health Check detalhado, IG Relogin/Persistencia
"""
import os
import sys
import json
import base64
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
log = logging.getLogger("aura")

# Ensure project root
sys.path.insert(0, str(Path(__file__).parent))

import config
from database import init_db, get_db, DB_PATH
from utils.helpers import create_token, verify_token
from services.instagram import ig_service
from services.facebook import fb_service
from services.ai import generate_ai_response

# ─── APScheduler ───
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

scheduler = AsyncIOScheduler()
scheduler_running = False


# ─── Auto DM Reply ───
async def auto_dm_reply_loop():
    """
    Verifica o inbox do Instagram a cada 5 minutos e responde automaticamente
    a mensagens nao lidas que nao tiveram resposta na ultima hora.
    """
    if not config.AUTO_REPLY_ENABLED:
        return
    if not ig_service.ensure_logged_in():
        log.warning("auto_dm_reply: sessao IG invalida, a saltar...")
        return
    try:
        threads = ig_service.get_inbox_detailed(limit=30)
        db = await get_db().__anext__()
        try:
            for t in threads:
                unread = t.get("unread", 0)
                if unread <= 0:
                    continue
                thread_id = t["thread_id"]
                users = t.get("users", [])
                if not users:
                    continue
                username = users[0].get("username", "desconhecido")

                # Verificar se ja respondemos nesta thread na ultima hora
                rows = await db.execute_fetchall(
                    "SELECT created_at FROM dm_log WHERE platform='instagram' AND target_username=? AND direction='incoming_reply' AND status='sent' ORDER BY created_at DESC LIMIT 1",
                    (thread_id,),
                )
                if rows:
                    last_reply_str = rows[0]["created_at"]
                    try:
                        last_reply_time = datetime.strptime(last_reply_str, "%Y-%m-%d %H:%M:%S")
                        if datetime.now() - last_reply_time < timedelta(hours=1):
                            log.debug(f"auto_dm_reply: thread {thread_id} ja teve resposta recente, a saltar")
                            continue
                    except Exception:
                        pass

                # Construir contexto a partir das mensagens recentes
                messages = t.get("messages", [])
                context_parts = []
                for m in messages:
                    context_parts.append(m.get("text", ""))
                context = "\n".join(context_parts[-3:]) if context_parts else "Mensagem de " + username

                # Gerar resposta com IA
                ai_msg = await generate_ai_response("reply", context, f"Alvo: @{username}")
                if not ai_msg:
                    log.warning(f"auto_dm_reply: IA nao gerou resposta para thread {thread_id}")
                    continue

                # Enviar resposta
                result = ig_service.reply_to_dm(thread_id, ai_msg)
                if result.get("success"):
                    log.info(f"auto_dm_reply: respondi a @{username} na thread {thread_id}")
                else:
                    log.warning(f"auto_dm_reply: falha ao responder thread {thread_id}: {result.get('error')}")

                # Registrar no log
                await db.execute(
                    "INSERT INTO dm_log (platform, direction, target_username, message, ai_generated, status, error) VALUES (?, 'incoming_reply', ?, ?, 1, ?, ?)",
                    ("instagram", thread_id, ai_msg, "sent" if result.get("success") else "failed", result.get("error")),
                )
                await db.commit()

                # Pausa entre respostas para evitar rate limit
                await asyncio.sleep(3)
        finally:
            await db.close()
    except Exception as e:
        log.error(f"auto_dm_reply erro: {e}")


# ─── Scheduled Task Executor ───
async def execute_scheduled_tasks():
    """
    Verifica a tabela scheduled_tasks e executa tarefas pendentes
    cujo scheduled_at ja passou.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    db = await get_db().__anext__()
    try:
        rows = await db.execute_fetchall(
            "SELECT * FROM scheduled_tasks WHERE status='pending' AND scheduled_at <= ? ORDER BY scheduled_at ASC",
            (now_iso,),
        )
        for row in rows:
            task = dict(row)
            task_id = task["id"]
            task_type = task["task_type"]
            platform = task["platform"]
            payload = json.loads(task["payload"]) if isinstance(task["payload"], str) else task["payload"]
            log.info(f"Scheduler: a executar tarefa {task_id} ({task_type}) para {platform}")
            try:
                result = await _execute_single_task(task_type, platform, payload)
                status = "completed" if result.get("success") else "failed"
                error = result.get("error")
                await db.execute(
                    "UPDATE scheduled_tasks SET status=?, result=?, error=? WHERE id=?",
                    (status, json.dumps(result, default=str)[:2000], error, task_id),
                )
                log.info(f"Scheduler: tarefa {task_id} -> {status}")
            except Exception as e:
                log.error(f"Scheduler: erro ao executar tarefa {task_id}: {e}")
                await db.execute(
                    "UPDATE scheduled_tasks SET status='failed', error=? WHERE id=?",
                    (str(e)[:1000], task_id),
                )
            await db.commit()
            # Pausa entre tarefas para evitar sobrecarga
            await asyncio.sleep(2)
    except Exception as e:
        log.error(f"Scheduler erro geral: {e}")
    finally:
        await db.close()


async def _execute_single_task(task_type: str, platform: str, payload: dict) -> dict:
    """Executa uma tarefa agendada individual baseada no tipo."""
    if task_type == "post":
        return await _execute_scheduled_post(platform, payload)
    elif task_type == "story":
        return await _execute_scheduled_story(platform, payload)
    elif task_type == "dm":
        return await _execute_scheduled_dm(platform, payload)
    else:
        return {"success": False, "error": f"Tipo de tarefa desconhecido: {task_type}"}


async def _execute_scheduled_post(platform: str, payload: dict) -> dict:
    """Executa um post agendado."""
    caption = payload.get("caption", "")
    image_url = payload.get("image_url")
    ai_generate = payload.get("ai_generate_caption", False)
    context = payload.get("context", "")

    if ai_generate and not caption:
        caption = await generate_ai_response("post_caption", context)

    if platform in ("facebook", "fb") and config.META_PAGE_TOKEN:
        return await fb_service.publish_post(config.META_PAGE_TOKEN, config.FB_PAGE_ID, caption, image_url)
    elif platform in ("instagram", "ig"):
        if not ig_service.ensure_logged_in():
            return {"success": False, "error": "Sessao IG invalida"}
        if image_url:
            import httpx
            async with httpx.AsyncClient() as client:
                r = await client.get(image_url)
                path = f"/tmp/scheduled_post_{datetime.now().timestamp()}.jpg"
                with open(path, "wb") as f:
                    f.write(r.content)
            result = ig_service.upload_post(path, caption)
            # Limpar ficheiro temporario
            try:
                os.remove(path)
            except Exception:
                pass
            return result
        return {"success": False, "error": "Instagram requer imagem para posts"}
    return {"success": False, "error": "Platform invalida ou sem token"}


async def _execute_scheduled_story(platform: str, payload: dict) -> dict:
    """Executa uma story agendada."""
    image_url = payload.get("image_url")
    caption = payload.get("caption", "")

    if not image_url:
        return {"success": False, "error": "URL de imagem necessaria para stories"}

    if platform in ("instagram", "ig"):
        if not ig_service.ensure_logged_in():
            return {"success": False, "error": "Sessao IG invalida"}
        import httpx
        async with httpx.AsyncClient() as client:
            r = await client.get(image_url)
            path = f"/tmp/scheduled_story_{datetime.now().timestamp()}.jpg"
            with open(path, "wb") as f:
                f.write(r.content)
        result = ig_service.upload_story(path, caption)
        try:
            os.remove(path)
        except Exception:
            pass
        return result
    elif platform in ("facebook", "fb") and config.META_PAGE_TOKEN:
        return await fb_service.publish_story(config.META_PAGE_TOKEN, config.FB_PAGE_ID, image_url)
    return {"success": False, "error": "Platform invalida para stories"}


async def _execute_scheduled_dm(platform: str, payload: dict) -> dict:
    """Executa um DM agendado."""
    target = payload.get("target")
    message = payload.get("message")
    ai_generate = payload.get("ai_generate", True)
    context = payload.get("context", "Mwango Brain - agencia digital em Angola")

    if not target:
        return {"success": False, "error": "Alvo nao especificado"}

    if ai_generate and not message:
        message = await generate_ai_response("cold_dm", context, f"Alvo: @{target}")

    if not message:
        return {"success": False, "error": "Mensagem nao gerada"}

    if platform in ("instagram", "ig"):
        if not ig_service.ensure_logged_in():
            return {"success": False, "error": "Sessao IG invalida"}
        return ig_service.send_dm(target, message)
    elif platform in ("facebook", "fb"):
        return await fb_service.send_dm(target, message)
    return {"success": False, "error": "Platform invalida"}


# ─── App Lifespan ───
@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduler_running
    await init_db()
    log.info("Database initialized")

    # Tentar carregar sessao IG (persistence file primeiro, depois env vars)
    loaded = False
    if os.path.exists(config.IG_SESSION_FILE):
        loaded = ig_service.load_session()
        if loaded:
            log.info("IG session loaded from persistence file")
    if not loaded:
        ig_sid = config.IG_SESSIONID or os.getenv("IG_SESSIONID", "")
        ig_b64 = config.IG_COOKIES_B64 or os.getenv("AURA_IG_COOKIES_B64", "")
        if ig_sid:
            loaded = ig_service.login_with_sessionid(ig_sid)
        elif ig_b64:
            loaded = ig_service.load_session_from_cookies(ig_b64)
        if not loaded:
            log.warning("Nenhuma sessao IG valida encontrada. Usa /api/import_cookies ou relogin.")

    # Iniciar APScheduler
    scheduler.add_job(execute_scheduled_tasks, IntervalTrigger(seconds=30), id="scheduled_tasks_executor", replace_existing=True)
    scheduler.add_job(auto_dm_reply_loop, IntervalTrigger(minutes=5), id="auto_dm_reply", replace_existing=True)
    scheduler.start()
    scheduler_running = True
    log.info("APScheduler iniciado: scheduled_tasks a cada 30s, auto_dm_reply a cada 5min")

    log.info("Aura v4 started")
    yield

    # Shutdown
    scheduler.shutdown(wait=False)
    scheduler_running = False
    log.info("APScheduler parado")
    await fb_service.close()


app = FastAPI(title="Aura // Mwango Brain", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Auth Dependency ───
async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Token necessario")
    token = authorization.replace("Bearer ", "")
    if not verify_token(token):
        raise HTTPException(401, "Token invalido")
    return True

# ─── Request Models ───
class AuthRequest(BaseModel):
    password: str

class CookieImport(BaseModel):
    platform: str
    cookies: str  # JSON string or array

class DMSend(BaseModel):
    platform: str
    target: str
    message: Optional[str] = None
    context: Optional[str] = "Mwango Brain - agencia digital em Angola"
    ai_generate: Optional[bool] = True

class BulkDM(BaseModel):
    platform: str
    targets: list
    message: Optional[str] = None
    context: Optional[str] = "Mwango Brain - agencia digital em Angola"
    delay: Optional[int] = 15

class PostCreate(BaseModel):
    platform: str
    caption: Optional[str] = ""
    image_url: Optional[str] = None
    ai_generate_caption: Optional[bool] = False
    context: Optional[str] = ""
    scheduled_at: Optional[str] = None

class StoryCreate(BaseModel):
    platform: str
    caption: Optional[str] = ""
    image_url: Optional[str] = None

class CommentReply(BaseModel):
    platform: str
    post_id: str
    comment_id: str
    ai_generate: Optional[bool] = True
    reply_text: Optional[str] = None

class ScheduleCreate(BaseModel):
    task_type: str  # post, story, dm
    platform: str
    payload: dict
    scheduled_at: str  # ISO datetime

class CampaignCreate(BaseModel):
    name: str
    platform: str
    message_template: Optional[str] = ""
    context: Optional[str] = ""
    target_list: list

class AIRequest(BaseModel):
    prompt_type: str
    context: str
    extra: Optional[str] = ""

# ═══════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════
@app.post("/api/auth")
async def auth(req: AuthRequest):
    if req.password != config.AUTH_PASSWORD:
        raise HTTPException(403, "Password errada")
    return {"success": True, "token": create_token()}

# ═══════════════════════════════════════════
# STATUS / DASHBOARD / HEALTH
# ═══════════════════════════════════════════
@app.get("/api/health")
async def health():
    """Health check detalhado com estado de todos os subsistemas."""
    # Estado da sessao IG
    try:
        ig_alive = ig_service.ensure_logged_in()
        ig_username = ""
        if ig_alive:
            try:
                ig_username = ig_service.cl.username
            except Exception:
                pass
    except Exception:
        ig_alive = False
        ig_username = ""

    # Estado do token FB
    fb_token_ok = bool(config.META_PAGE_TOKEN)

    # Estado do scheduler
    sched_jobs = []
    try:
        for job in scheduler.get_jobs():
            sched_jobs.append({
                "id": job.id,
                "next_run": str(job.next_run_time) if job.next_run_time else None,
            })
    except Exception:
        pass

    # Tamanho da base de dados
    db_size_bytes = 0
    try:
        if os.path.exists(DB_PATH):
            db_size_bytes = os.path.getsize(DB_PATH)
    except Exception:
        pass

    def _fmt_size(b):
        if b < 1024:
            return f"{b} B"
        elif b < 1024 * 1024:
            return f"{b / 1024:.1f} KB"
        else:
            return f"{b / (1024 * 1024):.1f} MB"

    return {
        "status": "ok",
        "version": "4.1",
        "ig": {
            "session_active": ig_alive,
            "username": ig_username,
            "has_sessionid": bool(config.IG_SESSIONID),
            "has_cookies_b64": bool(config.IG_COOKIES_B64),
            "session_file_exists": os.path.exists(config.IG_SESSION_FILE),
        },
        "fb": {
            "token_configured": fb_token_ok,
            "page_id": config.FB_PAGE_ID,
            "has_cookies_b64": bool(config.FB_COOKIES_B64),
        },
        "scheduler": {
            "running": scheduler_running,
            "jobs": sched_jobs,
        },
        "database": {
            "path": DB_PATH,
            "size_bytes": db_size_bytes,
            "size_human": _fmt_size(db_size_bytes),
        },
        "auto_reply_enabled": config.AUTO_REPLY_ENABLED,
        "uptime_check": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/status")
async def status(_=Depends(get_current_user)):
    ig_alive = ig_service.ensure_logged_in()
    ig_user = ""
    if ig_alive:
        try:
            ig_user = ig_service.cl.username
        except:
            pass
    return {
        "success": True,
        "ig_session": ig_alive,
        "ig_username": ig_user,
        "ig_cookies": bool(config.IG_SESSIONID or config.IG_COOKIES_B64),
        "fb_cookies": bool(config.FB_COOKIES_B64),
        "fb_page_token": bool(config.META_PAGE_TOKEN),
        "fb_page_id": config.FB_PAGE_ID,
        "scheduler_running": scheduler_running,
        "auto_reply_enabled": config.AUTO_REPLY_ENABLED,
        "version": "4.1",
    }

@app.post("/api/dashboard")
async def dashboard(_=Depends(get_current_user)):
    db = await get_db().__anext__()
    try:
        # Leads summary
        total_leads = (await db.execute_fetchall("SELECT COUNT(*) as c FROM leads"))[0]["c"]
        new_leads = (await db.execute_fetchall("SELECT COUNT(*) as c FROM leads WHERE status='new'"))[0]["c"]
        contacted = (await db.execute_fetchall("SELECT COUNT(*) as c FROM leads WHERE status='contacted'"))[0]["c"]
        replied = (await db.execute_fetchall("SELECT COUNT(*) as c FROM leads WHERE reply_count > 0"))[0]["c"]
        # DM stats
        dm_sent = (await db.execute_fetchall("SELECT COUNT(*) as c FROM dm_log WHERE direction='outgoing' AND status='sent'"))[0]["c"]
        dm_received = (await db.execute_fetchall("SELECT COUNT(*) as c FROM dm_log WHERE direction='incoming'"))[0]["c"]
        # Posts
        posts_published = (await db.execute_fetchall("SELECT COUNT(*) as c FROM posts WHERE status='published'"))[0]["c"]
        posts_scheduled = (await db.execute_fetchall("SELECT COUNT(*) as c FROM posts WHERE status='scheduled'"))[0]["c"]
        # Campaigns
        active_campaigns = (await db.execute_fetchall("SELECT COUNT(*) as c FROM campaigns WHERE status IN ('active','running')"))[0]["c"]
        # Comments replied
        comments_replied = (await db.execute_fetchall("SELECT COUNT(*) as c FROM comments WHERE replied=1"))[0]["c"]
        # Scheduled tasks
        pending_tasks = (await db.execute_fetchall("SELECT COUNT(*) as c FROM scheduled_tasks WHERE status='pending'"))[0]["c"]
        # Recent DMs
        recent_dms = await db.execute_fetchall("SELECT * FROM dm_log ORDER BY created_at DESC LIMIT 5")
        dm_list = [dict(r) for r in recent_dms]
        # Recent leads
        recent_leads = await db.execute_fetchall("SELECT * FROM leads ORDER BY created_at DESC LIMIT 5")
        lead_list = [dict(r) for r in recent_leads]
        return {
            "success": True,
            "leads": {"total": total_leads, "new": new_leads, "contacted": contacted, "replied": replied},
            "dms": {"sent": dm_sent, "received": dm_received},
            "posts": {"published": posts_published, "scheduled": posts_scheduled},
            "campaigns_active": active_campaigns,
            "comments_replied": comments_replied,
            "pending_tasks": pending_tasks,
            "recent_dms": dm_list,
            "recent_leads": lead_list,
        }
    finally:
        await db.close()

# ═══════════════════════════════════════════
# COOKIES / SESSION
# ═══════════════════════════════════════════
@app.post("/api/import_cookies")
async def import_cookies(req: CookieImport, _=Depends(get_current_user)):
    try:
        if isinstance(req.cookies, str):
            cookies = json.loads(req.cookies)
        else:
            cookies = req.cookies
        b64 = base64.b64encode(json.dumps(cookies).encode()).decode()
        if req.platform in ("instagram", "ig"):
            success = ig_service.load_session_from_cookies(b64)
            if success:
                config.IG_COOKIES_B64 = b64
        elif req.platform in ("facebook", "fb"):
            config.FB_COOKIES_B64 = b64
            success = True
        else:
            raise HTTPException(400, "Platform invalida: usar instagram ou facebook")
        return {"success": success, "count": len(cookies)}
    except json.JSONDecodeError:
        raise HTTPException(400, "Cookies invalidos - enviar como JSON array")

@app.post("/api/keep_alive")
async def keep_alive(platform: str, _=Depends(get_current_user)):
    if platform in ("instagram", "ig"):
        alive = ig_service.ensure_logged_in()
        return {"success": True, "alive": alive, "platform": "instagram"}
    elif platform in ("facebook", "fb"):
        alive = await fb_service.ensure_page()
        return {"success": True, "alive": alive, "platform": "facebook"}
    raise HTTPException(400, "Platform invalida")

@app.post("/api/ig/relogin")
async def ig_relogin(_=Depends(get_current_user)):
    """Forca relogin do Instagram tentando sessionid -> cookies -> password -> ficheiro."""
    success = ig_service.relogin()
    return {"success": success, "logged_in": ig_service._logged_in}

# ═══════════════════════════════════════════
# COLD DMs
# ═══════════════════════════════════════════
@app.post("/api/dm/send")
async def send_dm(req: DMSend, _=Depends(get_current_user)):
    # Generate AI message if needed
    message = req.message
    if req.ai_generate and not message:
        message = await generate_ai_response("cold_dm", req.context, f"Alvo: @{req.target}")
    if not message:
        raise HTTPException(400, "Mensagem necessaria")
    # Save to lead
    db = await get_db().__anext__()
    try:
        await db.execute("INSERT OR IGNORE INTO leads (platform, username, status) VALUES (?, ?, 'contacted')", (req.platform, req.target))
        await db.commit()
    finally:
        await db.close()
    # Send
    if req.platform in ("instagram", "ig"):
        if not ig_service.ensure_logged_in():
            raise HTTPException(401, "Sessao Instagram invalida - reimporta os cookies")
        result = ig_service.send_dm(req.target, message)
    elif req.platform in ("facebook", "fb"):
        result = await fb_service.send_dm(req.target, message)
    else:
        raise HTTPException(400, "Platform invalida")
    # Log
    db = await get_db().__anext__()
    try:
        await db.execute("INSERT INTO dm_log (platform, direction, target_username, message, ai_generated, status, error) VALUES (?, 'outgoing', ?, ?, ?, ?, ?)",
            (req.platform, req.target, message, 1 if req.ai_generate else 0, "sent" if result["success"] else "failed", result.get("error")))
        if result["success"]:
            await db.execute("UPDATE leads SET last_dm_sent=datetime('now'), dm_count=dm_count+1, updated_at=datetime('now') WHERE platform=? AND username=?", (req.platform, req.target))
        await db.commit()
    finally:
        await db.close()
    return result

@app.post("/api/dm/bulk")
async def bulk_dm(req: BulkDM, _=Depends(get_current_user)):
    if len(req.targets) > 50:
        raise HTTPException(400, "Maximo 50 alvos por pedido")
    message = req.message or await generate_ai_response("cold_dm", req.context)
    results = []
    if req.platform in ("instagram", "ig"):
        if not ig_service.ensure_logged_in():
            raise HTTPException(401, "Sessao Instagram invalida")
        raw = ig_service.send_bulk_dms(req.targets, message, req.delay)
        results = raw.get("results", [])
    else:
        for t in req.targets:
            r = await fb_service.send_dm(t, message)
            results.append(r)
            await asyncio.sleep(req.delay)
    # Log all
    db = await get_db().__anext__()
    try:
        for r in results:
            target = r.get("target", "")
            await db.execute("INSERT INTO dm_log (platform, direction, target_username, message, ai_generated, status) VALUES (?, 'outgoing', ?, ?, 1, ?)",
                (req.platform, target, message, "sent" if r.get("success") else "failed"))
            if r.get("success"):
                await db.execute("INSERT OR IGNORE INTO leads (platform, username, status) VALUES (?, ?, 'contacted')", (req.platform, target))
                await db.execute("UPDATE leads SET dm_count=dm_count+1, last_dm_sent=datetime('now') WHERE platform=? AND username=?", (req.platform, target))
        await db.commit()
    finally:
        await db.close()
    sent = sum(1 for r in results if r.get("success"))
    return {"success": True, "total": len(results), "sent": sent, "failed": len(results) - sent, "results": results}

@app.post("/api/dm/inbox")
async def get_inbox(platform: str, limit: int = 20, _=Depends(get_current_user)):
    if platform in ("instagram", "ig"):
        if not ig_service.ensure_logged_in():
            raise HTTPException(401, "Sessao invalida")
        return {"success": True, "threads": ig_service.get_inbox(limit)}
    elif platform in ("facebook", "fb"):
        if not config.META_PAGE_TOKEN:
            raise HTTPException(400, "META_PAGE_TOKEN nao configurado")
        convos = await fb_service.get_page_conversations(config.META_PAGE_TOKEN, config.FB_PAGE_ID)
        return {"success": True, "conversations": convos}
    raise HTTPException(400, "Platform invalida")

@app.post("/api/dm/reply")
async def reply_dm(thread_id: str, message: str, platform: str, ai_generate: bool = True, context: str = "", _=Depends(get_current_user)):
    if ai_generate:
        message = await generate_ai_response("reply", context or "responder DM")
    if platform in ("instagram", "ig"):
        result = ig_service.reply_to_dm(thread_id, message)
    else:
        result = await fb_service.send_dm(thread_id, message)
    db = await get_db().__anext__()
    try:
        await db.execute("INSERT INTO dm_log (platform, direction, target_username, message, ai_generated, status) VALUES (?, 'incoming_reply', ?, ?, ?, ?)",
            (platform, thread_id, message, 1 if ai_generate else 0, "sent" if result.get("success") else "failed"))
        await db.commit()
    finally:
        await db.close()
    return result

# ═══════════════════════════════════════════
# POSTS
# ═══════════════════════════════════════════
@app.post("/api/posts/create")
async def create_post(req: PostCreate, _=Depends(get_current_user)):
    caption = req.caption
    if req.ai_generate_caption and not caption:
        caption = await generate_ai_response("post_caption", req.context)
    if req.scheduled_at:
        # Save as scheduled
        db = await get_db().__anext__()
        try:
            await db.execute("INSERT INTO posts (platform, post_type, caption, media_urls, status, scheduled_at) VALUES (?, 'feed', ?, '[]', 'scheduled', ?)",
                (req.platform, caption, req.scheduled_at))
            await db.commit()
            return {"success": True, "status": "scheduled", "scheduled_at": req.scheduled_at}
        finally:
            await db.close()
    # Publish now
    if req.platform in ("facebook", "fb") and config.META_PAGE_TOKEN:
        result = await fb_service.publish_post(config.META_PAGE_TOKEN, config.FB_PAGE_ID, caption or "", req.image_url)
    elif req.platform in ("instagram", "ig"):
        if req.image_url:
            # Download and upload
            import httpx
            async with httpx.AsyncClient() as client:
                r = await client.get(req.image_url)
                path = f"/tmp/post_{datetime.now().timestamp()}.jpg"
                with open(path, "wb") as f:
                    f.write(r.content)
            result = ig_service.upload_post(path, caption)
        else:
            result = {"success": False, "error": "Instagram requer imagem para posts"}
    else:
        result = {"success": False, "error": "Platform invalida ou sem token"}
    # Log
    db = await get_db().__anext__()
    try:
        await db.execute("INSERT INTO posts (platform, post_type, caption, media_urls, status, published_at, post_id, error) VALUES (?, 'feed', ?, ?, ?, ?, ?, ?)",
            (req.platform, caption, json.dumps([req.image_url] if req.image_url else []), "published" if result.get("success") else "failed", datetime.utcnow().isoformat() if result.get("success") else None, result.get("post_id"), result.get("error")))
        await db.commit()
    finally:
        await db.close()
    return result

@app.post("/api/posts/list")
async def list_posts(platform: str = None, _=Depends(get_current_user)):
    db = await get_db().__anext__()
    try:
        if platform:
            rows = await db.execute_fetchall("SELECT * FROM posts WHERE platform=? ORDER BY created_at DESC LIMIT 50", (platform,))
        else:
            rows = await db.execute_fetchall("SELECT * FROM posts ORDER BY created_at DESC LIMIT 50")
        return {"success": True, "posts": [dict(r) for r in rows]}
    finally:
        await db.close()

@app.post("/api/posts/fetch")
async def fetch_posts(platform: str, _=Depends(get_current_user)):
    if platform in ("facebook", "fb") and config.META_PAGE_TOKEN:
        posts = await fb_service.get_page_posts(config.META_PAGE_TOKEN, config.FB_PAGE_ID)
        return {"success": True, "posts": posts}
    elif platform in ("instagram", "ig"):
        if not ig_service.ensure_logged_in():
            raise HTTPException(401, "Sessao invalida")
        posts = ig_service.get_user_feed(ig_service.cl.username)
        return {"success": True, "posts": posts}
    raise HTTPException(400, "Platform invalida")

# ═══════════════════════════════════════════
# STORIES
# ═══════════════════════════════════════════
@app.post("/api/stories/create")
async def create_story(req: StoryCreate, _=Depends(get_current_user)):
    if not req.image_url:
        return {"success": False, "error": "URL de imagem necessaria para stories"}
    if req.platform in ("instagram", "ig"):
        if not ig_service.ensure_logged_in():
            raise HTTPException(401, "Sessao Instagram invalida")
        import httpx
        async with httpx.AsyncClient() as client:
            r = await client.get(req.image_url)
            path = f"/tmp/story_{datetime.now().timestamp()}.jpg"
            with open(path, "wb") as f:
                f.write(r.content)
        result = ig_service.upload_story(path, req.caption)
        return result
    elif req.platform in ("facebook", "fb") and config.META_PAGE_TOKEN:
        result = await fb_service.publish_story(config.META_PAGE_TOKEN, config.FB_PAGE_ID, req.image_url)
        return result
    return {"success": False, "error": "Platform invalida para stories"}

# ═══════════════════════════════════════════
# COMMENTS
# ═══════════════════════════════════════════
@app.post("/api/comments/list")
async def list_comments(platform: str, post_id: str, _=Depends(get_current_user)):
    if platform in ("facebook", "fb") and config.META_PAGE_TOKEN:
        comments = await fb_service.get_post_comments(config.META_PAGE_TOKEN, post_id)
        return {"success": True, "comments": comments}
    elif platform in ("instagram", "ig"):
        comments = ig_service.get_media_comments(post_id)
        return {"success": True, "comments": comments}
    raise HTTPException(400, "Platform invalida")

@app.post("/api/comments/reply")
async def reply_to_comment(req: CommentReply, _=Depends(get_current_user)):
    reply_text = req.reply_text
    if req.ai_generate and not reply_text:
        reply_text = await generate_ai_response("comment", "responder comentario")
    if req.platform in ("facebook", "fb") and config.META_PAGE_TOKEN:
        result = await fb_service.reply_comment(config.META_PAGE_TOKEN, req.comment_id, reply_text)
    elif req.platform in ("instagram", "ig"):
        result = ig_service.reply_comment(req.post_id, req.comment_id, reply_text)
    else:
        raise HTTPException(400, "Platform invalida")
    # Log
    db = await get_db().__anext__()
    try:
        await db.execute("INSERT INTO comments (platform, post_id, comment_id, author, text, replied, reply_text) VALUES (?, ?, ?, 'system', ?, 1, ?)",
            (req.platform, req.post_id, req.comment_id, req.reply_text or "", reply_text or ""))
        await db.commit()
    finally:
        await db.close()
    return result

# ═══════════════════════════════════════════
# SCHEDULING
# ═══════════════════════════════════════════
@app.post("/api/schedule/create")
async def create_schedule(req: ScheduleCreate, _=Depends(get_current_user)):
    db = await get_db().__anext__()
    try:
        await db.execute("INSERT INTO scheduled_tasks (task_type, platform, payload, scheduled_at, status) VALUES (?, ?, ?, ?, 'pending')",
            (req.task_type, req.platform, json.dumps(req.payload), req.scheduled_at))
        await db.commit()
        return {"success": True, "message": f"Tarefa agendada para {req.scheduled_at}"}
    finally:
        await db.close()

@app.post("/api/schedule/list")
async def list_schedules(_=Depends(get_current_user)):
    db = await get_db().__anext__()
    try:
        rows = await db.execute_fetchall("SELECT * FROM scheduled_tasks ORDER BY scheduled_at ASC")
        return {"success": True, "tasks": [dict(r) for r in rows]}
    finally:
        await db.close()

@app.post("/api/schedule/delete")
async def delete_schedule(task_id: int, _=Depends(get_current_user)):
    db = await get_db().__anext__()
    try:
        await db.execute("DELETE FROM scheduled_tasks WHERE id=?", (task_id,))
        await db.commit()
        return {"success": True}
    finally:
        await db.close()

# ═══════════════════════════════════════════
# LEADS
# ═══════════════════════════════════════════
@app.post("/api/leads/list")
async def list_leads(platform: str = None, status: str = None, _=Depends(get_current_user)):
    db = await get_db().__anext__()
    try:
        q = "SELECT * FROM leads"
        params = []
        if platform:
            q += " WHERE platform=?"; params.append(platform)
        if status:
            q += f"{' AND' if params else ' WHERE'} status=?"; params.append(status)
        q += " ORDER BY updated_at DESC LIMIT 100"
        rows = await db.execute_fetchall(q, params)
        return {"success": True, "leads": [dict(r) for r in rows]}
    finally:
        await db.close()

@app.post("/api/leads/add")
async def add_lead(platform: str, username: str, notes: str = "", tags: str = "[]", _=Depends(get_current_user)):
    db = await get_db().__anext__()
    try:
        # Get user info
        info = {}
        if platform in ("instagram", "ig") and ig_service.ensure_logged_in():
            info = ig_service.get_user_info(username)
        await db.execute("INSERT OR REPLACE INTO leads (platform, username, full_name, bio, followers, notes, tags) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (platform, username, info.get("full_name", ""), info.get("bio", "")[:200], info.get("followers", 0), notes, tags))
        await db.commit()
        return {"success": True, "lead": username, "info": info}
    finally:
        await db.close()

@app.post("/api/leads/delete")
async def delete_lead(lead_id: int, _=Depends(get_current_user)):
    db = await get_db().__anext__()
    try:
        await db.execute("DELETE FROM leads WHERE id=?", (lead_id,))
        await db.commit()
        return {"success": True}
    finally:
        await db.close()

# ═══════════════════════════════════════════
# CAMPAIGNS
# ═══════════════════════════════════════════
@app.post("/api/campaigns/create")
async def create_campaign(req: CampaignCreate, _=Depends(get_current_user)):
    db = await get_db().__anext__()
    try:
        await db.execute("INSERT INTO campaigns (name, platform, message_template, context, target_list, status) VALUES (?, ?, ?, ?, ?, 'draft')",
            (req.name, req.platform, req.message_template, req.context, json.dumps(req.target_list)))
        await db.commit()
        return {"success": True, "message": f"Campanha '{req.name}' criada com {len(req.target_list)} alvos"}
    finally:
        await db.close()

@app.post("/api/campaigns/list")
async def list_campaigns(_=Depends(get_current_user)):
    db = await get_db().__anext__()
    try:
        rows = await db.execute_fetchall("SELECT * FROM campaigns ORDER BY created_at DESC")
        campaigns = []
        for r in rows:
            c = dict(r)
            c["target_list"] = json.loads(c["target_list"])
            campaigns.append(c)
        return {"success": True, "campaigns": campaigns}
    finally:
        await db.close()

@app.post("/api/campaigns/launch")
async def launch_campaign(campaign_id: int, _=Depends(get_current_user)):
    db = await get_db().__anext__()
    try:
        row = await db.execute_fetchall("SELECT * FROM campaigns WHERE id=?", (campaign_id,))
        if not row:
            raise HTTPException(404, "Campanha nao encontrada")
        c = dict(row[0])
        targets = json.loads(c["target_list"])
        message = c["message_template"] or await generate_ai_response("cold_dm", c["context"])
        await db.execute("UPDATE campaigns SET status='running', started_at=datetime('now') WHERE id=?", (campaign_id,))
        await db.commit()
    finally:
        await db.close()
    # Send DMs
    results = []
    for t in targets:
        if c["platform"] in ("instagram", "ig"):
            r = ig_service.send_dm(t, message)
        else:
            r = await fb_service.send_dm(t, message)
        results.append(r)
        await asyncio.sleep(15 + (hash(t) % 10))
    # Update campaign
    sent = sum(1 for r in results if r.get("success"))
    db = await get_db().__anext__()
    try:
        await db.execute("UPDATE campaigns SET status='completed', sent_count=?, error_count=?, completed_at=datetime('now') WHERE id=?",
            (sent, len(results) - sent, campaign_id))
        for r in results:
            if r.get("success"):
                await db.execute("INSERT OR IGNORE INTO leads (platform, username, status) VALUES (?, ?, 'contacted')", (c["platform"], r.get("target")))
        await db.commit()
    finally:
        await db.close()
    return {"success": True, "campaign_id": campaign_id, "sent": sent, "failed": len(results) - sent}

# ═══════════════════════════════════════════
# ANALYTICS
# ═══════════════════════════════════════════
@app.post("/api/analytics")
async def get_analytics(_=Depends(get_current_user)):
    db = await get_db().__anext__()
    try:
        # DMs sent per day (last 7 days)
        dm_stats = await db.execute_fetchall("""
            SELECT date(created_at) as d, platform, COUNT(*) as c 
            FROM dm_log WHERE direction='outgoing' AND status='sent' 
            GROUP BY d, platform ORDER BY d DESC LIMIT 14""")
        # Lead conversion
        funnel = await db.execute_fetchall("""
            SELECT status, COUNT(*) as c FROM leads GROUP BY status""")
        # Campaign performance
        camp_stats = await db.execute_fetchall("""
            SELECT name, sent_count, reply_count, error_count, status FROM campaigns ORDER BY created_at DESC LIMIT 10""")
        # Top engaged leads
        top_leads = await db.execute_fetchall("""
            SELECT username, platform, dm_count, reply_count, followers FROM leads ORDER BY reply_count DESC LIMIT 10""")
        return {
            "success": True,
            "dm_stats": [dict(r) for r in dm_stats],
            "lead_funnel": [dict(r) for r in funnel],
            "campaigns": [dict(r) for r in camp_stats],
            "top_leads": [dict(r) for r in top_leads],
        }
    finally:
        await db.close()

# ═══════════════════════════════════════════
# AI
# ═══════════════════════════════════════════
@app.post("/api/ai/generate")
async def ai_generate_endpoint(req: AIRequest, _=Depends(get_current_user)):
    message = await generate_ai_response(req.prompt_type, req.context, req.extra)
    return {"success": True, "message": message}

# ═══════════════════════════════════════════
# USER LOOKUP
# ═══════════════════════════════════════════
@app.post("/api/user/lookup")
async def user_lookup(platform: str, username: str, _=Depends(get_current_user)):
    if platform in ("instagram", "ig"):
        if not ig_service.ensure_logged_in():
            raise HTTPException(401, "Sessao invalida")
        info = ig_service.get_user_info(username)
        return info
    return {"success": False, "error": "Lookup so disponivel para Instagram"}

@app.post("/api/user/followers")
async def get_followers(username: str, amount: int = 100, _=Depends(get_current_user)):
    if not ig_service.ensure_logged_in():
        raise HTTPException(401, "Sessao invalida")
    followers = ig_service.get_followers(username, amount)
    return {"success": True, "count": len(followers), "followers": followers}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=config.APP_PORT)
