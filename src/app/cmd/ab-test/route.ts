// ============================================================
//  JARVIS A/B TESTING API — testar variantes de conteudo
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { generateContent } from '@/lib/ai';

export var maxDuration = 60;

async function createABTest(topic: string, platform: string) {
  // Gerar duas variantes com IA
  var promptA = 'Cria a VARIANTE A de um post sobre: "' + topic + '" para ' + platform + '. Tom: ousado e directo. Responde APENAS com o texto da legenda, sem hashtags, sem explicacoes.';
  var promptB = 'Cria a VARIANTE B de um post sobre: "' + topic + '" para ' + platform + '. Tom: emocional e storytelling. Responde APENAS com o texto da legenda, sem hashtags, sem explicacoes.';

  var variantA = await generateContent(promptA);
  var variantB = await generateContent(promptB);

  // Gerar hashtags para cada variante
  var hashPrompt = 'Gera 10 hashtags para: "' + topic + '" em ' + platform + '. Responde APENAS com JSON array: ["#tag1", "#tag2"]';
  var hashA = '';
  var hashB = '';
  try {
    var hashResp = await generateContent(hashPrompt);
    var m = hashResp.match(/\[[\s\S]*\]/);
    if (m) {
      var tags = JSON.parse(m[0]);
      hashA = tags.slice(0, 5).join(' ');
      hashB = tags.slice(5).join(' ');
    }
  } catch (e) { /* sem hashtags */ }

  var test = await db.aBTest.create({
    data: {
      name: 'A/B: ' + topic.slice(0, 40),
      platform,
      variantA,
      variantB,
      hashtagsA: hashA || null,
      hashtagsB: hashB || null,
      status: 'draft',
    },
  });

  return { id: test.id, name: test.name, variantA, variantB, hashtagsA: test.hashtagsA, hashtagsB: test.hashtagsB, status: test.status };
}

async function listABTests() {
  return await db.aBTest.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
}

async function startTest(id: string) {
  var test = await db.aBTest.update({ where: { id }, data: { status: 'running' } });
  return test;
}

async function updateMetrics(id: string, variant: string, data: { likes?: number; comments?: number; impressions?: number }) {
  var updateData: any = {};
  var suffix = variant === 'A' ? 'A' : 'B';
  if (data.likes !== undefined) updateData['likes' + suffix] = data.likes;
  if (data.comments !== undefined) updateData['comments' + suffix] = data.comments;
  if (data.impressions !== undefined) updateData['impressions' + suffix] = data.impressions;

  var test = await db.aBTest.update({ where: { id }, data: updateData });
  return test;
}

async function concludeTest(id: string) {
  var test = await db.aBTest.findUnique({ where: { id } });
  if (!test) throw new Error('Teste nao encontrado');

  // Calcular vencedor: melhor taxa de engajamento
  var engA = test.impressionsA > 0 ? (test.likesA + test.commentsA) / test.impressionsA : 0;
  var engB = test.impressionsB > 0 ? (test.likesB + test.commentsB) / test.impressionsB : 0;

  var winner = 'tie';
  if (engA > engB * 1.1) winner = 'A';
  else if (engB > engA * 1.1) winner = 'B';

  var updated = await db.aBTest.update({
    where: { id },
    data: { status: 'completed', winner },
  });

  return { ...updated, engRateA: engA.toFixed(4), engRateB: engB.toFixed(4) };
}

async function deleteTest(id: string) {
  await db.aBTest.delete({ where: { id } });
  return { success: true };
}

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  try {
    var body = await request.json().catch(function () { return {}; });
    var action = body.action || '';

    if (action === 'create') {
      if (!body.topic) return NextResponse.json({ success: false, error: 'Topico necessario' });
      var result = await createABTest(body.topic, body.platform || 'instagram');
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'list') {
      var tests = await listABTests();
      return NextResponse.json({ success: true, data: tests });
    }

    if (action === 'start') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      var started = await startTest(body.id);
      return NextResponse.json({ success: true, data: started });
    }

    if (action === 'update_metrics') {
      if (!body.id || !body.variant) return NextResponse.json({ success: false, error: 'ID e variante necessarios' });
      var updated = await updateMetrics(body.id, body.variant, body);
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'conclude') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      var concluded = await concludeTest(body.id);
      return NextResponse.json({ success: true, data: concluded });
    }

    if (action === 'delete') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      await deleteTest(body.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
