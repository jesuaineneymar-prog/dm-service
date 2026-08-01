// ============================================================
//  Aura CRON — Comment-to-DM Automation
//  - Monitora comentarios em posts recentes (IG + FB)
//  - Quem comenta, recebe DM automatico da Aura
//  - Usa Zernio para enviar DMs (dentro da janela 24h)
//  - Registra interacoes para nao enviar DMs duplicados
//  - ManyChat como engine secundario se disponivel
// ============================================================

import { NextResponse } from 'next/server';
import { db, ensureDatabase } from '@/lib/db';
import { zernioListAccounts, zernioSendOutboundDM } from '@/lib/zernio';
import { hikerGetComments, hikerGetUser } from '@/lib/external-apis';
import { CRON_SECRET, HIKERAPI_KEY, MANYCHAT_KEY, OR_KEY, OR_URL, OR_FALLBACK_MODEL, IG_USERNAME } from '@/lib/config';

export var maxDuration = 120;

var IG_ACCOUNT_ID = '6a6a51f5df17280d93d8a106';
var FB_ACCOUNT_ID = '6a6a51bcdf17280d93d89e06';

// Gerar mensagem personalizada de resposta a comentario
async function generateCommentReplyMessage(commenterUsername: string, commentText: string, platform: string): Promise<string> {
  if (!OR_KEY) {
    return 'Ola @' + commenterUsername + '! Vi teu comentario e achei massa! Tudo bem?';
  }
  try {
    var res = await fetch(OR_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + OR_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OR_FALLBACK_MODEL,
        messages: [{
          role: 'system',
          content: 'Es a Aura, assistente da agencia Mwango Brain em Angola. Alguem comentou num post e tu vais iniciar uma conversa por DM. Sê amigavel e natural, maximo 2 frases. Nao menciones que es IA. Responde em portugues.',
        }, {
          role: 'user',
          content: 'O utilizador @' + commenterUsername + ' comentou: "' + commentText + '" no ' + platform + '. Envia uma mensagem curta e amigavel para iniciar conversa por DM.',
        }],
        max_tokens: 100,
      }),
    });
    if (!res.ok) return 'Ola @' + commenterUsername + '! Vi teu comentario, obrigado pelo apoio!';
    var data = await res.json();
    return data.choices?.[0]?.message?.content || 'Ola @' + commenterUsername + '! Vi teu comentario, obrigado pelo apoio!';
  } catch (e: any) {
    return 'Ola @' + commenterUsername + '! Vi teu comentario, obrigado pelo apoio!';
  }
}

