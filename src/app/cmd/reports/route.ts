// ============================================================
//  Aura CLIENT REPORTS API — auto-relatorios para clientes
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { generateContent } from '@/lib/ai';

export var maxDuration = 60;

async function generateReport(clientName: string, periodStart: string, periodEnd: string, platform: string) {
  var start = new Date(periodStart);
  var end = new Date(periodEnd);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Datas invalidas');

  // Buscar metricas reais da DB
  var postsPublished = await db.contentPost.count({
    where: { publishedAt: { gte: start, lte: end }, platform: platform || undefined },
  });

  var analyticsEvents = await db.analyticsEvent.findMany({
    where: { recordedAt: { gte: start, lte: end }, platform: platform || undefined },
  });

  var totalLikes = 0;
  var totalComments = 0;
  for (var i = 0; i < analyticsEvents.length; i++) {
    var ev = analyticsEvents[i];
    if (ev.eventType === 'likes' || ev.eventType === 'like') totalLikes += ev.metricValue;
    if (ev.eventType === 'comments' || ev.eventType === 'comment') totalComments += ev.metricValue;
  }

  var newProspects = await db.prospect.count({
    where: { createdAt: { gte: start, lte: end } },
  });

  var conversions = await db.prospect.count({
    where: { status: 'converted', updatedAt: { gte: start, lte: end } },
  });

  var totalDMs = await db.message.count({
    where: { sentAt: { gte: start, lte: end }, direction: 'inbound' },
  });

  // Gerar sumario com IA
  var aiPrompt = 'Gera um sumario profissional em portugues para o relatorio do cliente "' + clientName + '" ' +
    'no periodo ' + start.toLocaleDateString('pt-AO') + ' a ' + end.toLocaleDateString('pt-AO') + '. ' +
    'Metricas: ' + postsPublished + ' posts publicados, ' + Math.round(totalLikes) + ' likes, ' +
    Math.round(totalComments) + ' comentarios, ' + totalDMs + ' DMs recebidos, ' +
    newProspects + ' novos prospects, ' + conversions + ' conversoes. ' +
    'Responde APENAS com o texto do sumario, 2-3 frases profissionais.';

  var aiSummary = '';
  try { aiSummary = await generateContent(aiPrompt); } catch (e) { aiSummary = 'Relatorio gerado automaticamente pela Aura.'; }

  // Guardar relatorio
  var report = await db.clientReport.create({
    data: {
      clientName,
      periodStart: start,
      periodEnd: end,
      platform: platform || null,
      postsPublished,
      totalLikes: Math.round(totalLikes),
      totalComments: Math.round(totalComments),
      totalDMs,
      newProspects,
      conversions,
      summary: aiSummary,
    },
  });

  return report;
}

async function listReports() {
  return await db.clientReport.findMany({ orderBy: { generatedAt: 'desc' }, take: 50 });
}

async function deleteReport(id: string) {
  await db.clientReport.delete({ where: { id } });
  return { success: true };
}

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  try {
    var body = await request.json().catch(function () { return {}; });
    var action = body.action || '';

    if (action === 'generate') {
      if (!body.clientName) return NextResponse.json({ success: false, error: 'Nome do cliente necessario' });
      var report = await generateReport(
        body.clientName,
        body.periodStart || new Date(Date.now() - 30 * 86400000).toISOString(),
        body.periodEnd || new Date().toISOString(),
        body.platform || '',
      );
      return NextResponse.json({ success: true, data: report });
    }

    if (action === 'list') {
      var reports = await listReports();
      return NextResponse.json({ success: true, data: reports });
    }

    if (action === 'delete') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      await deleteReport(body.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
