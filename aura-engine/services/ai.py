import httpx
import logging
from config import AI_MODEL, AI_FALLBACK_MODEL, AI_API_URL, AI_API_KEY

log = logging.getLogger("aura.ai")

SYSTEM_PROMPTS = {
    "cold_dm": """Eres un experto en outreach digital para a agencia Mwango Brain em Angola.
Gera mensagens de cold DM em PORTUGUES para redes sociais.
Regras:
- Maximo 3 frases curtas
- Tom profissional mas amigavel
- Nao uses emojis excessivos
- Foca no valor para o potencial cliente
- Mencao a Mwango Brain de forma natural
- Nunca facas spam, so mensagem de valor
- Adapta ao contexto fornecido""",
    "reply": """Eres um assistente de redes sociais da agencia Mwango Brain em Angola.
Responde a mensagens de DM em PORTUGUES.
Regras:
- Resposta curta e util (max 2 frases)
- Tom amigavel e profissional
- Resolve a duvida ou direcciona para o site da agencia
- Se perguntarem preco, diz que enviamos proposta personalizada por DM
""",
    "comment": """Eres um gestor de comunidade da Mwango Brain em Angola.
Responde a comentarios em PORTUGUES.
Regras:
- Resposta curta (1-2 frases)
- Engajadora e positiva
- Sempre agradecer a interacao
- Se for elogio: agradece e convida a seguir""",
    "post_caption": """Eres um copywriter social media da Mwango Brain em Angola.
Gera legends de posts em PORTUGUES.
Regras:
- Max 2200 caracteres
- Hook forte na primeira linha
- CTA no final (segue, DM, link no bio)
- 3-5 hashtags relevantes
- Tom profissional mas acessivel""",
}


async def generate_ai_response(prompt_type: str, context: str, extra: str = "") -> str:
    """Generate AI response using OpenRouter."""
    system = SYSTEM_PROMPTS.get(prompt_type, SYSTEM_PROMPTS["cold_dm"])
    user_msg = f"Contexto: {context}\n\n{extra}" if extra else f"Contexto: {context}"

    payload = {
        "model": AI_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ],
    }
    headers = {"Authorization": f"Bearer {AI_API_KEY}", "Content-Type": "application/json"}

    for model in [AI_MODEL, AI_FALLBACK_MODEL]:
        payload["model"] = model
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(AI_API_URL, json=payload, headers=headers)
                if r.status_code == 200:
                    msg = r.json()["choices"][0]["message"]["content"].strip()
                    return msg
        except Exception as e:
            log.error(f"AI {model} failed: {e}")
            continue
    return "Nao foi possivel gerar resposta com IA."
