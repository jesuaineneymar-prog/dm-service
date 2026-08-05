// ============================================================
//  Aura IG PUBLISH — Instagram Posts, Stories, Comments via instagrapi
//  Usa Python subprocess com instagrapi (sem browser, sem BD)
//  Instagrapi: API privada do Instagram, funciona sem proxy
// ============================================================

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { db } from './db';

var execAsync = promisify(exec);

// Check if instagrapi is installed
async function ensureInstagrapi(): Promise<boolean> {
  try {
    var { stdout } = await execAsync('pip show instagrapi 2>/dev/null | head -1');
    if (stdout.includes('instagrapi')) return true;
  } catch(e) {}
  // Try installing
  try {
    await execAsync('pip install instagrapi --quiet 2>&1 | tail -3', { timeout: 60000 });
    return true;
  } catch(e) {
    console.error('[IG Publish] Falha ao instalar instagrapi:', e);
    return false;
  }
}

// Run a Python instagrapi script
async function runInstagrapi(pythonCode: string): Promise<any> {
  var installed = await ensureInstagrapi();
  if (!installed) return { success: false, error: 'instagrapi nao disponivel' };

  var scriptPath = '/tmp/aura_ig_' + Date.now() + '.py';
  fs.writeFileSync(scriptPath, pythonCode);
  try {
    var { stdout, stderr } = await execAsync('python3 ' + scriptPath + ' 2>&1', { timeout: 120000, maxBuffer: 1024 * 1024 });
    var output = stdout.trim();
    if (output.startsWith('{') || output.startsWith('[')) {
      return JSON.parse(output);
    }
    return { success: false, error: output || stderr || 'Erro desconhecido' };
  } catch(e: any) {
    return { success: false, error: e.stderr || e.message };
  } finally {
    try { fs.unlinkSync(scriptPath); } catch(e) {}
  }
}

// Get IG credentials from env
function getIGCreds() {
  return {
    username: process.env.IG_USERNAME || '',
    password: process.env.IG_PASSWORD || '',
  };
}

