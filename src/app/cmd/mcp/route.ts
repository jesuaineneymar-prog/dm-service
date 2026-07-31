// ============================================================
//  JARVIS MCP API — Model Context Protocol Hub
//  Central de comando para todos os MCP servers
//  Nada e removido — so adicionado
// ============================================================

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  MCP_SERVERS,
  callMCPTool,
  listMCPTools,
  checkMCPStatus,
  getAllMCPStatus,
  scrapeTikTokProfile,
  scrapeInstagramProfile,
  scrapeTikTokComments,
  scrapeInstagramComments,
  searchSocialProfiles,
  getTrendingContent,
  monitorBrandMentions,
  getMetaAdAccounts,
  getMetaCampaigns,
  getMetaCampaignInsights,
  getMetaPageInsights,
  socialyncCreatePost,
  socialyncGetScheduled,
  socialyncGetAnalytics,
  socialyncListAccounts,
} from '@/lib/mcp-engine';
import {
  createSession,
  getSession,
  getComposioStatus,
  searchTools,
  executeTool,
  getConnectLink,
  listSessionToolkits,
  listConnectedAccounts,
  MWANGO_TOOLKITS,
} from '@/lib/composio-engine';

export var maxDuration = 60;

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;

  try {
    var body = await request.json().catch(function () { return {}; });
    var action = body.action || '';

    // === LIST ALL SERVERS ===
    if (action === 'list_servers') {
      var servers = MCP_SERVERS.map(function(s) {
        return {
          id: s.id,
          name: s.name,
          description: s.description,
          category: s.category,
          status: s.status,
          pricing: s.pricing,
          setupUrl: s.setupUrl,
          toolCount: s.tools.length,
          tools: s.tools.map(function(t) { return { name: t.name, description: t.description, category: t.category }; }),
        };
      });
      return NextResponse.json({ success: true, data: servers });
    }

    // === CHECK ALL SERVER STATUS ===
    if (action === 'check_all') {
      var status = await getAllMCPStatus();
      return NextResponse.json({ success: true, data: status });
    }

    // === CHECK ONE SERVER ===
    if (action === 'check_server') {
      if (!body.serverId) return NextResponse.json({ success: false, error: 'serverId necessario' });
      var s = await checkMCPStatus(body.serverId);
      return NextResponse.json({ success: true, data: s });
    }

    // === LIST TOOLS ===
    if (action === 'list_tools') {
      if (!body.serverId) return NextResponse.json({ success: false, error: 'serverId necessario' });
      var tools = await listMCPTools(body.serverId);
      return NextResponse.json(tools);
    }

    // === GENERIC TOOL CALL ===
    if (action === 'call_tool') {
      if (!body.serverId || !body.tool) return NextResponse.json({ success: false, error: 'serverId e tool necessarios' });
      var result = await callMCPTool(body.serverId, body.tool, body.params || {});
      return NextResponse.json(result);
    }

    // === HIGH-LEVEL: SCRAPE PROFILE ===
    if (action === 'scrape_profile') {
      if (!body.platform || !body.username) return NextResponse.json({ success: false, error: 'platform e username necessarios' });
      var scrapeResult;
      if (body.platform === 'tiktok') scrapeResult = await scrapeTikTokProfile(body.username);
      else if (body.platform === 'instagram') scrapeResult = await scrapeInstagramProfile(body.username);
      else scrapeResult = await callMCPTool('socialcrawl', 'scrape_profile', { platform: body.platform, username: body.username });
      return NextResponse.json(scrapeResult);
    }

    // === HIGH-LEVEL: SCRAPE COMMENTS ===
    if (action === 'scrape_comments') {
      if (!body.platform || !body.url) return NextResponse.json({ success: false, error: 'platform e url necessarios' });
      var commResult;
      if (body.platform === 'tiktok') commResult = await scrapeTikTokComments(body.url, body.limit);
      else if (body.platform === 'instagram') commResult = await scrapeInstagramComments(body.url, body.limit);
      else commResult = await callMCPTool('socialcrawl', 'scrape_comments', { platform: body.platform, url: body.url, limit: body.limit || 50 });
      return NextResponse.json(commResult);
    }

    // === HIGH-LEVEL: SEARCH PROFILES ===
    if (action === 'search_profiles') {
      if (!body.query) return NextResponse.json({ success: false, error: 'query necessaria' });
      var searchResult = await searchSocialProfiles(body.query);
      return NextResponse.json(searchResult);
    }

    // === HIGH-LEVEL: TRENDING CONTENT ===
    if (action === 'get_trending') {
      var trendingResult = await getTrendingContent(body.platform);
      return NextResponse.json(trendingResult);
    }

    // === HIGH-LEVEL: BRAND MONITORING ===
    if (action === 'monitor_brand') {
      if (!body.brand) return NextResponse.json({ success: false, error: 'brand necessario' });
      var brandResult = await monitorBrandMentions(body.brand);
      return NextResponse.json(brandResult);
    }

    // === META ADS: GET AD ACCOUNTS ===
    if (action === 'meta_ad_accounts') {
      var accounts = await getMetaAdAccounts();
      return NextResponse.json(accounts);
    }

    // === META ADS: GET CAMPAIGNS ===
    if (action === 'meta_campaigns') {
      var campaigns = await getMetaCampaigns(body.adAccountId);
      return NextResponse.json(campaigns);
    }

    // === META ADS: GET CAMPAIGN INSIGHTS ===
    if (action === 'meta_campaign_insights') {
      if (!body.campaignId) return NextResponse.json({ success: false, error: 'campaignId necessario' });
      var insights = await getMetaCampaignInsights(body.campaignId, body.startDate, body.endDate);
      return NextResponse.json(insights);
    }

    // === META ADS: PAGE INSIGHTS ===
    if (action === 'meta_page_insights') {
      var pageInsights = await getMetaPageInsights(body.pageId);
      return NextResponse.json(pageInsights);
    }

    // === SOCIALYNC: CREATE POST ===
    if (action === 'socialync_post') {
      if (!body.platforms || !body.caption) return NextResponse.json({ success: false, error: 'platforms e caption necessarios' });
      var postResult = await socialyncCreatePost({
        platforms: body.platforms,
        caption: body.caption,
        mediaUrl: body.mediaUrl,
        scheduledAt: body.scheduledAt,
      });
      return NextResponse.json(postResult);
    }

    // === SOCIALYNC: LIST SCHEDULED ===
    if (action === 'socialync_scheduled') {
      var scheduled = await socialyncGetScheduled();
      return NextResponse.json(scheduled);
    }

    // === SOCIALYNC: ANALYTICS ===
    if (action === 'socialync_analytics') {
      var syncAnalytics = await socialyncGetAnalytics(body.postId);
      return NextResponse.json(syncAnalytics);
    }

    // === SOCIALYNC: LIST ACCOUNTS ===
    if (action === 'socialync_accounts') {
      var syncAccounts = await socialyncListAccounts();
      return NextResponse.json(syncAccounts);
    }

    // === COMPOSIO: STATUS ===
    if (action === 'composio_status') {
      var compStatus = await getComposioStatus();
      return NextResponse.json({ success: true, data: compStatus });
    }

    // === COMPOSIO: CREATE SESSION ===
    if (action === 'composio_create_session') {
      var sessionResult = await createSession(body.toolkits);
      return NextResponse.json(sessionResult);
    }

    // === COMPOSIO: GET SESSION ===
    if (action === 'composio_session') {
      var sessInfo = await getSession();
      return NextResponse.json(sessInfo);
    }

    // === COMPOSIO: LIST TOOLKITS ===
    if (action === 'composio_toolkits') {
      var toolkits = await listSessionToolkits();
      return NextResponse.json(toolkits);
    }

    // === COMPOSIO: MWANGO TOOLKITS (pre-definidos) ===
    if (action === 'composio_mwango_toolkits') {
      return NextResponse.json({ success: true, data: MWANGO_TOOLKITS });
    }

    // === COMPOSIO: SEARCH TOOLS ===
    if (action === 'composio_search') {
      if (!body.queries || !Array.isArray(body.queries)) {
        return NextResponse.json({ success: false, error: 'queries (array) necessario' });
      }
      var searchResult = await searchTools(body.queries);
      return NextResponse.json(searchResult);
    }

    // === COMPOSIO: EXECUTE TOOL ===
    if (action === 'composio_execute') {
      if (!body.toolSlug) return NextResponse.json({ success: false, error: 'toolSlug necessario' });
      var execResult = await executeTool(body.toolSlug, body.params || {});
      return NextResponse.json(execResult);
    }

    // === COMPOSIO: CONNECT LINK (OAuth) ===
    if (action === 'composio_connect') {
      if (!body.toolkit) return NextResponse.json({ success: false, error: 'toolkit necessario (ex: instagram, gmail)' });
      var linkResult = await getConnectLink(body.toolkit);
      return NextResponse.json(linkResult);
    }

    // === COMPOSIO: CONNECTED ACCOUNTS ===
    if (action === 'composio_accounts') {
      var compAccounts = await listConnectedAccounts();
      return NextResponse.json(compAccounts);
    }

    // === PLAYWRIGHT: NAVIGATE ===
    if (action === 'browser_navigate') {
      if (!body.url) return NextResponse.json({ success: false, error: 'url necessaria' });
      var navResult = await callMCPTool('playwright', 'navigate', { url: body.url });
      return NextResponse.json(navResult);
    }

    // === PLAYWRIGHT: EXTRACT DATA ===
    if (action === 'browser_extract') {
      if (!body.url) return NextResponse.json({ success: false, error: 'url necessaria' });
      var extractResult = await callMCPTool('playwright', 'extract_data', { url: body.url, selector: body.selector });
      return NextResponse.json(extractResult);
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
