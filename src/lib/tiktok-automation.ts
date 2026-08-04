// ============================================================
//  Aura SOCIAL AUTOMATION v4 — Instagram + Facebook
//  Trending, content generation, profile scraping, competitor monitoring
//  Hashtag research, auto-post cycles para IG+FB
//  TikTok aliases mantidos para compatibilidade
// ============================================================

// SOCIAVAULT_KEY read from process.env (no longer exported from config)
import { generateContent } from './ai';
import { SCRAPING_BEE_KEY } from './config';
import { sbGetIGProfile } from './external-apis';
import { db } from './db';

// === IG/FB TRENDING ===

export async function getIGFBTrending(options?: { platform?: string; niche?: string; limit?: number; region?: string }) {
  var platform = options?.platform || 'instagram';
  var niche = options?.niche || 'general';
  var limit = options?.limit || 20;
  var region = options?.region || 'AO';

  var results: any[] = [];
  var source = 'none';

  // Try Sociavault
  var SOCIAVAULT_KEY = process.env.SOCIAVAULT_KEY || '';
  if (SOCIAVAULT_KEY) {
    try {
      var svRes = await fetch('https://api.sociavault.com/v1/trending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SOCIAVAULT_KEY },
        body: JSON.stringify({ platform: platform, niche: niche, limit: limit, region: region }),
      });
      if (svRes.ok) {
        var svData = await svRes.json();
        if (svData?.items) { results = svData.items; source = 'sociavault'; }
      }
    } catch (e: any) { console.error('[social-automation] Sociavault error:', e.message); }
  }

  // HikerAPI fallback removed — TODO: replace with Zernio or ScrapingBee

  // Fallback: AI-generated trending topics
  if (results.length === 0) {
    try {
      var aiResult = await generateContent('Gera 10 topicos em tendencia para ' + platform + ' no nicho "' + niche + '" em Angola. Responde APENAS com JSON array de strings.');
      var match = aiResult.match(/\[[\s\S]*\]/);
      if (match) {
        var parsed = JSON.parse(match[0]);
        results = (Array.isArray(parsed) ? parsed : []).map(function(t: any) { return { topic: String(t), type: 'ai_suggestion', platform: platform }; });
        source = 'ai_generated';
      }
    } catch (e: any) { console.error('[social-automation] AI trending error:', e.message); }
  }

  // Save trend alert
  if (results.length > 0) {
    try {
      await db.trendAlert.create({
        data: { platform: platform, keyword: niche, data: JSON.stringify(results.slice(0, 5)) },
      });
    } catch (e: any) { /* ignore db errors */ }
  }

  return { success: true, trending: results, source: source, count: results.length, timestamp: new Date().toISOString() };
}

// === AUTO-GENERATE SOCIAL CONTENT ===

export async function autoGenerateSocialContent(options?: { platform?: string; niche?: string; style?: string; count?: number; schedule?: boolean }) {
  var platform = options?.platform || 'instagram';
  var niche = options?.niche || 'marketing digital';
  var style = options?.style || 'engaging e criativo';
  var count = options?.count || 1;
  var shouldSchedule = options?.schedule || false;

  // Get trending for context
  var trending = await getIGFBTrending({ platform: platform, niche: niche, limit: 3 });
  var trendContext = '';
  if (trending.trending?.length > 0) {
    trendContext = 'Topicos em tendencia: ' + trending.trending.slice(0, 3).map(function(t: any) { return t.topic || t.username || ''; }).join(', ');
  }

  var pieces: any[] = [];
  for (var i = 0; i < count; i++) {
    var prompt = 'Es um expert em ' + platform + ' para a agencia Mwango Brain (Angola). ' +
      'Niche: ' + niche + '. Estilo: ' + style + '. ' + trendContext + '\n\n' +
      'Gera um post ' + platform + ' com:\n' +
      '1. Legenda envolvente (1-3 paragrafos, com emojis moderados)\n' +
      '2. 15-25 hashtags relevantes (mix Angola + global)\n' +
      '3. Tipo de conteudo (carousel, reel, story, single image)\n' +
      '4. Call-to-action claro\n\n' +
      'Responde em JSON: {"caption": "...", "hashtags": ["#..."], "contentType": "...", "cta": "..."}';

    var generated = await generateContent(prompt);
    var parsed: any = {};
    try {
      var jsonMatch = generated.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else parsed = { caption: generated, hashtags: [], contentType: 'carousel', cta: 'Segue para mais!' };
    } catch (e) {
      parsed = { caption: generated, hashtags: [], contentType: 'carousel', cta: 'Segue para mais!' };
    }

    var hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
    var hashtagsStr = hashtags.length > 0 ? hashtags.join(' ') : null;

    // Save as draft in Prisma
    var post = await db.contentPost.create({
      data: {
        platform: platform,
        caption: parsed.caption || generated,
        hashtags: hashtagsStr,
        mediaType: parsed.contentType || null,
        status: shouldSchedule ? 'scheduled' : 'draft',
      },
    });

    pieces.push({
      id: post.id,
      caption: parsed.caption || generated,
      hashtags: hashtags,
      contentType: parsed.contentType,
      cta: parsed.cta,
      platform: platform,
      status: post.status,
    });
  }

  return { success: true, pieces: pieces, count: pieces.length };
}