// === PUBLISH POST ===
export async function igPublishPost(options: {
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  mediaData?: string; // base64
  mediaType?: 'image' | 'video';
}): Promise<{ success: boolean; postId?: string; error?: string }> {
  var creds = getIGCreds();
  if (!creds.username || !creds.password) {
    return { success: false, error: 'IG_USERNAME e IG_PASSWORD necessarios nas env vars' };
  }

  // Handle media — save to temp file
  var mediaPath = '';
  var isVideo = options.mediaType === 'video' || (options.videoUrl && !options.imageUrl);

  if (options.mediaData) {
    var ext = isVideo ? '.mp4' : '.jpg';
    mediaPath = '/tmp/aura_ig_media_' + Date.now() + ext;
    fs.writeFileSync(mediaPath, Buffer.from(options.mediaData, 'base64'));
  } else if (options.imageUrl || options.videoUrl) {
    var url = options.videoUrl || options.imageUrl || '';
    try {
      var res = await fetch(url);
      if (!res.ok) return { success: false, error: 'Falha ao baixar media: HTTP ' + res.status };
      var buf = Buffer.from(await res.arrayBuffer());
      var ext2 = isVideo ? '.mp4' : '.jpg';
      mediaPath = '/tmp/aura_ig_media_' + Date.now() + ext2;
      fs.writeFileSync(mediaPath, buf);
    } catch(e: any) {
      return { success: false, error: 'Falha ao baixar media: ' + e.message };
    }
  } else {
    return { success: false, error: 'Media necessaria (imageUrl, videoUrl, ou mediaData)' };
  }

  var caption = (options.caption || '').replace(/"/g, '\\"');
  var func = isVideo ? 'clip_upload' : 'photo_upload';

  var code = `
import json
from instagrapi import Client
cl = Client()
try:
    cl.login("${creds.username}", "${creds.password}")
    media = cl.${func}(
        path="${mediaPath}",
        caption="${caption}"
    )
    print(json.dumps({"success": True, "postId": str(media.id), "code": media.code}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

  var result = await runInstagrapi(code);

  // Cleanup temp file
  try { if (mediaPath) fs.unlinkSync(mediaPath); } catch(e) {}

  if (result.success) {
    await db.postHistory.create({
      data: {
        platform: 'instagram',
        externalPostId: result.postId,
        caption: options.caption,
        mediaUrl: options.imageUrl || options.videoUrl || null,
        status: 'published',
        source: 'instagrapi',
        publishedAt: new Date(),
      },
    });
  }

  return result;
}

// === PUBLISH STORY ===
export async function igPublishStory(options: {
  imageUrl?: string;
  videoUrl?: string;
  mediaData?: string;
  caption?: string;
  mediaType?: 'image' | 'video';
}): Promise<{ success: boolean; storyId?: string; error?: string }> {
  var creds = getIGCreds();
  if (!creds.username || !creds.password) {
    return { success: false, error: 'IG_USERNAME e IG_PASSWORD necessarios' };
  }

  var mediaPath = '';
  var isVideo = options.mediaType === 'video' || !!options.videoUrl;

  if (options.mediaData) {
    var ext = isVideo ? '.mp4' : '.jpg';
    mediaPath = '/tmp/aura_ig_story_' + Date.now() + ext;
    fs.writeFileSync(mediaPath, Buffer.from(options.mediaData, 'base64'));
  } else if (options.imageUrl || options.videoUrl) {
    var url = options.videoUrl || options.imageUrl || '';
    try {
      var res = await fetch(url);
      if (!res.ok) return { success: false, error: 'Falha ao baixar: HTTP ' + res.status };
      var buf = Buffer.from(await res.arrayBuffer());
      var ext2 = isVideo ? '.mp4' : '.jpg';
      mediaPath = '/tmp/aura_ig_story_' + Date.now() + ext2;
      fs.writeFileSync(mediaPath, buf);
    } catch(e: any) {
      return { success: false, error: 'Falha ao baixar: ' + e.message };
    }
  } else {
    return { success: false, error: 'Media necessaria' };
  }

  var func = isVideo ? 'clip_upload_to_story' : 'photo_upload_to_story';
  var kwargs = isVideo ? '' : `, caption="${(options.caption || '').replace(/"/g, '\\"')}"`;

  var code = `
import json
from instagrapi import Client
cl = Client()
try:
    cl.login("${creds.username}", "${creds.password}")
    media = cl.${func}(path="${mediaPath}"${kwargs})
    print(json.dumps({"success": True, "storyId": str(media.id)}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

  var result = await runInstagrapi(code);
  try { if (mediaPath) fs.unlinkSync(mediaPath); } catch(e) {}
  return result;
}

// === GET COMMENTS ===
export async function igGetComments(mediaId: string, limit?: number) {
  var creds = getIGCreds();
  if (!creds.username || !creds.password) return { success: false, error: 'Credenciais IG em falta' };

  var code = `
