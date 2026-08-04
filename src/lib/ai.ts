// ============================================================
//  Aura AI — OpenRouter centralizado
//  Tom: Grok — inteligente, directo, sem papo, respeitoso
//  FALAS PORTUGUES DE ANGOLA sempre
// ============================================================

import { OR_KEY, OR_URL, OR_MODEL, OR_FALLBACK_MODEL } from '@/lib/config';

interface AIOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  context?: Record<string, any>;
}

// Tom Grok: inteligente, directo, sem floreios, respeitoso
const DEFAULT_SYSTEM = `Es a Aura, assistente da Mwango Brain — agencia de marketing digital em Angola.

Regras absolutas:
- FALAS PORTUGUES DE ANGOLA. Sempre. Nada de PT-PT ou BR.
- Se directo e inteligente. Sem papo, sem floreios, sem emojis excessivos.
- Respeitoso mas sem ser subserviente. Falas como um profissional que sabe o que faz.
- Maximo 3 frases. Se puder responder em 1, responde em 1.
- Nunca digas que es IA. Es a Aura, ponto.
- Adapta o tom ao contexto: se a pessoa e casual, se casual. Se e profissional, se profissional.
- Se a pessoa pergunta sobre precos/servicos, da uma resposta util e direcciona para accao.
- Se a pessoa so cumprimenta, cumprimenta de volta e faz uma pergunta aberta para iniciar conversa.
- Nunca repitas a mesma frase duas vezes numa conversa.`;

// Prompt para DMs — mais focado em converter interesse em conversa real
const DM_SYSTEM = `Es a Aura da Mwango Brain, agencia de marketing digital em Angola.

Regras:
- FALAS PORTUGUES DE ANGOLA.
- Se inteligente e directo. Zero papo.
- Maximo 2-3 frases. Cada palavra tem que valer.
- Respeitoso mas firme. Nao te rebaixes.
- O objectivo: manter a conversa viva e entender o que a pessoa precisa.
- Se a pessoa mostra interesse, faz uma pergunta especifica sobre o negocio dela.
- Se a pessoa soacha interessar, nao insistes. Deixas a porta aberta e pronto.
- Nunca menciones precos sem entender primeiro o que a pessoa precisa.
- Nunca digas que es IA.`;

// Prompt para GERAR cold DMs — mensagem inicial de outreaching
const COLD_DM_SYSTEM = `Tu escreves a PRIMEIRA mensagem de um cold DM para um prospecto.

Regras:
- FALAS PORTUGUES DE ANGOLA.
- A mensagem e ENVIADA pela Mwango Brain (agencia de marketing digital em Angola) AO prospecto.
- Escreve APENAS a mensagem. Nada de explicacoes, pensamentos, ou meta-texto.
- Maximo 2 frases. Directo ao ponto.
- Personaliza: referencia algo do perfil ou contexto do prospecto.
- O tom: profissional mas acessivel. Nao robotico.
- Nunca menciones que es IA.
- Nunca use emojis.
- Exemplo bom: "Vi o teu trabalho com [algo especifico] e achei interessante. Estao a pensar em crescer a presenca digital do negocio?"`;

// Prompt para responder a comentarios — iniciar conversa por DM
const COMMENT_SYSTEM = `Alguem comentou num post da Mwango Brain. Tu vais gerar a mensagem de DM inicial.

Regras:
- FALAS PORTUGUES DE ANGOLA.
- A mensagem DEPENDE do que a pessoa comentou. Le com atencao.
- Se directo e inteligente. Zero mensagens genericas tipo "obrigado pelo comentario".
- Referencia o que a pessoa disse. Mostra que leste.
- Maximo 2 frases.
- O tom depende do comentario: se for engraçado, se engraçado. Se for uma pergunta, responde. Se for elogio, agradece de forma genuine.
- Nunca menciones que es IA.
- Nunca uses emojis excessivos. Um no maximo, se fizer sentido.
- O objectivo: iniciar uma conversa real, nao mandar mensagem automatica.`;

const JARVIS_HEADERS = {
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://jarvis-khaki-chi.vercel.app',
  'X-Title': 'Aura',
};

export async function generateAIResponseRaw(
  userMessage: string,
  options: AIOptions = {},
  customModel?: string
): Promise<any> {
  const { systemPrompt, maxTokens = 200, temperature = 0.7, context } = options;
  const sys = systemPrompt || DEFAULT_SYSTEM;
  const messages: any[] = [
    { role: 'system', content: sys },
    { role: 'user', content: userMessage },
  ];
  const res = await fetch(OR_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + OR_KEY, ...JARVIS_HEADERS },
    body: JSON.stringify({ model: customModel || OR_MODEL, messages, max_tokens: maxTokens, temperature }),
  });
  return res.json();
}

