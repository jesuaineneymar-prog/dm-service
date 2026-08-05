// ============================================================
//  Aura CAMPAIGNS API — campanhas de outreach
//  Cada campanha tem: nome, plataforma, mensagem base, lista de alvos,
//  status, estatisticas de envio
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { igSendDMByUsername } from '@/lib/ig-publish';
import { metaSendDM } from '@/lib/meta-graph';
import { generateAIResponse, getColdDMSystemPrompt } from '@/lib/ai';

export var maxDuration = 300;

// === CREATE CAMPAIGN ===
async function createCampaign(body: any) {
  var campaign = await db.campaign.create({
    data: {
      name: body.name,
      platform: body.platform || 'instagram',
      objective: body.objective || '',
      baseMessage: body.baseMessage || '',
      aiGenerate: body.aiGenerate !== false,
      context: body.context || '',
      status: 'draft',
      targetList: JSON.stringify(body.targets || []),
    },
  });
  return { success: true, data: campaign };
}

// === LIST CAMPAIGNS ===
async function listCampaigns(filter: any) {
  var where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.platform) where.platform = filter.platform;

  var campaigns = await db.campaign.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return campaigns.map(function(c) {
    var targets: any[] = [];
    try { targets = JSON.parse(c.targetList || '[]'); } catch(e) {}
    return {
      ...c,
      targetCount: targets.length,
      sentCount: c.sentCount || 0,
      failedCount: c.failedCount || 0,
      targets: undefined,
    };
  });
}

// === GET CAMPAIGN (with targets) ===
async function getCampaign(id: string) {
  var c = await db.campaign.findUnique({ where: { id } });
  if (!c) return { success: false, error: 'Campanha nao encontrada' };
  var targets: any[] = [];
  try { targets = JSON.parse(c.targetList || '[]'); } catch(e) {}
  return { success: true, data: { ...c, targets } };
}

// === UPDATE CAMPAIGN ===
async function updateCampaign(id: string, body: any) {
  var updateData: any = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.objective !== undefined) updateData.objective = body.objective;
  if (body.baseMessage !== undefined) updateData.baseMessage = body.baseMessage;
  if (body.context !== undefined) updateData.context = body.context;
  if (body.targets !== undefined) updateData.targetList = JSON.stringify(body.targets);
  if (body.status !== undefined) updateData.status = body.status;

  var updated = await db.campaign.update({ where: { id }, data: updateData });
  return { success: true, data: updated };
}

// === DELETE CAMPAIGN ===
async function deleteCampaign(id: string) {
  await db.campaign.delete({ where: { id } });
  return { success: true };
}

// === EXECUTE CAMPAIGN (send DMs to all targets) ===
async function executeCampaign(id: string, body: any) {
  var campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) return { success: false, error: 'Campanha nao encontrada' };

  var targets: any[] = [];
  try { targets = JSON.parse(campaign.targetList || '[]'); } catch(e) {}
  if (!targets.length) return { success: false, error: 'Sem alvos na campanha' };

  // Update status
  await db.campaign.update({ where: { id }, data: { status: 'running', startedAt: new Date() } });

  var sent = 0;
  var failed = 0;
  var results: any[] = [];
  var batchSize = body.batchSize || 10;
  var delay = body.delay || 45000; // 45s between messages

  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    var msg = t.message || campaign.baseMessage || '';

    // Generate AI message if enabled and no specific message
    if (!msg && campaign.aiGenerate) {
      msg = await generateAIResponse('@' + (t.username || 'prospect') + ' — ' + (campaign.context || 'prospecto') + (campaign.objective ? '. Objectivo: ' + campaign.objective : ''), {
        systemPrompt: getColdDMSystemPrompt(),
        maxTokens: 150,
        temperature: 0.8,
        context: { platform: campaign.platform, username: t.username, bio: t.bio, category: t.category },
      });
    }
    if (!msg) { failed++; results.push({ target: t.username, success: false, error: 'Mensagem vazia' }); continue; }

    var r: any;
    try {
      if (campaign.platform === 'instagram') {
        r = await igSendDMByUsername(t.username, msg);
      } else if (campaign.platform === 'facebook') {
        if (t.userId) {
          r = await metaSendDM({ platform: 'facebook', recipientId: t.userId, message: msg });
        } else {
          r = { success: false, error: 'userId necessario' };
        }
      } else {
        r = { success: false, error: 'Plataforma nao suportada' };
      }
    } catch(e: any) {
      r = { success: false, error: e.message };
    }

    if (r.success) sent++; else failed++;
    results.push({ target: t.username, message: msg, ...r });

    // Update counters
    await db.campaign.update({ where: { id }, data: { sentCount: sent, failedCount: failed } });

    // Pause between batches
    if (i < targets.length - 1 && (i + 1) % batchSize === 0) {
      console.log('[Campaign] Batch pause: ' + Math.round(delay/60000) + ' min');
      await new Promise(function(resolve) { setTimeout(resolve, delay); });
    } else if (i < targets.length - 1) {
      await new Promise(function(resolve) { setTimeout(resolve, 15000 + Math.floor(Math.random() * 10000)); });
    }
  }

  // Mark as completed
  await db.campaign.update({ where: { id }, data: { status: 'completed', completedAt: new Date(), sentCount: sent, failedCount: failed, results: JSON.stringify(results) } });

  return { success: sent > 0, sent, failed, total: targets.length, results };
}

// === CAMPAIGN STATS ===
async function getCampaignStats() {
  var all = await db.campaign.findMany();
  var byStatus: Record<string, number> = {};
  var totalSent = 0;
  var totalFailed = 0;
  var totalTargets = 0;

  for (var i = 0; i < all.length; i++) {
    var c = all[i];
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    totalSent += c.sentCount || 0;
    totalFailed += c.failedCount || 0;
    var tCount = 0;
    try { tCount = JSON.parse(c.targetList || '[]').length; } catch(e) {}
    totalTargets += tCount;
  }

  return {
    total: all.length,
    byStatus,
    totalSent,
    totalFailed,
    totalTargets,
    successRate: totalSent + totalFailed > 0 ? ((totalSent / (totalSent + totalFailed)) * 100).toFixed(1) + '%' : '0%',
  };
}

// === MAIN HANDLER ===
export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';

  try {
    if (action === 'create') return NextResponse.json(await createCampaign(body));
    if (action === 'list') return NextResponse.json({ success: true, data: await listCampaigns(body.filter || {}) });
    if (action === 'get') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      return NextResponse.json(await getCampaign(body.id));
    }
    if (action === 'update') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      return NextResponse.json(await updateCampaign(body.id, body));
    }
    if (action === 'delete') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      return NextResponse.json(await deleteCampaign(body.id));
    }
    if (action === 'execute') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      return NextResponse.json(await executeCampaign(body.id, body));
    }
    if (action === 'stats') return NextResponse.json({ success: true, data: await getCampaignStats() });

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch(e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