// === SCRAPE IG PROFILE ===

export async function scrapeIGProfile(username: string) {
  if (!SCRAPING_BEE_KEY) return { success: false, error: 'SCRAPING_BEE_API_KEY nao configurada', username: username };
  return await sbGetIGProfile(username);
}

// === MONITOR IG COMPETITORS ===

export async function monitorIGCompetitors(competitors: string[], options?: { depth?: string }) {
  var results: any[] = [];
  var depth = options?.depth || 'basic';

  for (var i = 0; i < competitors.length; i++) {
    var profile: any = await scrapeIGProfile(competitors[i]);
    var analysis: any = {
      username: competitors[i],
      followers: profile.followers || 0,
      following: profile.following || 0,
      postsCount: profile.postsCount || 0,
      isVerified: profile.isVerified || false,
    };

    if (depth === 'full' && profile.recentPosts) {
      var totalLikes = 0;
      var totalComments = 0;
      for (var j = 0; j < profile.recentPosts.length; j++) {
        totalLikes += profile.recentPosts[j].like_count || 0;
        totalComments += profile.recentPosts[j].comment_count || 0;
      }
      var n = profile.recentPosts.length;
      analysis.avgLikes = Math.round(totalLikes / n);
      analysis.avgComments = Math.round(totalComments / n);
      analysis.engagementRate = analysis.followers > 0 ? ((totalLikes + totalComments) / (analysis.followers * n) * 100).toFixed(2) + '%' : 'N/A';
    }

    results.push(analysis);
    if (i < competitors.length - 1) await new Promise(function(r) { setTimeout(r, 2000); });
  }

  return { success: true, competitors: results, count: results.length, timestamp: new Date().toISOString() };
}

// === RESEARCH IG HASHTAGS ===

export async function researchIGHashtags(topic: string, options?: { count?: number; longTail?: boolean }) {
  var count = options?.count || 25;

  var prompt = 'Es um expert em hashtags de Instagram. Topico: "' + topic + '". ' +
    'Gera ' + count + ' hashtags optimizadas. ' +
    'Inclui hashtags em portugues (Angola) e ingles. ' +
    'Mix de alto volume e long-tail. ' +
    'Responde APENAS com JSON array de strings: ["#branding", "#angola"]';

  var aiResult = await generateContent(prompt);
  var hashtags: string[] = [];
  try {
    var match = aiResult.match(/\[[\s\S]*\]/);
    if (match) hashtags = JSON.parse(match[0]);
  } catch (e) { /* fallback */ }

  // Fallback: generate basic
  if (hashtags.length === 0) {
    var words = topic.split(/\s+/);
    for (var w = 0; w < words.length; w++) {
      hashtags.push('#' + words[w].toLowerCase());
      hashtags.push('#' + words[w].toLowerCase() + 'angola');
    }
  }

  return { success: true, topic: topic, hashtags: hashtags.slice(0, count), count: hashtags.length };
}

// === FULL AUTO-POST CYCLE ===

export async function igAutoCycle(options?: { platform?: string; niche?: string; autoPost?: boolean }) {
  var platform = options?.platform || 'instagram';
  var niche = options?.niche || 'marketing digital';
  var cycleId = 'cycle_' + Date.now();

  // Step 1: Trending
  var trending = await getIGFBTrending({ platform: platform, niche: niche, limit: 5 });

  // Step 2: Generate content
  var content = await autoGenerateSocialContent({ platform: platform, niche: niche, count: 1, style: 'engaging' });
  if (!content.success || !content.pieces?.length) {
    return { success: false, cycleId: cycleId, error: 'Content generation failed', step: 'generate' };
  }

  // Step 3: Hashtags
  var hashtags = await researchIGHashtags(niche, { count: 20 });
  var finalHashtags = hashtags.hashtags?.length > 0 ? hashtags.hashtags : content.pieces[0].hashtags || [];

  // Step 4: Log
  await db.automationLog.create({
    data: {
      type: 'auto_cycle',
      action: 'auto_cycle',
      platform: platform,
      result: JSON.stringify({ cycleId: cycleId, niche: niche, trendingCount: trending.count || 0, contentId: content.pieces[0].id, hashtagCount: finalHashtags.length }),
    },
  });

  return {
    success: true,
    cycleId: cycleId,
    platform: platform,
    content: content.pieces[0],
    hashtags: finalHashtags,
    trendingCount: trending.count || 0,
    status: 'ready',
  };
}

// === TIKTOK ALIASES (compatibilidade) ===

export var getTikTokTrending = getIGFBTrending;
export var autoGenerateTikTokContent = autoGenerateSocialContent;
export var scrapeTikTokProfile = scrapeIGProfile;
export var monitorTikTokCompetitors = monitorIGCompetitors;
export var researchTikTokHashtags = researchIGHashtags;
export var tikTokAutoCycle = igAutoCycle;
