// ============================================================
//  Aura LLM — OpenRouter (Groq removido)
//  Toda a geracao IA passa por OpenRouter
//  Ficheiro mantido para compatibilidade de imports existentes
// ============================================================

import { OR_KEY, OR_URL, OR_MODEL, OR_FALLBACK_MODEL } from './config';

interface LLMOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

const OR_HEADERS = {
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://jarvis-khaki-chi.vercel.app',
  'X-Title': 'Aura',
};

export async function groqChat(messages: any[], options: LLMOptions = {}): Promise<string> {
  if (!OR_KEY) return '[ERRO] OR_KEY nao configurada';

  var sysPrompt = options.systemPrompt || 'Es o Aura da Mwango Brain. FALAS PORTUGUES DE ANGOLA. Respostas curtas.';
  var fullMessages = [{ role: 'system', content: sysPrompt }, ...messages];

  try {
    var res = await fetch(OR_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OR_KEY, ...OR_HEADERS },
      body: JSON.stringify({
        model: OR_MODEL,
        messages: fullMessages,
        max_tokens: options.maxTokens || 300,
        temperature: options.temperature || 0.7,
      }),
    });

    if (!res.ok) {
      // Fallback model
      var res2 = await fetch(OR_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + OR_KEY, ...OR_HEADERS },
        body: JSON.stringify({
          model: OR_FALLBACK_MODEL,
          messages: fullMessages,
          max_tokens: options.maxTokens || 300,
          temperature: options.temperature || 0.7,
        }),
      });
      var data2 = await res2.json();
      return data2.choices?.[0]?.message?.content || '';
    }

    var data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (e: any) {
    throw new Error('LLM error: ' + e.message);
  }
}

/** Generate DM reply via LLM */
export async function groqDMReply(senderName: string, platform: string, messageText: string): Promise<string> {
  return groqChat([
    { role: 'user', content: 'Mensagem de @' + senderName + ' no ' + platform + ': "' + messageText + '". Responde de forma natural e simpatica em portugues angolano.' },
  ]);
}

/** Generate content via LLM */
export async function groqGenerateContent(prompt: string, maxTokens?: number): Promise<string> {
  return groqChat([
    { role: 'user', content: prompt },
  ], {
    systemPrompt: 'Es um copywriter da Mwango Brain (Angola). FALAS PORTUGUES DE ANGOLA. Cria conteudo criativo e profissional.',
    maxTokens: maxTokens || 500,
    temperature: 0.8,
  });
}

/** Analyze toxicity of a comment */
export async function groqToxicityAnalysis(text: string): Promise<{ isToxic: boolean; score: number; reason: string }> {
  var response = await groqChat([
    { role: 'user', content: 'Analisa este comentario e diz se e toxico/spam. Responde APENAS com JSON: {"isToxic": true/false, "score": 0.0-1.0, "reason": "..."}. Comentario: "' + text + '"' },
  ], { maxTokens: 100, temperature: 0.1 });

  try {
    var jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      var parsed = JSON.parse(jsonMatch[0]);
      return { isToxic: !!parsed.isToxic, score: parsed.score || 0, reason: parsed.reason || '' };
    }
  } catch (e) { /* fallback */ }
  return { isToxic: false, score: 0, reason: 'parse_error' };
}

/** Analyze audience/followers */
export async function groqAnalyzeAudience(followersData: any[]): Promise<string> {
  var summary = followersData.slice(0, 50).map(function(f: any) {
    return '@' + (f.username || '?') + ' (' + (f.followers || 0) + ' seguidores' + (f.is_verified ? ', verificado' : '') + ')';
  }).join('\n');

  return groqChat([
    { role: 'user', content: 'Analisa esta lista de seguidores e da insights sobre a audiencia. Identifica: 1) tipo de audiencia 2) potenciais influenciadores 3) engajamento esperado. Responde em portugues angolano, max 5 frases.\n\n' + summary },
  ], { maxTokens: 400, temperature: 0.3 });
}