import json
from instagrapi import Client
cl = Client()
try:
    cl.login("${creds.username}", "${creds.password}")
    comments = cl.media_comments(str("${mediaId}"), amount=${limit || 50})
    result = []
    for c in comments:
        result.append({"id": str(c.pk), "username": c.user.username, "userId": str(c.user.pk), "text": c.text, "createdAt": c.created_at_utc.isoformat() if c.created_at_utc else ""})
    print(json.dumps({"success": True, "comments": result}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

  return runInstagrapi(code);
}

// === REPLY TO COMMENT ===
export async function igReplyComment(mediaId: string, commentId: string, message: string) {
  var creds = getIGCreds();
  if (!creds.username || !creds.password) return { success: false, error: 'Credenciais IG em falta' };

  var safeMsg = message.replace(/"/g, '\\"');
  var code = `
import json
from instagrapi import Client
cl = Client()
try:
    cl.login("${creds.username}", "${creds.password}")
    reply = cl.media_comment_reply(str("${mediaId}"), str("${commentId}"), "${safeMsg}")
    print(json.dumps({"success": True, "replyId": str(reply.pk)}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

  return runInstagrapi(code);
}

// === SEND DM (for auto-reply and cold DMs) ===
export async function igSendDM(recipientUserId: string, message: string) {
  var creds = getIGCreds();
  if (!creds.username || !creds.password) return { success: false, error: 'Credenciais IG em falta' };

  var safeMsg = message.replace(/"/g, '\\"');
  var code = `
import json
from instagrapi import Client
cl = Client()
try:
    cl.login("${creds.username}", "${creds.password}")
    result = cl.direct_send("${safeMsg}", user_ids=[int("${recipientUserId}")])
    print(json.dumps({"success": True, "messageId": str(result)}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

  return runInstagrapi(code);
}

// === SEND DM BY USERNAME ===
export async function igSendDMByUsername(username: string, message: string) {
  var creds = getIGCreds();
  if (!creds.username || !creds.password) return { success: false, error: 'Credenciais IG em falta' };

  var safeMsg = message.replace(/"/g, '\\"');
  var code = `
import json
from instagrapi import Client
cl = Client()
try:
    cl.login("${creds.username}", "${creds.password}")
    user_id = cl.user_id_from_username("${username}")
    result = cl.direct_send("${safeMsg}", user_ids=[user_id])
    print(json.dumps({"success": True, "userId": str(user_id), "messageId": str(result)}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

  return runInstagrapi(code);
}

// === GET INBOX (for auto-reply) ===
export async function igGetInbox(limit?: number) {
  var creds = getIGCreds();
  if (!creds.username || !creds.password) return { success: false, error: 'Credenciais IG em falta' };

  var code = `
import json
from instagrapi import Client
cl = Client()
try:
    cl.login("${creds.username}", "${creds.password}")
    threads = cl.direct_threads(amount=${limit || 20})
    result = []
    for t in threads:
        last_msg = ""
        if t.messages:
            last_msg = t.messages[0].text or ""
        result.append({"threadId": str(t.id), "users": [{"username": u.username, "userId": str(u.pk), "fullName": u.full_name} for u in t.users], "lastMessage": last_msg, "unread": t.unread_count, "threadType": t.thread_type})
    print(json.dumps({"success": True, "threads": result}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

  return runInstagrapi(code);
}

// === GET IG USER STATS (analytics) ===
export async function igGetUserStats() {
  var creds = getIGCreds();
  if (!creds.username || !creds.password) return { success: false, error: 'Credenciais IG em falta' };

  var code = `
import json
from instagrapi import Client
cl = Client()
try:
    cl.login("${creds.username}", "${creds.password}")
    user = cl.user_info(cl.user_id_from_username("${creds.username}"))
    print(json.dumps({"success": True, "followers": user.follower_count, "following": user.following_count, "posts": user.media_count, "bio": user.biography, "isPrivate": user.is_private, "fullName": user.full_name, "userId": str(user.pk)}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

  return runInstagrapi(code);
}

// === GET FOLLOWERS LIST ===
export async function igGetFollowers(amount?: number) {
  var creds = getIGCreds();
  if (!creds.username || !creds.password) return { success: false, error: 'Credenciais IG em falta' };

  var code = `
import json
from instagrapi import Client
cl = Client()
try:
    cl.login("${creds.username}", "${creds.password}")
    followers = cl.user_followers(cl.user_id_from_username("${creds.username}"), amount=${amount || 50})
    result = []
    for uid, u in followers.items():
        result.append({"userId": str(uid), "username": u.username, "fullName": u.full_name, "followers": u.follower_count, "following": u.following_count, "bio": (u.biography or "")[:200], "isPrivate": u.is_private, "isVerified": u.is_verified, "profilePicUrl": u.profile_pic_url or ""})
    print(json.dumps({"success": True, "followers": result}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

  return runInstagrapi(code);
}
