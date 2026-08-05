'use client';
import { useState, useEffect, useRef } from 'react';
import { Trash2, Camera, RefreshCw } from 'lucide-react';
import { Spinner, ft, apiCall, S } from './ui';

// ===== TAB 4: CONTENT =====
export function ContentTab() {
  const [platform, setPlatform] = useState('instagram');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('profissional');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [hashTopic, setHashTopic] = useState('');
  const [hashCount, setHashCount] = useState(15);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashLoading, setHashLoading] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState<string | null>(null);
  const [pubPlatforms, setPubPlatforms] = useState<string[]>(['instagram']);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const generatePost = async () => {
    setGenerating(true);
    try {
      var body: any = { action: 'generate_post', platform, topic, tone, language: 'pt' };
      // Se ha media, converter para base64 e enviar
      if (mediaFile) {
        var reader = new FileReader();
        var base64 = await new Promise<string>((resolve) => { reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]); reader.readAsDataURL(mediaFile); });
        body.mediaData = base64;
        body.mediaType = mediaFile.type.startsWith('video') ? 'video' : 'image';
      }
      var res = await apiCall('/cmd/content', body);
      if (res.success) setGenerated(res.data);
    } catch(e) { console.warn('Aura:', e); }
    setGenerating(false);
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    var file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert('Ficheiro muito grande (max 50MB)'); return; }
    setMediaFile(file);
    var url = URL.createObjectURL(file);
    setMediaPreview(url);
  };

  const removeMedia = () => { setMediaFile(null); setMediaPreview(null); if (mediaInputRef.current) mediaInputRef.current.value = ''; };

  const improveCaption = async () => {
    if (!generated?.caption) return;
    setGenerating(true);
    try {
      var res = await apiCall('/cmd/content', { action: 'improve_caption', caption: generated.caption, platform });
      if (res.success) setGenerated({ ...generated, caption: res.data.caption });
    } catch(e) { console.warn('Aura:', e); }
    setGenerating(false);
  };

  const generateHashtags = async () => {
    if (!hashTopic.trim()) return;
    setHashLoading(true);
    try {
      var res = await apiCall('/cmd/content', { action: 'generate_hashtags', topic: hashTopic, platform, count: hashCount });
      if (res.success) setHashtags(res.data || []);
    } catch(e) { console.warn('Aura:', e); }
    setHashLoading(false);
  };

  const fetchDrafts = async () => {
    setDraftsLoading(true);
    try {
      var res = await apiCall('/cmd/content', { action: 'list_drafts' });
      if (res.success) setDrafts(res.data || []);
    } catch(e) { console.warn('Aura:', e); }
    setDraftsLoading(false);
  };

  const publishDraft = async (id: string) => {
    setPublishing(id);
    try {
      var pubBody: any = { action: 'post', platforms: pubPlatforms, caption: '' };
      // If publishing the generated post
      if (id === 'generated' && generated) {
        pubBody.caption = generated.caption;
        if (mediaFile) {
          var reader = new FileReader();
          pubBody.mediaData = await new Promise<string>((resolve) => { reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]); reader.readAsDataURL(mediaFile); });
          pubBody.mediaType = mediaFile.type.startsWith('video') ? 'video' : 'image';
        } else if (generated.mediaUrl) {
          pubBody.imageUrl = generated.mediaUrl;
        }
      } else {
        // Publishing a saved draft
        var draft = drafts.find((d: any) => d.id === id);
        if (draft) {
          pubBody.caption = draft.caption;
          if (draft.mediaUrl) pubBody.imageUrl = draft.mediaUrl;
        }
      }
      var res = await apiCall('/cmd/publish', pubBody);
      if (res.success) {
        await fetchDrafts();
        setShowPublish(null);
        setGenerated(null);
      }
    } catch(e) { console.warn('Aura:', e); }
    setPublishing(null);
  };

  const deleteDraft = async (id: string) => {
    await apiCall('/cmd/content', { action: 'delete_draft', id });
    await fetchDrafts();
  };

  useEffect(() => { fetchDrafts(); }, []);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>✨ Gerador de Conteudo</div>

        {/* GENERATE */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Criar Post</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {['instagram', 'facebook', 'tiktok', 'all'].map(pl => (
              <button key={pl} onClick={() => setPlatform(pl)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: platform === pl ? '#ff4444' : 'rgba(255,255,255,0.06)', color: platform === pl ? '#fff' : '#888', textTransform: 'capitalize' }}>{pl}</button>
            ))}
          </div>
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topico do post..." style={{ ...S.input, marginBottom: 10 }} />
          <select value={tone} onChange={e => setTone(e.target.value)} style={{ ...S.input, marginBottom: 12, appearance: 'none', background: 'rgba(20,20,22,0.8) url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E") no-repeat right 14px center' }}>
            {['profissional', 'casual', 'criativo', 'engracado', 'inspirador'].map(t => <option key={t} value={t} style={{ background: '#1a1a1a' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>

          {/* MEDIA UPLOAD */}
          <input ref={mediaInputRef} type="file" accept="image/*,video/mp4,video/quicktime" style={{ display: 'none' }} onChange={handleMediaSelect} />
          {mediaPreview ? (
            <div style={{ position: 'relative', marginBottom: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,68,68,0.2)' }}>
              {mediaFile?.type.startsWith('video') ? (
                <video src={mediaPreview} style={{ width: '100%', maxHeight: 240, objectFit: 'cover' }} muted />
              ) : (
                <img src={mediaPreview} style={{ width: '100%', maxHeight: 240, objectFit: 'cover' }} alt="preview" />
              )}
              <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                <div style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(0,0,0,0.7)', color: '#fff' }}>{((mediaFile?.size || 0) / 1024 / 1024).toFixed(1)}MB</div>
                <button onClick={removeMedia} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,0,0,0.8)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>X</button>
              </div>
            </div>
          ) : (
            <button onClick={() => mediaInputRef.current?.click()} style={{ width: '100%', height: 80, marginBottom: 12, background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,68,68,0.2)', borderRadius: 10, color: '#888', fontSize: 13, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Camera size={24} style={{ color: '#ff4444' }} />
              <span>Foto ou Video (max 50MB)</span>
            </button>
          )}
          <button onClick={generatePost} disabled={generating || !topic.trim()} style={{ ...S.btn, width: '100%' }}>{generating ? 'A gerar...' : 'Gerar Post'}</button>
        </div>

        {/* GENERATED */}
        {generated && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ ...S.badge('#ff4444') }}>{generated.platform || platform}</span>
              <span style={{ ...S.textS, fontSize: 11 }}>{(generated.caption || '').length} chars</span>
            </div>
            <div style={{ fontSize: 14, color: '#fff', lineHeight: 1.7, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{generated.caption}</div>
            {generated.hashtags && generated.hashtags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {generated.hashtags.map((h: string, i: number) => (
                  <span key={i} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(255,68,68,0.1)', color: '#ff4444', fontWeight: 500 }}>{h}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { navigator.clipboard.writeText(generated.caption + (generated.hashtags ? '\n' + generated.hashtags.join(' ') : '')); }} style={{ ...S.btnOutline, flex: 1 }}>Copiar</button>
              <button onClick={improveCaption} disabled={generating} style={{ ...S.btnOutline, flex: 1 }}>Melhorar</button>
              <button onClick={() => setShowPublish('generated')} style={{ ...S.btn, flex: 1 }}>Publicar</button>
            </div>
          </div>
        )}

        {/* HASHTAGS */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Gerador de Hashtags</div>
          <input value={hashTopic} onChange={e => setHashTopic(e.target.value)} placeholder="Topico..." style={{ ...S.input, marginBottom: 10 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ ...S.textS, fontSize: 11, whiteSpace: 'nowrap' }}>{hashCount}</span>
            <input type="range" min="5" max="30" value={hashCount} onChange={e => setHashCount(parseInt(e.target.value))} style={{ flex: 1, accentColor: '#ff4444' }} />
          </div>
          <button onClick={generateHashtags} disabled={hashLoading || !hashTopic.trim()} style={{ ...S.btn, width: '100%', marginBottom: 12 }}>{hashLoading ? 'A gerar...' : 'Gerar Hashtags'}</button>
          {hashtags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {hashtags.map((h: string, i: number) => (
                <span key={i} onClick={() => { navigator.clipboard.writeText(h); }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, background: 'rgba(255,68,68,0.1)', color: '#ff4444', fontWeight: 500, cursor: 'pointer' }}>{h}</span>
              ))}
            </div>
          )}
        </div>

        {/* DRAFTS */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Rascunhos</div>
            <button onClick={fetchDrafts} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><RefreshCw size={14} /></button>
          </div>
          {draftsLoading && <Spinner />}
          {drafts.length === 0 && !draftsLoading && <div style={{ ...S.textS, fontSize: 12, textAlign: 'center' }}>Sem rascunhos</div>}
          {drafts.map((d: any) => (
            <div key={d.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 12, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(d.caption || 'Sem caption').slice(0, 80)}</div>
              {d.hashtags && <div style={{ fontSize: 10, color: '#ff4444', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.hashtags.slice(0, 100)}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={S.badge('rgba(255,68,68,0.2)')}>{d.platform || '?'}</span>
                  <span style={{ ...S.textS, fontSize: 10 }}>{new Date(d.createdAt).toLocaleDateString('pt-AO')}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setShowPublish(d.id)} style={{ ...S.btn, padding: '0 10px', height: 28, fontSize: 10 }}>Pub</button>
                  <button onClick={() => deleteDraft(d.id)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* PUBLISH MODAL */}
        {showPublish && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ ...S.card, width: '100%', maxWidth: 340 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Publicar</div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                {['instagram', 'facebook', 'tiktok'].map(pl => (
                  <label key={pl} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#fff' }}>
                    <input type="checkbox" checked={pubPlatforms.includes(pl)} onChange={e => { setPubPlatforms(e.target.checked ? [...pubPlatforms, pl] : pubPlatforms.filter(p => p !== pl)); }} style={{ accentColor: '#ff4444' }} />
                    {pl.toUpperCase()}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowPublish(null)} style={{ ...S.btnOutline, flex: 1 }}>Cancelar</button>
                <button onClick={() => publishDraft(showPublish)} disabled={!!publishing || pubPlatforms.length === 0} style={{ ...S.btn, flex: 1 }}>{publishing ? 'A publicar...' : 'Publicar'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