async function runCommentToDM(): Promise<any> {
  var results: any = {
    postsChecked: 0,
    commentsProcessed: 0,
    dmsSent: 0,
    duplicatesSkipped: 0,
    errors: [] as string[],
    details: [] as any[],
  };

  try {
    await ensureDatabase();

    if (!HIKERAPI_KEY) {
      results.errors.push('HIKERAPI_KEY nao configurada — impossivel buscar comentarios');
      return results;
    }

    // 1. Buscar posts recentes do nosso Instagram
    // Usamos o HikerAPI para buscar o usuario e seus posts recentes
    var selfUser = IG_USERNAME || 'jarvis_v3';
    var selfResult = await hikerGetUser(HIKERAPI_KEY, selfUser);
    if (!selfResult.success) {
      results.errors.push('Nao consegui buscar usuario @' + selfUser + ': ' + (selfResult.error || ''));
      return results;
    }
    var selfData = selfResult.data;
    var selfPk = String(selfData.pk || selfData.id || '');
    if (!selfPk) {
      results.errors.push('Nao consegui extrair ID do usuario @' + selfUser);
      return results;
    }

    // 2. Buscar comentarios dos ultimos posts
    // HikerAPI: hikerGetComments(mediaId, count)
    // Precisamos dos mediaIds dos posts recentes
    // Vamos usar os posts do feed
    var postsData = selfData?.medias || selfData?.media?.data || [];
    if (!Array.isArray(postsData) || postsData.length === 0) {
      // Se nao tem media data, tentar buscar posts separadamente
      results.errors.push('Nenhum post encontrado para monitorizar comentarios');
      // Tentar com mediaIds passados manualmente se existirem no DB
      var recentPosts = await db.contentPost.findMany({
        where: { platform: 'instagram', publishedAt: { not: null } },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: { id: true, caption: true, publishedAt: true },
      });
      if (recentPosts.length === 0) {
        results.errors.push('Nenhum post recente no DB para buscar comentarios');
        return results;
      }
      // Usar o id do ContentPost como referencia (o mediaId real vem de outra fonte)
      postsData = recentPosts.map(function(p) { return { id: p.id, caption: p.caption }; });
    }

    // Processar os ultimos 5 posts
    var postsToCheck = postsData.slice(0, 5);

    for (var pi = 0; pi < postsToCheck.length; pi++) {
      var post = postsToCheck[pi];
      var mediaId = String(post.id || post.pk || post.media_id || '');
      if (!mediaId) continue;

      results.postsChecked++;

      try {
        // 3. Buscar comentarios deste post
        var commRes = await hikerGetComments(HIKERAPI_KEY, mediaId, 20);
        if (!commRes.success) {
          results.errors.push('Post ' + mediaId + ': erro ao buscar comentarios - ' + (commRes.error || ''));
          continue;
        }

        var commentsData = commRes.data;
        var comments: any[] = [];
        if (Array.isArray(commentsData)) comments = commentsData;
        else if (commentsData?.comments) comments = commentsData.comments;
        else if (commentsData?.data) comments = Array.isArray(commentsData.data) ? commentsData.data : [];

        for (var ci = 0; ci < comments.length; ci++) {
          var comment = comments[ci];
          var commenterPk = String(comment.user?.pk || comment.user?.id || comment.user_id || '');
          var commenterUsername = comment.user?.username || comment.username || '';
          var commentText = comment.text || comment.content || '';
          var commentId = String(comment.pk || comment.id || comment.comment_id || '');

          if (!commenterPk || !commenterUsername) continue;
          // Ignorar comentarios proprios
          if (commenterPk === selfPk || commenterUsername.toLowerCase() === selfUser.toLowerCase()) continue;

          results.commentsProcessed++;

          // 4. Verificar se ja enviamos DM para este utilizador por este comentario
          var existingDm = await db.automationLog.findFirst({
            where: {
              type: 'comment_to_dm',
              action: 'sent_dm',
              platform: 'instagram',
              targetName: commenterUsername,
              result: { contains: commentId },
            },
          });

          if (existingDm) {
            results.duplicatesSkipped++;
            continue;
          }

          // 5. Verificar se o comentario e recente (ultimas 24h)
          var commentTimestamp = comment.created_at || comment.timestamp || comment.created_at_utc;
          if (commentTimestamp) {
            var commentDate = new Date(commentTimestamp * 1000); // Unix timestamp
            var hoursAgo = (Date.now() - commentDate.getTime()) / (1000 * 60 * 60);
            if (hoursAgo > 24) {
              results.duplicatesSkipped++;
              continue;
            }
          }

          // 6. Gerar mensagem personalizada e enviar DM
          var dmMessage = await generateCommentReplyMessage(commenterUsername, commentText, 'Instagram');

          var dmResult = await zernioSendOutboundDM({
            accountId: IG_ACCOUNT_ID,
            recipientId: commenterPk,
            message: dmMessage,
            platform: 'instagram',
            recipientUsername: commenterUsername,
          });

          if (dmResult.success) {
            results.dmsSent++;
            results.details.push({
              commenter: commenterUsername,
              comment: commentText.slice(0, 80),
              dmSent: dmMessage.slice(0, 80),
              method: dmResult.method || 'zernio',
            });

            // Registrar no CRM como prospect
            var prospect = await db.prospect.findFirst({
              where: { platform: 'instagram', username: commenterUsername },
            });
            if (!prospect) {
              prospect = await db.prospect.create({
                data: {
                  platform: 'instagram',
                  username: commenterUsername,
                  displayName: comment.user?.full_name || null,
                  status: 'contacted',
                  externalId: commenterPk,
                  lastContactedAt: new Date(),
                },
              });
            } else {
              await db.prospect.update({
                where: { id: prospect.id },
                data: { lastContactedAt: new Date(), status: 'contacted' },
              });
            }

            // Guardar mensagens
            await db.message.create({
              data: {
                prospectId: prospect.id,
                direction: 'inbound',
                content: '[comentario] ' + commentText,
                platform: 'instagram',
              },
            });
            await db.message.create({
              data: {
                prospectId: prospect.id,
                direction: 'outbound',
                content: dmMessage,
                platform: 'instagram',
              },
            });
          }

          // 7. Registrar no automation log (sucesso ou falha)
          await db.automationLog.create({
            data: {
              type: 'comment_to_dm',
              action: 'sent_dm',
              platform: 'instagram',
              targetId: commenterPk,
              targetName: commenterUsername,
              status: dmResult.success ? 'success' : 'failed',
              result: JSON.stringify({
                commentId: commentId,
                commentText: commentText.slice(0, 100),
                dmMessage: dmMessage.slice(0, 100),
                method: dmResult.method || 'zernio',
                error: dmResult.success ? undefined : dmResult.error,
              }),
              completedAt: new Date(),
            },
          });

          // Rate limit: esperar entre DMs
          if (ci < comments.length - 1) {
            await new Promise(function(r) { setTimeout(r, 3000); });
          }
        }
      } catch (e: any) {
        results.errors.push('Post ' + mediaId + ': ' + e.message);
      }
    }
  } catch (e: any) {
    results.errors.push('Erro geral: ' + e.message);
  }

  return results;
}

// GET — Vercel Cron chama automaticamente
export async function GET(request: Request) {
  var authHeader = request.headers.get('authorization') || '';
  var urlSecret = new URL(request.url).searchParams.get('secret') || '';
  var isValid = authHeader === 'Bearer ' + CRON_SECRET || urlSecret === CRON_SECRET;

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    var startTime = Date.now();
    var results = await runCommentToDM();
    var duration = Date.now() - startTime;

    // Log da execucao
    await db.automationLog.create({
      data: {
        type: 'cron_comment_to_dm',
        action: 'comment_monitoring_cycle',
        platform: 'instagram',
        status: results.errors.length === 0 ? 'success' : 'partial',
        result: JSON.stringify({
          postsChecked: results.postsChecked,
          commentsProcessed: results.commentsProcessed,
          dmsSent: results.dmsSent,
          duplicatesSkipped: results.duplicatesSkipped,
          duration: duration + 'ms',
        }),
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      cron: 'comment_to_dm',
      timestamp: new Date().toISOString(),
      duration: duration + 'ms',
      data: results,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST — acionar manualmente
export async function POST(request: Request) {
  var body = await request.json().catch(function() { return {}; });
  var secret = body.secret || '';
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  var results = await runCommentToDM();
  return NextResponse.json({ success: true, cron: 'comment_to_dm', data: results });
}