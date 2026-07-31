// ============================================================
//  JARVIS CRON — Publicação de Posts Agendados (a cada 10 min)
//  - Verifica ScheduledPosts cujo horário de publicação já chegou
//  - Publica via Upload-Post API (Instagram, Facebook, TikTok)
//  - Actualiza status para 'published'
//  - Regista AnalyticsEvent de publicação
//  Protegido por CRON_SECRET via Vercel Cron
// ============================================================

import { NextResponse } from 'next/server';
import { db, ensureDatabase } from '@/lib/db';

import { CRON_SECRET, UPLOADPOST_KEY } from '@/lib/config';

export var maxDuration = 120;

// Publicar posts agendados cujo horário já chegou
async function publishDuePosts(): Promise<any> {
  var results: any = { checked: 0, published: 0, errors: [] as string[] };

  var now = new Date();

  // Buscar todos os posts agendados pendentes cujo horário já passou
  var duePosts = await db.scheduledPost.findMany({
    where: {
      status: 'pending',
      scheduledFor: { lte: now },
    },
    include: { contentPost: true },
    orderBy: { scheduledFor: 'asc' },
    take: 10,
  });

  results.checked = duePosts.length;

  for (var i = 0; i < duePosts.length; i++) {
    var sp = duePosts[i];
    var content = sp.contentPost;
    var platform = sp.platforms; // 'instagram', 'facebook', 'tiktok'

    if (!content) {
      // Sem conteudo associado, marcar como falha
      await db.scheduledPost.update({
        where: { id: sp.id },
        data: { status: 'failed' },
      });
      results.errors.push(sp.id + ': sem conteudo associado');
      await db.automationLog.create({
        data: {
          type: 'cron_publish',
          action: 'publish_scheduled',
          platform: platform,
          targetId: sp.id,
          status: 'failed',
          result: 'Sem conteudo associado',
        },
      });
      continue;
    }

    try {
      // Publicar via Upload-Post API
      if (UPLOADPOST_KEY) {
        var publishPayload: any = {
          platform: platform,
          caption: content.caption || '',
        };

        // Adicionar media se existir
        if (content.mediaUrl) {
          publishPayload.mediaUrl = content.mediaUrl;
          publishPayload.mediaType = content.mediaType || 'image';
        }

        var res = await fetch('https://api.upload-post.com/v1/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Apikey ' + UPLOADPOST_KEY,
          },
          body: JSON.stringify(publishPayload),
        });

        var json = await res.json();

        if (res.ok && (json.id || json.request_id)) {
          // Sucesso na publicacao
          await db.scheduledPost.update({
            where: { id: sp.id },
            data: { status: 'published', uploadPostId: json.id || json.request_id },
          });

          // Actualizar conteudo post
          await db.contentPost.update({
            where: { id: content.id },
            data: { publishedAt: new Date(), status: 'published' },
          });

          // Registar evento de analytics
          await db.analyticsEvent.create({
            data: {
              platform: platform,
              eventType: 'post_published',
              metricValue: 1,
              metadata: JSON.stringify({
                scheduledPostId: sp.id,
                contentPostId: content.id,
                uploadPostId: json.id || json.request_id,
                caption: content.caption.slice(0, 100),
              }),
            },
          });

          // Registar no log de automacao
          await db.automationLog.create({
            data: {
              type: 'cron_publish',
              action: 'published_scheduled_post',
              platform: platform,
              targetId: sp.id,
              targetName: content.caption.slice(0, 50),
              status: 'success',
              result: 'Publicado via UploadPost — ID: ' + (json.id || json.request_id),
              completedAt: new Date(),
            },
          });

          // Criar notificacao
          await db.notification.create({
            data: {
              type: 'post_published',
              title: 'Post publicado no ' + platform,
              message: content.caption.slice(0, 100),
              platform: platform,
              sourceId: sp.id,
            },
          });

          results.published++;
        } else {
          // API retornou erro
          await db.scheduledPost.update({
            where: { id: sp.id },
            data: { status: 'failed' },
          });
          results.errors.push(sp.id + ': UploadPost erro ' + res.status);
          await db.automationLog.create({
            data: {
              type: 'cron_publish',
              action: 'publish_scheduled',
              platform: platform,
              targetId: sp.id,
              status: 'failed',
              result: 'UploadPost HTTP ' + res.status + ': ' + JSON.stringify(json).slice(0, 200),
            },
          });
        }
      } else {
        // Sem UploadPost key — marcar como "published" localmente (modo offline)
        await db.scheduledPost.update({
          where: { id: sp.id },
          data: { status: 'published' },
        });
        await db.contentPost.update({
          where: { id: content.id },
          data: { publishedAt: new Date(), status: 'published' },
        });
        await db.automationLog.create({
          data: {
            type: 'cron_publish',
            action: 'published_local_only',
            platform: platform,
            targetId: sp.id,
            targetName: content.caption.slice(0, 50),
            status: 'success',
            result: 'Publicado localmente (sem UploadPost key)',
            completedAt: new Date(),
          },
        });
        results.published++;
      }
    } catch (e: any) {
      await db.scheduledPost.update({
        where: { id: sp.id },
        data: { status: 'failed' },
      });
      results.errors.push(sp.id + ': ' + e.message);
      await db.automationLog.create({
        data: {
          type: 'cron_publish',
          action: 'publish_scheduled',
          platform: platform,
          targetId: sp.id,
          status: 'failed',
          result: e.message,
        },
      });
    }
  }

  return results;
}

// Vercel Cron chama esta rota automaticamente a cada 10 minutos
export async function GET(request: Request) {
  var authHeader = request.headers.get('authorization') || '';
  var urlSecret = new URL(request.url).searchParams.get('secret') || '';
  var isValid = authHeader === 'Bearer ' + CRON_SECRET || urlSecret === CRON_SECRET;

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized — CRON_SECRET invalido' }, { status: 401 });
  }

  try {
    await ensureDatabase();
    var startTime = Date.now();
    var publishResults = await publishDuePosts();
    var duration = Date.now() - startTime;

    await db.automationLog.create({
      data: {
        type: 'cron_publish',
        action: 'publish_cycle',
        platform: 'all',
        status: publishResults.errors.length === 0 ? 'success' : 'partial',
        result: JSON.stringify({
          checked: publishResults.checked,
          published: publishResults.published,
          duration: duration + 'ms',
        }),
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      cron: 'publish',
      timestamp: new Date().toISOString(),
      duration: duration + 'ms',
      data: publishResults,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST para acionar manualmente
export async function POST(request: Request) {
  var body = await request.json().catch(function() { return {}; });
  var secret = body.secret || '';
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  var results = await publishDuePosts();
  return NextResponse.json({ success: true, cron: 'publish', data: results });
}