/** Gera resposta IA via OpenRouter (Gemma com fallback Ling) */
export async function generateAIResponse(
  userMessage: string,
  options: AIOptions = {}
): Promise<string> {
  const { systemPrompt, maxTokens = 200, temperature = 0.7, context } = options;

  const sys = systemPrompt || DEFAULT_SYSTEM;
  let fullSystem = sys;

  if (context) {
    const parts: string[] = [];
    if (context.username) parts.push('Pessoa: @' + context.username);
    if (context.platform) parts.push('Plataforma: ' + context.platform);
    if (context.notes) parts.push('Notas CRM: ' + context.notes);
    if (context.category) parts.push('Categoria: ' + context.category);
    if (context.bio) parts.push('Bio: ' + (context.bio || '').slice(0, 200));
    if (parts.length > 0) fullSystem += '\n\nContexto: ' + parts.join('. ');
  }

  const messages: any[] = [
    { role: 'system', content: fullSystem },
    { role: 'user', content: userMessage },
  ];

  var requestBody = { model: OR_MODEL, messages, max_tokens: maxTokens, temperature };

  try {
    const res = await fetch(OR_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OR_KEY, ...JARVIS_HEADERS },
      body: JSON.stringify(requestBody),
    });

    console.log('[AI] Status:', res.status);
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      console.log('[AI] Primary failed:', res.status, errText.substring(0, 200));
      requestBody.model = OR_FALLBACK_MODEL;
      const res2 = await fetch(OR_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + OR_KEY, ...JARVIS_HEADERS },
        body: JSON.stringify(requestBody),
      });
      const data2 = await res2.json();
      console.log('[AI] Fallback status:', res2.status);
      return cleanAIResponse(data2);
    }

    const data = await res.json();
    return cleanAIResponse(data);
  } catch (e: any) {
    console.error('Aura AI Error:', e?.message || e);
    return '[AI erro: ' + (e?.message || 'desconhecido') + ']';
  }
}

/**
 * Gera resposta IA para DM — usa prompt DM_SYSTEM (directo, conversacional)
 */
export async function generateDMReply(
  senderName: string,
  platform: string,
  messageText: string,
  prospectContext?: any
): Promise<string> {
  const userMsg = '@' + senderName + ' no ' + platform + ' disse: "' + messageText + '"';
  return generateAIResponse(userMsg, {
    systemPrompt: DM_SYSTEM,
    maxTokens: 150,
    context: { ...prospectContext, username: senderName, platform },
  });
}

/**
 * Gera DM inicial baseado num comentario — usa COMMENT_SYSTEM
 */
export async function generateCommentDM(
  commenterUsername: string,
  commentText: string,
  platform: string,
  postCaption?: string
): Promise<string> {
  var userMsg = '@' + commenterUsername + ' comentou: "' + commentText + '"';
  if (postCaption) userMsg += '\n\nCaption do post: "' + postCaption.slice(0, 200) + '"';
  return generateAIResponse(userMsg, {
    systemPrompt: COMMENT_SYSTEM,
    maxTokens: 120,
    temperature: 0.8,
  });
}

/**
 * Gera conteudo (posts, captions, hashtags)
 */
export async function generateContent(prompt: string, maxTokens = 500): Promise<string> {
  return generateAIResponse(prompt, {
    systemPrompt: 'Es copywriter da Mwango Brain (Angola). FALAS PORTUGUES DE ANGOLA. Cria conteudo que engaja, sem ser generico.',
    maxTokens,
    temperature: 0.8,
  });
}

/**
 * Chat generico (para o chat tab)
 */
export async function chatCompletion(messages: any[], maxTokens = 400): Promise<string> {
  const sysMsg = 'Es a Aura da Mwango Brain. FALAS PORTUGUES DE ANGOLA. Directo e util, max 3 frases. Nunca digas que es IA.';
  const fullMessages = [{ role: 'system', content: sysMsg }, ...messages];

  try {
    const res = await fetch(OR_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OR_KEY, ...JARVIS_HEADERS },
      body: JSON.stringify({ model: OR_MODEL, messages: fullMessages, max_tokens: maxTokens, temperature: 0.7 }),
    });

    if (!res.ok) {
      const res2 = await fetch(OR_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + OR_KEY, ...JARVIS_HEADERS },
        body: JSON.stringify({ model: OR_FALLBACK_MODEL, messages: fullMessages, max_tokens: maxTokens, temperature: 0.7 }),
      });
      const data2 = await res2.json();
      return cleanAIResponse(data2);
    }

    const data = await res.json();
    return cleanAIResponse(data);
  } catch (e: any) {
    console.error('Aura AI Error:', e?.message || e);
    return '[AI erro: ' + (e?.message || 'desconhecido') + ']';
  }
}

/** Retorna o prompt de sistema para DMs (usado pelo cold-dm route) */
export function getDMSystemPrompt(): string {
  return DM_SYSTEM;
}

/** Retorna o prompt de sistema para GERAR cold DMs */
export function getColdDMSystemPrompt(): string {
  return COLD_DM_SYSTEM;
}

/** Retorna o prompt de sistema para comentarios */
export function getCommentSystemPrompt(): string {
  return COMMENT_SYSTEM;
}

/** Limpa formatacao de resposta IA */
function cleanAIResponse(data: any): string {
  if (data.error) {
    var errMsg = data.error.message || JSON.stringify(data.error);
    console.log('[AI] API Error:', errMsg);
    return '[API erro: ' + errMsg.substring(0, 100) + ']';
  }
  var choice = data.choices?.[0];
  if (!choice) return '';
  var msg = choice.message || {};
  // Primary: use content field
  var content = msg.content || '';
  // Fallback: if content is null/empty, extract last part of reasoning (final answer)
  if (!content && msg.reasoning) {
    // Reasoning models: the last paragraph after thinking is usually the answer
    var reasoning = msg.reasoning as string;
    var parts = reasoning.split('\\n').filter(function(p: string) { return p.trim().length > 0; });
    content = parts[parts.length - 1] || reasoning;
  }
  // Remover marcacao excessiva mas manter o texto
  content = content.replace(/^\*{1,3}\s*/, '').trim();
  return content;
}
