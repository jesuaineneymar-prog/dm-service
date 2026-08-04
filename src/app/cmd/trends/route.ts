// ============================================================
//  Aura TRENDS API — trending topics, hashtag research
//  Usa tiktok-automation (agora social-automation) + AI
// ============================================================

import { NextResponse } from 'next/server';
import { getIGFBTrending, researchIGHashtags } from '@/lib/tiktok-automation';
import { requireAuth } from '@/lib/auth';

export var maxDuration = 60;

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  try {
    var body = await request.json().catch(function() { return {}; });
    var action = body.action || '';

    if (action === 'get_trending') {
      var result = await getIGFBTrending({
        platform: body.platform || 'instagram',
        niche: body.niche || 'general',
        limit: body.limit || 20,
        region: body.region || 'AO',
      });
      return NextResponse.json(result);
    }

    if (action === 'research_hashtags') {
      if (!body.topic) return NextResponse.json({ success: false, error: 'Topico necessario' });
      var hashtags = await researchIGHashtags(body.topic, { count: body.count || 25, longTail: body.longTail });
      return NextResponse.json(hashtags);
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
