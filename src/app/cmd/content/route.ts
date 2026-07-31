// ============================================================
//  JARVIS CONTENT API — gerador de conteudo com IA
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { UPLOADPOST_KEY } from '@/lib/config';
import { requireAuth } from '@/lib/auth';
import { generateContent } from '@/lib/ai';

export var maxDuration = 60;

// ── helpers ────────────────────────────────────────────────

function extractFromAI(text: string) {
  var caption = text;
  var hashtags: string[] = [];
  var suggestedMedia = '';

  // Try to parse structured JSON if the AI returns it
  try {
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      var parsed = JSON.parse(jsonMatch[0]);
      if (parsed.caption) caption = parsed.caption;
      if (parsed.hashtags) hashtags = parsed.hashtags;
      if (parsed.suggestedMedia) suggestedMedia = parsed.suggestedMedia;
    }
  } catch (e) { /* not JSON, use raw text as caption */ }

  // Extract hashtags from text if not found in JSON
  if (hashtags.length === 0) {
    var hashMatches = caption.match(/#[\w]+/g);
    if (hashMatches) {
      hashtags = hashMatches;
      caption = caption.replace(/#[\w]+/g, '').trim();
    }
  }

  // Try to extract media suggestion from text
  if (!suggestedMedia) {
    var mediaMatch = text.match(/suggestedMedia[:\s]*([^.\n]+)/i) || text.match(/media suggestion[:\s]*([^.\n]+)/i);
    if (mediaMatch) suggestedMedia = mediaMatch[1].trim();
  }

  return { caption, hashtags, suggestedMedia };
}

// ── actions ────────────────────────────────────────────────

async function generatePost(platform: string, topic: string, tone: string, language: string, includeHashtags: boolean, maxLength: number) {
  var platformNote = '';
  if (platform === 'instagram') platformNote = 'Para Instagram: usa hashtags relevantes, emojis moderados, legenda envolvente.';
  else if (platform === 'facebook') platformNote = 'Para Facebook: texto mais longo, tom conversacional.';
  else if (platform === 'tiktok') platformNote = 'Para TikTok: legenda curta e impactante, trending hashtags.';
  else if (platform === 'linkedin') platformNote = 'Para LinkedIn: tom profissional, insights de industria.';
  else if (platform === 'twitter') platformNote = 'Para Twitter/X: texto conciso, max 280 caracteres.';
  else platformNote = 'Para ' + platform + '.';

  var topicPrompt = topic
    ? 'Cria um post sobre: ' + topic
    : 'Sugere um post criativo e relevante para a Mwango Brain (agencia criativa angolana). Pode ser sobre: dicas de branding, design, marketing digital, ou cultura angolana.';

  var toneNote = tone ? ' Toma: ' + tone + '.' : '';
  var langNote = language && language !== 'pt' ? ' Idioma: ' + language + '.' : '';
  var hashtagNote = includeHashtags !== false ? ' Inclui hashtags relevantes no final.' : ' Nao inclui hashtags.';
  var lengthNote = maxLength ? ' Maximo ' + maxLength + ' caracteres.' : '';

  var userPrompt = platformNote + '\n\n' + topicPrompt + toneNote + langNote + hashtagNote + lengthNote + '\n\nResponde no seguinte formato JSON:\n{"caption": "...", "hashtags": ["#...", "#..."], "suggestedMedia": "descricao da imagem ou video sugerida"}';

  var aiResponse = await generateContent(userPrompt);
  var extracted = extractFromAI(aiResponse);

  // Save as draft in Prisma
  var post = await db.contentPost.create({
    data: {
      platform: platform,
      caption: extracted.caption,
      mediaType: extracted.suggestedMedia ? 'suggested' : null,
      status: 'draft',
    },
  });

  return {
    id: post.id,
    caption: extracted.caption,
    hashtags: extracted.hashtags,
    suggestedMedia: extracted.suggestedMedia,
    platform,
  };
}

async function generateHashtags(topic: string, platform: string, count: number) {
  var num = count || 15;
  var userPrompt = 'Gera ' + num + ' hashtags relevantes e em tendencia para o tema: "' + topic + '"' +
    ' para a plataforma ' + platform + '.' +
    ' Inclui hashtags em portugues angolano e em ingles. ' +
    ' Mistura hashtags populares com nicho. ' +
    ' Responde APENAS com uma lista JSON de strings, ex: ["#branding", "#angola"]';

  var aiResponse = await generateContent(userPrompt);
  try {
    var jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) { /* fallback */ }

  // Fallback: extract from text
  var matches = aiResponse.match(/#[\w]+/g);
  return matches || [];
}

async function improveCaption(caption: string, platform: string, goal: string) {
  var goalNote = '';
  if (goal === 'engagement') goalNote = 'O objectivo e maximizar o engajamento (likes, comentarios, partilhas).';
  else if (goal === 'brand_awareness') goalNote = 'O objectivo e aumentar o reconhecimento da marca Mwango Brain.';
  else if (goal === 'conversion') goalNote = 'O objectivo e converter leitores em clientes (call-to-action claro).';
  else goalNote = 'O objectivo geral e melhorar a qualidade do post.';

  var userPrompt = 'Melhora esta legenda para ' + platform + '.\n\nLegenda original:\n"' + caption + '"\n\n' + goalNote +
    ' Mantem o tom da Mwango Brain (criativo, profissional, angolano).\n' +
    ' Responde APENAS com a legenda melhorada, sem explicacoes.';

  var improved = await generateContent(userPrompt);
  // Clean up any quotes wrapping
  improved = improved.replace(/^['"]|['"]$/g, '').trim();
  return improved;
}

async function listDrafts() {
  var drafts = await db.contentPost.findMany({
    where: { status: 'draft' },
    orderBy: { createdAt: 'desc' },
  });
  return drafts;
}

async function updateDraft(id: string, data: any) {
  var updateData: any = {};
  if (data.caption !== undefined) updateData.caption = data.caption;
  if (data.mediaUrl !== undefined) updateData.mediaUrl = data.mediaUrl;
  if (data.platform !== undefined) updateData.platform = data.platform;
  if (data.status !== undefined) updateData.status = data.status;

  var post = await db.contentPost.update({ where: { id }, data: updateData });
  return post;
}

async function deleteDraft(id: string) {
  await db.contentPost.delete({ where: { id } });
  return { success: true };
}

async function publishDraft(id: string, platforms: string[]) {
 var post = await db.contentPost.findUnique({ where: { id } });
  if (!post) throw new Error('Rascunho nao encontrado');

  var targetPlatforms = platforms || (post.platform ? [post.platform] : ['instagram']);
  var results: any[] = [];
  var uploadPostIds: string[] = [];

  for (var i = 0; i < targetPlatforms.length; i++) {
    var plat = targetPlatforms[i];
    try {
      var res = await fetch('https://api.upload-post.com/v1/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + UPLOADPOST_KEY,
        },
        body: JSON.stringify({
          platform: plat,
          caption: post.caption,
          mediaUrl: post.mediaUrl || undefined,
        }),
      });
      var json = await res.json();
      results.push({ platform: plat, success: res.ok, data: json });
      if (json.id || json.request_id) uploadPostIds.push(json.id || json.request_id);
    } catch (e: any) {
      results.push({ platform: plat, success: false, error: e.message });
    }
  }

  // Update post status
  var updatedPost = await db.contentPost.update({
    where: { id },
    data: { status: 'published', publishedAt: new Date() },
  });

  // Create ScheduledPost records for tracking multi-platform
  if (targetPlatforms.length > 1) {
    for (var j = 0; j < targetPlatforms.length; j++) {
      await db.scheduledPost.create({
        data: {
          contentPostId: id,
          platforms: targetPlatforms[j],
          scheduledFor: new Date(),
          status: 'published',
          uploadPostId: uploadPostIds[j] || null,
        },
      });
    }
  }

  return {
    success: true,
    postId: id,
    platforms: targetPlatforms,
    results,
    post: updatedPost,
  };
}

// ── main handler ───────────────────────────────────────────

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;
  try {
    var body = await request.json().catch(function () { return {}; });
    var action = body.action || '';

    if (action === 'generate_post') {
      var result = await generatePost(
        body.platform || 'instagram',
        body.topic || '',
        body.tone || '',
        body.language || 'pt',
        body.includeHashtags !== false,
        body.maxLength || 0,
      );
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'generate_hashtags') {
      if (!body.topic) return NextResponse.json({ success: false, error: 'Topico necessario' });
      var tags = await generateHashtags(body.topic, body.platform || 'instagram', body.count || 15);
      return NextResponse.json({ success: true, data: tags });
    }

    if (action === 'improve_caption') {
      if (!body.caption) return NextResponse.json({ success: false, error: 'Legenda necessaria' });
      var improved = await improveCaption(body.caption, body.platform || 'instagram', body.goal || 'engagement');
      return NextResponse.json({ success: true, data: { caption: improved } });
    }

    if (action === 'list_drafts') {
      var drafts = await listDrafts();
      return NextResponse.json({ success: true, data: drafts });
    }

    if (action === 'update_draft') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      var updated = await updateDraft(body.id, body);
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'delete_draft') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      var deleted = await deleteDraft(body.id);
      return NextResponse.json(deleted);
    }

    if (action === 'publish_draft') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      var pubResult = await publishDraft(body.id, body.platforms || []);
      return NextResponse.json(pubResult);
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
