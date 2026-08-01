// ============================================================
//  Aura TIKTOK AUTOMATION ENGINE
//  - Descoberta de tendencias (Sociavault + HikerAPI)
//  - Geracao automatica de conteudo TikTok
//  - Agendamento e publicacao via Upload-Post
//  - Scraping de comentarios e perfis
// ============================================================

import { SOCIAVAULT_KEY, HIKERAPI_KEY, UPLOADPOST_KEY, IG_USERNAME } from './config';
import { generateContent } from './ai';
import { db } from './db';

// === TIKTOK TRENDING DISCOVERY ===
// Use Sociavault to discover trending topics and hashtags

export async function getTikTokTrending(): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!SOCIAVAULT_KEY) return { success: false, error: 'SOCIAVAULT_API_KEY nao configurada' };

  try {
    // Sociavault: scrape TikTok trending
    var res = await fetch('https://api.sociavault.com/v1/trending', {
      method: 'POST',
      headers: { 'X-API-Key': SOCIAVAULT_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'tiktok', region: 'ao' }),
    });

    if (!res.ok) {
      // Fallback: use TikTok discovery feed via HikerAPI
      return getTikTokTrendingFallback();
    }

    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return getTikTokTrendingFallback();
  }
}

async function getTikTokTrendingFallback(): Promise<{ success: boolean; data?: any; error?: string }> {
  // Use HikerAPI to get TikTok user data as trending proxy
  if (!HIKERAPI_KEY) return { success: false, error: 'Sem APIs disponiveis para tendencias TikTok' };

  try {
    // Scrape the Mwango Brain TikTok profile for inspiration
    var res = await fetch('https://api.hikerapi.com/v1/user/by/username?username=' + (IG_USERNAME || 'mwangobrain'), {
      headers: { 'x-access-key': HIKERAPI_KEY },
    });

    if (!res.ok) return { success: false, error: 'HikerAPI erro ' + res.status };

    var profileData = await res.json();

    // Generate trending topics from AI based on agency niche
    var trendingTopics = [
      'branding angolano', 'design grafico', 'marketing digital Angola',
      'identidade visual', 'redes sociais Angola', 'conteudo criativo',
      'tendencias design 2026', 'startup angolana', 'empreendedorismo AO',
      'tips marketing', 'cultura angolana', 'logotipos',
    ];

    return {
      success: true,
      data: {
        source: 'ai_generated_for_mwango_brain',
        topics: trendingTopics,
        profileFollowers: profileData.follower_count || 0,
        profilePosts: profileData.media_count || 0,
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === AUTO-GENERATE TIKTOK CONTENT ===
// Creates TikTok-optimized content (short, punchy, trending hashtags)

export async function autoGenerateTikTokContent(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // 1. Get trending topics
    var trendRes = await getTikTokTrending();
    var topic = 'marketing digital e design para agencias criativas em Angola';

    if (trendRes.success && trendRes.data?.topics) {
      // Pick a random trending topic
      var topics: string[] = trendRes.data.topics;
      topic = topics[Math.floor(Math.random() * topics.length)];
    }

    // 2. Check if we already have a pending TikTok post today
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var existingToday = await db.contentPost.count({
      where: {
        platform: 'tiktok',
        status: { in: ['draft', 'scheduled'] },
        createdAt: { gte: today },
      },
    });

    if (existingToday >= 3) {
      return { success: true, data: { skipped: true, reason: 'Ja existem 3 posts TikTok pendentes hoje' } };
    }

    // 3. Generate TikTok-optimized content
    var prompt =
      'Cria um post TIKTOK sobre: "' + topic + '"' +
      '\nRegras OBRIGATORIAS:' +
      '\n- Legenda CURTA e impactante (max 150 caracteres)' +
      '\n- Primeira linha tem que prender a atencao (hook)' +
      '\n- Inclui 5-8 hashtags TikTok relevantes (mix PT-AO e EN)' +
      '\n- Tom: criativo, jovem, angolano' +
      '\n- Para a agencia Mwango Brain' +
      '\n- Nao uses emojis excessivos' +
      '\n\nResponde em JSON: {"caption": "...", "hashtags": ["#...", "#..."], "hook": "..."}';

    var aiResponse = await generateContent(prompt, 400);

    // 4. Parse AI response
    var caption = '';
    var hashtags: string[] = [];
    var hook = '';

    try {
      var jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        var parsed = JSON.parse(jsonMatch[0]);
        caption = parsed.caption || aiResponse;
        hashtags = parsed.hashtags || [];
        hook = parsed.hook || '';
      }
    } catch (e) {
      caption = aiResponse;
    }

    // Extract hashtags if not parsed
    if (hashtags.length === 0) {
      var hashMatches = aiResponse.match(/#[\w]+/g);
      if (hashMatches) {
        hashtags = hashMatches;
        caption = caption.replace(/#[\w]+/g, '').trim();
      }
    }

    var fullCaption = caption + (hashtags.length > 0 ? '\n' + hashtags.join(' ') : '');

    // 5. Save as draft
    var post = await db.contentPost.create({
      data: {
        platform: 'tiktok',
        caption: fullCaption,
        hashtags: hashtags.join(' '),
        status: 'draft',
        mediaType: 'suggested',
      },
    });

    // 6. Auto-schedule for next optimal time (2-4 hours from now)
    var scheduleDate = new Date();
    scheduleDate.setHours(scheduleDate.getHours() + 2 + Math.floor(Math.random() * 2));
    scheduleDate.setMinutes(0, 0, 0);

    await db.scheduledPost.create({
      data: {
        contentPostId: post.id,
        platforms: 'tiktok',
        scheduledFor: scheduleDate,
        status: 'pending',
      },
    });

    return {
      success: true,
      data: {
        postId: post.id,
        caption: fullCaption.slice(0, 100),
        hashtags: hashtags,
        hook: hook,
        scheduledFor: scheduleDate.toISOString(),
        topic: topic,
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === TIKTOK PROFILE SCRAPING ===
// Scrape any TikTok profile for competitive analysis

export async function scrapeTikTokProfile(username: string): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!HIKERAPI_KEY) return { success: false, error: 'HIKERAPI_KEY nao configurada' };

  try {
    var res = await fetch('https://api.hikerapi.com/v1/user/by/username?username=' + encodeURIComponent(username), {
      headers: { 'x-access-key': HIKERAPI_KEY },
    });

    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };

    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === TIKTOK COMPETITOR MONITORING ===
// Monitor competitor TikToks and generate response content

export async function monitorTikTokCompetitors(competitors: string[]): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!HIKERAPI_KEY) return { success: false, error: 'HIKERAPI_KEY nao configurada' };

  var results: any[] = [];

  for (var i = 0; i < competitors.length; i++) {
    var username = competitors[i];
    try {
      var profileRes = await scrapeTikTokProfile(username);
      if (profileRes.success && profileRes.data) {
        var d = profileRes.data;
        results.push({
          username: username,
          followers: d.follower_count || 0,
          following: d.following_count || 0,
          posts: d.media_count || 0,
          engagement: d.engagement_rate || 0,
          bio: (d.biography || '').slice(0, 200),
          verified: d.is_verified || false,
        });
      }
    } catch (e: any) {
      results.push({ username, error: e.message });
    }
  }

  return { success: true, data: results };
}

// === TIKTOK HASHTAG RESEARCH ===
// Find best hashtags for TikTok content

export async function researchTikTokHashtags(topic: string): Promise<{ success: boolean; data?: string[]; error?: string }> {
  try {
    var prompt =
      'Pesquisa 20 hashtags TIKTOK em tendencia para o tema: "' + topic + '"' +
      '\nRegras:' +
      '\n- Mistura hashtags grandes (1M+ views) com medias (100K-1M) e pequenas (10K-100K)' +
      '\n- Inclui hashtags em portugues angolano e ingles' +
      '\n- Prioritiza hashtags que funcionam no mercado africano/angolano' +
      '\n\nResponde APENAS com JSON array: ["#hashtag1", "#hashtag2", ...]';

    var aiResponse = await generateContent(prompt, 300);

    try {
      var jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) return { success: true, data: JSON.parse(jsonMatch[0]) };
    } catch (e) { /* fallback */ }

    var matches = aiResponse.match(/#[\w]+/g);
    return { success: true, data: matches || [] };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === FULL TIKTOK AUTO-POST CYCLE ===
// 1. Discover trending topics
// 2. Generate content
// 3. Schedule for optimal time
// 4. Track in automation log

export async function tikTokAutoCycle(): Promise<any> {
  var results: any = {
    trending: null,
    contentGenerated: null,
    scheduled: false,
    errors: [] as string[],
  };

  try {
    // Step 1: Get trending
    var trendRes = await getTikTokTrending();
    results.trending = trendRes.success ? 'ok' : 'fail: ' + (trendRes.error || '');

    // Step 2: Generate content
    var genRes = await autoGenerateTikTokContent();
    if (genRes.success) {
      results.contentGenerated = genRes.data;
      results.scheduled = !!genRes.data?.scheduledFor;

      // Step 3: Log
      if (genRes.data?.postId) {
        await db.automationLog.create({
          data: {
            type: 'tiktok_auto',
            action: 'auto_generate_and_schedule',
            platform: 'tiktok',
            targetId: genRes.data.postId,
            targetName: (genRes.data.caption || '').slice(0, 50),
            status: 'success',
            result: 'Conteudo gerado e agendado para ' + (genRes.data.scheduledFor || '?'),
            completedAt: new Date(),
          },
        });

        // Step 4: Notification
        await db.notification.create({
          data: {
            type: 'content_generated',
            title: 'TikTok: conteudo gerado automaticamente',
            message: (genRes.data.caption || '').slice(0, 100),
            platform: 'tiktok',
            sourceId: genRes.data.postId,
          },
        });
      }
    } else {
      results.errors.push('Geracao: ' + (genRes.error || 'falhou'));
    }
  } catch (e: any) {
    results.errors.push(e.message);
  }

  return results;
}
