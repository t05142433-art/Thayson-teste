import { useState, useEffect, ChangeEvent, useRef } from "react";
import { 
  Send, 
  MessageSquare, 
  User, 
  Image as ImageIcon, 
  RefreshCcw, 
  PlusCircle, 
  Sparkles,
  Music,
  AlertCircle,
  Settings,
  Terminal,
  LogOut
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";

// Initialization of AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Tab = "publish" | "comments" | "accounts" | "directs" | "logs";

interface BotSettings {
  user_id: string;
  cookie_string: string;
  csrf_token: string;
  lsd_token: string;
  fb_dtsg: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("publish");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [isCheckingLogin, setIsCheckingLogin] = useState(false);
  const [showEngine, setShowEngine] = useState(false);
  
  // Publish state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [comment, setComment] = useState("");
  const [iterations, setIterations] = useState(1);
  const [postType, setPostType] = useState<"feed" | "story">("feed");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string[]>([]);
  const [publishedHashes, setPublishedHashes] = useState<Set<string>>(new Set());

  // Comment state
  const [commentLink, setCommentLink] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentCount, setCommentCount] = useState(1);
  const [isCommenting, setIsCommenting] = useState(false);
  const [infinityMode, setInfinityMode] = useState(false);
  const [commentMode, setCommentMode] = useState<"manual" | "automatic">("manual");
  const [commentLinkPreview, setCommentLinkPreview] = useState("");
  const [bgTasks, setBgTasks] = useState<any[]>([]);

  useEffect(() => {
    fetchSettings();
    checkLogin();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/bot/settings");
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  };

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/bot/tasks/status");
        if (res.ok) {
          const data = await res.json();
          setBgTasks(data);
        }
      } catch (e) {}
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (commentLink && commentLink.includes("instagram.com/")) {
       fetchPreview();
    } else {
       setCommentLinkPreview("");
    }
  }, [commentLink]);

  const fetchPreview = async () => {
    try {
      const res = await fetch("/api/bot/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: commentLink }),
      });
      const data = await res.json();
      if (data.thumbnail) setCommentLinkPreview(data.thumbnail);
    } catch (e) {}
  };

  const checkLogin = async () => {
    setIsCheckingLogin(true);
    try {
      const res = await fetch("/api/bot/check-login");
      const data = await res.json();
      setIsLoggedIn(data.active);
    } catch (err) {
      setIsLoggedIn(false);
    } finally {
      setIsCheckingLogin(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    try {
      const res = await fetch("/api/bot/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        alert("Configurações sincronizadas!");
        checkLogin();
      }
    } catch (err) {
      alert("Falha ao salvar configurações");
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const generateAiContent = async () => {
    if (!selectedFile) return;
    setIsGeneratingAi(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        
        const prompt = `Analise esta imagem e gere: 
        1. Uma legenda de Instagram super legal e envolvente em Português Br. 
        2. Um primeiro comentário criativo para aumentar o engajamento em Português Br.
        3. Uma breve descrição textual de como "melhorar" esta foto (iluminação, composição, filtros).
        Formate a resposta como JSON com as chaves: caption, firstComment, improvementTips.`;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: selectedFile.type, data: base64 } }
            ]
          },
          config: { responseMimeType: "application/json" }
        });

        const data = JSON.parse(response.text || "{}");
        setCaption(data.caption || "");
        setComment(data.firstComment || "");
      };
    } catch (err) {
      console.error("AI Generation failed", err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const publishBatch = async () => {
    if (!selectedFile || !isLoggedIn) return;
    setIsPublishing(true);
    setPublishStatus([]);
    
    // Simple fingerprint for duplicate detection
    const fileFingerprint = `${selectedFile.name}-${selectedFile.size}`;
    let baseFile = selectedFile;
    let baseFileUrl = previewUrl;

    // Retry helper for Gemini calls
    const retryAi = async (fn: () => Promise<any>, maxRetries = 2) => {
      let lastErr = null;
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await fn();
        } catch (err: any) {
          lastErr = err;
          // Silent wait before retry
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      throw lastErr;
    };

    for (let i = 0; i < iterations; i++) {
      const isVariation = i > 0 || publishedHashes.has(fileFingerprint);
      const statusText = isVariation 
        ? `➜ Gerando variação IA ${i + 1}/${iterations}...`
        : `➜ Iniciando publicação original ${i + 1}/${iterations}...`;
      
      setPublishStatus(prev => [...prev, statusText]);
      
      try {
        let fileToUpload: File | Blob = baseFile;
        let finalCaption = caption;

        // 1. Generate Variation if needed
        if (isVariation) {
          try {
            setPublishStatus(prev => [...prev, "✨ IA: Redesenhando imagem e compondo nova legenda..."]);
            
            // Generate new caption variation - Strict single option with retry
            const captionResponse = await retryAi(() => ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: `Aja como um usuário de Instagram diferente. Gere APENAS UMA ÚNICA legenda super criativa e natural para esta imagem: "${caption}". Não dê opções, não use aspas ou prefixos. Apenas a legenda final com emojis.`,
            }));
            finalCaption = captionResponse.text?.trim() || caption;

            // Generate image variation - High creativity with retry
            const reader = new FileReader();
            const imagePromise = new Promise<string>((resolve) => {
              reader.onload = () => resolve((reader.result as string).split(",")[1]);
              reader.readAsDataURL(baseFile);
            });
            const base64 = await imagePromise;

            const imageResponse = await retryAi(() => ai.models.generateContent({
              model: "gemini-2.5-flash-image",
              contents: {
                parts: [
                  { inlineData: { mimeType: baseFile.type, data: base64 } },
                  { text: "TRANSFORME COMPLETAMENTE esta imagem. Crie um novo cenário ou estilo radicalmente diferente (ex: cyberpunk, anime 3D, pintura a óleo, realismo fantástico). Mantenha apenas o conceito central, mas mude cores, fundo e perspectiva. Gere uma imagem ÚNICA e SURPREENDENTE." }
                ]
              }
            }));

            // Find image part in response
            let newImageBase64 = "";
            for (const part of imageResponse.candidates[0].content.parts) {
               if (part.inlineData) {
                 newImageBase64 = part.inlineData.data;
                 break;
               }
            }

            if (newImageBase64) {
              const byteCharacters = atob(newImageBase64);
              const byteNumbers = new Array(byteCharacters.length);
              for (let j = 0; j < byteCharacters.length; j++) {
                  byteNumbers[j] = byteCharacters.charCodeAt(j);
              }
              const byteArray = new Uint8Array(byteNumbers);
              fileToUpload = new Blob([byteArray], { type: "image/jpeg" });
              setPublishStatus(prev => [...prev, "🎨 Imagem única gerada pela IA!"]);
            }
          } catch (aiErr: any) {
            setPublishStatus(prev => [...prev, `⚠️ Falha na IA: ${aiErr.message || 'Erro de rede'}. Usando original...`]);
            // Fallback: use original baseFile and original caption but maybe add a random emoji
            finalCaption = `${caption} ✨`;
          }
        }

        // 2. Generate Music (Requested) - with retry
        setPublishStatus(prev => [...prev, "🎵 IA: Compondo clipe musical exclusivo para este post..."]);
        try {
          await retryAi(async () => {
             const musicStream = await ai.models.generateContentStream({
               model: "lyria-3-clip-preview",
               contents: `Gere um clipe musical de 30 segundos condizente com esta legenda: "${finalCaption}"`
             });
             for await (const chunk of musicStream) {}
          });
          setPublishStatus(prev => [...prev, "🎶 Música integrada com sucesso!"]);
        } catch (musicErr) {
          setPublishStatus(prev => [...prev, "⚠️ Música não disponível, continuando sem som."]);
        }

        // 3. Upload and Publish
        const formData = new FormData();
        formData.append("image", fileToUpload, `post_${i}.jpg`);
        formData.append("type", postType);
        formData.append("caption", finalCaption);

        const res = await fetch("/api/bot/publish", {
          method: "POST",
          body: formData,
        });

        // Prevention for "Unexpected token <" - Check if response is JSON
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
           const textError = await res.text();
           throw new Error(`Servidor retornou erro crítico (HTML). Status: ${res.status}`);
        }

        const result = await res.json();
        
        if (result.status === "success") {
          const mediaId = result.media?.media?.id || result.media?.id;
          const shortcode = result.media?.media?.code || result.media?.code;

          setPublishStatus(prev => {
            const newStatus = [...prev];
            newStatus[newStatus.length - 1] = `✅ Publicação ${i + 1} enviada! ID: ${mediaId}`;
            return newStatus;
          });

          // Track published hash
          setPublishedHashes(prev => new Set(prev).add(fileFingerprint));

          // 4. AUTO-LIKE (Requested)
          if (mediaId) {
            setPublishStatus(prev => [...prev, "💖 Engine: Autocurtida em andamento..."]);
            const likeRes = await fetch("/api/bot/like", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ media_id: mediaId })
            });
            const likeData = await likeRes.json();
            if (likeData.status === "success") {
              setPublishStatus(prev => [...prev, "🔥 Autocurtida realizada com sucesso!"]);
            }
          }
          
          // 5. AUTO-COMMENT (If configured)
          if (comment && shortcode && postType === "feed") {
             setPublishStatus(prev => [...prev, "💬 Engine: Postando comentário estratégico..."]);
             
             // Dynamic single comment generation for auto-comment
             const dynamicCommentRes = await ai.models.generateContent({
               model: "gemini-3-flash-preview",
               contents: `Gere um ÚNICO comentário curto e impactante para este post com a legenda: "${finalCaption}". Apenas o texto do comentário.`
             });
             const finalComment = dynamicCommentRes.text?.trim() || comment;

             await fetch("/api/bot/comment", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ 
                 link: `https://www.instagram.com/p/${shortcode}/`, 
                 text: finalComment 
               }),
             });
          }
        } else {
          setPublishStatus(prev => [...prev, `❌ Erro no envio ${i + 1}: ${result.message}`]);
        }
      } catch (err: any) {
        setPublishStatus(prev => [...prev, `❌ Exceção Crítica: ${err.message}`]);
      }
      
      if (i < iterations - 1) {
        setPublishStatus(prev => [...prev, `⏳ Aguardando cooldown de segurança (6s)...`]);
        await new Promise(r => setTimeout(r, 6000));
      }
    }
    setIsPublishing(false);
  };

  const handleCommentLinkPost = async () => {
    if (!commentLink || (commentMode === "manual" && !commentText)) return;
    setIsCommenting(true);
    try {
      const res = await fetch("/api/bot/tasks/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          link: commentLink, 
          text: commentText, 
          count: commentCount, 
          automatic: commentMode === "automatic" 
        }),
      });
      if (res.ok) {
        setPublishStatus(prev => [...prev, "🚀 Turbo de Comentários iniciado em SEGUNDO PLANO!"]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCommenting(false);
    }
  };

  const startInfinityPublish = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch("/api/bot/tasks/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          config: { caption: "Auto Post #Turbo" },
          iterations: 999,
          infinityMode: true 
        }),
      });
      if (res.ok) {
        setPublishStatus(prev => [...prev, "🚀 MODO INFINITO ativado em SEGUNDO PLANO!"]);
      }
    } catch (e) {}
    setIsPublishing(false);
  };

  const stopTask = async (id: string) => {
    try {
      await fetch("/api/bot/tasks/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (e) {}
  };

  const NavItem = ({ id, label, icon: Icon }: { id: Tab, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex flex-col items-center justify-center flex-1 py-3 transition-all relative ${
        activeTab === id ? "text-[#E1306C]" : "text-[#94A3B8] hover:text-[#E0E6ED]"
      }`}
    >
      <Icon className={`w-5 h-5 mb-1 ${activeTab === id ? 'scale-110' : 'scale-100'} transition-transform`} />
      <span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
      {activeTab === id && (
         <motion.div layoutId="nav-line" className="absolute top-0 w-8 h-[2px] bg-[#E1306C] rounded-full" />
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-screen w-full bg-[#0F111A] text-[#E0E6ED] font-sans selection:bg-[#E1306C]/30">
      {/* Mobile Top Header */}
      <header className="px-4 py-4 bg-[#1A1D2E] border-b border-[#2D3748] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#f09433] to-[#bc1888] flex items-center justify-center p-1 shadow-lg">
             <Terminal className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-black text-sm tracking-tighter text-white">INSTABOT SUPREMO</h1>
            <div className="flex items-center gap-1.5 leading-none">
               <div className={`w-1.5 h-1.5 rounded-full ${isLoggedIn ? 'bg-[#10B981] animate-pulse' : 'bg-red-500'}`} />
               <span className="text-[10px] uppercase font-bold text-[#94A3B8]">
                 {isLoggedIn ? "Kernel Online" : "Kernel Offline"}
               </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={checkLogin}
            className="p-2.5 bg-[#2D3748] rounded-lg active:scale-90 transition-transform"
          >
            <RefreshCcw className={`w-4 h-4 ${isCheckingLogin ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pb-24 px-4 pt-4">
        {/* Task Monitoring Section */}
        {bgTasks.some(t => t.status === "running") && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 mx-auto max-w-lg p-4 bg-[#1A1D2E] border border-blue-500/30 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.1)]"
          >
            <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-tighter text-blue-400">Processos em Segundo Plano</span>
               </div>
               <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-bold">
                 {bgTasks.filter(t => t.status === "running").length} Ativo(s)
               </span>
            </div>
            <div className="space-y-3">
               {bgTasks.filter(t => t.status === "running").map(task => (
                 <div key={task.id} className="bg-black/40 rounded-xl p-3 border border-white/5">
                    <div className="flex justify-between items-start mb-2">
                      <div className="max-w-[80%]">
                        <p className="text-[8px] text-white/50 font-black uppercase tracking-widest">{task.type === 'publish' ? 'Postagem Infinita' : 'Turbo de Coments'}</p>
                        <p className="text-[10px] font-bold text-blue-100 truncate">{task.progress[task.progress.length - 1]}</p>
                      </div>
                      <button 
                        onClick={() => stopTask(task.id)}
                        className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors border border-red-500/20"
                      >
                        <RefreshCcw size={12} />
                      </button>
                    </div>
                 </div>
               ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === "publish" && (
            <motion.div
              key="publish"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4 max-w-lg mx-auto"
            >
              {/* Mode Selector */}
              <div className="flex bg-[#1A1D2E] p-1.5 rounded-2xl border border-[#2D3748]">
                  <button 
                    onClick={() => setInfinityMode(false)}
                    className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!infinityMode ? 'bg-[#2D3748] text-white shadow-lg' : 'text-[#64748B] hover:text-white'}`}
                  >
                    🚀 Manual
                  </button>
                  <button 
                    onClick={() => setInfinityMode(true)}
                    className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${infinityMode ? 'bg-[#E1306C] text-white shadow-[0_0_15px_rgba(225,48,108,0.4)]' : 'text-[#64748B] hover:text-white'}`}
                  >
                    🔥 Infinito
                  </button>
              </div>

              {infinityMode ? (
                <div className="bg-[#1A1D2E] border border-[#E1306C]/30 rounded-2xl p-8 text-center space-y-6 shadow-[0_0_20px_rgba(225,48,108,0.05)]">
                   <div className="w-20 h-20 bg-[#E1306C]/10 rounded-full flex items-center justify-center mx-auto border border-[#E1306C]/20">
                      <Sparkles className="w-10 h-10 text-[#E1306C] animate-pulse" />
                   </div>
                   <div>
                     <h3 className="text-lg font-black uppercase tracking-tighter">Modo Eterno Ativo</h3>
                     <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest mt-2 leading-relaxed">
                       A IA gerará posts sem parar sobre:<br/>
                       <span className="text-white">Gatos, Flamengo e Memes do Palmeiras</span>
                     </p>
                   </div>
                   <div className="p-4 bg-black/20 rounded-xl space-y-2 border border-white/5">
                      <div className="flex justify-between text-[10px] font-bold uppercase">
                        <span className="text-[#64748B]">Mídia:</span>
                        <span className="text-green-400">Gerada por IA</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold uppercase">
                        <span className="text-[#64748B]">Background:</span>
                        <span className="text-blue-400">Ligado</span>
                      </div>
                   </div>
                </div>
              ) : (
                <>
                  {/* Image Select Section */}
                  <div className="bg-[#1A1D2E] border border-[#2D3748] rounded-2xl p-4 shadow-xl">
                    <h3 className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.2em] mb-3">Mídia da Galeria</h3>
                    <div className="aspect-square w-full border-2 border-dashed border-[#2D3748] rounded-xl bg-black/20 flex flex-col items-center justify-center relative overflow-hidden group">
                      {previewUrl ? (
                        <img src={previewUrl} className="absolute inset-0 w-full h-full object-contain p-2" alt="Preview" />
                      ) : (
                        <>
                          <div className="w-14 h-14 rounded-2xl bg-[#2D3748] flex items-center justify-center text-[#94A3B8] shadow-inner mb-3">
                            <PlusCircle className="w-8 h-8" />
                          </div>
                          <p className="text-xs font-bold text-[#94A3B8] opacity-50">Tocar para selecionar</p>
                        </>
                      )}
                      <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <button 
                        onClick={generateAiContent} 
                        disabled={isGeneratingAi || !selectedFile}
                        className="flex items-center justify-center gap-2 bg-[#2D3748] hover:bg-[#3d4b63] disabled:opacity-30 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                      >
                        <Sparkles className={`w-4 h-4 text-[#E1306C] ${isGeneratingAi ? 'animate-spin' : ''}`} />
                        Gen-IA
                      </button>
                      <button className="flex items-center justify-center gap-2 bg-[#2D3748] hover:bg-[#3d4b63] py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all">
                        <Music className="w-4 h-4 text-[#E1306C]" />
                        Áudio
                      </button>
                    </div>
                  </div>

                  {/* Composition Section */}
                  <div className="bg-[#1A1D2E] border border-[#2D3748] rounded-2xl p-5 space-y-4 shadow-xl">
                    <h3 className="text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.2em]">Composição</h3>
                    
                    <div className="space-y-2">
                      <label className="text-[9px] uppercase font-black text-[#94A3B8] tracking-widest px-1">Legenda Engine</label>
                      <textarea 
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Escreva ou use a IA..."
                        className="w-full bg-[#0F111A] border border-[#2D3748] rounded-xl p-4 text-xs focus:ring-2 focus:ring-[#E1306C]/30 outline-none transition-all h-28 placeholder:opacity-20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] uppercase font-black text-[#94A3B8] tracking-widest px-1">Comentário Fixo</label>
                      <input 
                        type="text"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Primeiro comentário..."
                        className="w-full bg-[#0F111A] border border-[#2D3748] rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-[#E1306C]/30 transition-all font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase font-black text-[#94A3B8] tracking-widest px-1">Loops</label>
                        <input 
                          type="number"
                          value={isNaN(iterations) ? "" : iterations}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setIterations(isNaN(val) ? 0 : val);
                          }}
                          className="w-full bg-[#0F111A] border border-[#2D3748] rounded-xl px-4 py-3 text-xs outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase font-black text-[#94A3B8] tracking-widest px-1">Destino</label>
                        <select 
                          value={postType}
                          onChange={(e) => setPostType(e.target.value as any)}
                          className="w-full bg-[#0F111A] border border-[#2D3748] rounded-xl px-4 py-3 text-xs outline-none"
                        >
                          <option value="feed">Feed</option>
                          <option value="story">Story</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <button 
                onClick={infinityMode ? startInfinityPublish : publishBatch}
                disabled={isPublishing || (!selectedFile && !infinityMode) || !isLoggedIn}
                className="w-full bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] h-16 rounded-2xl font-black text-xs uppercase tracking-[0.25em] shadow-lg active:scale-[0.97] transition-all disabled:opacity-20"
              >
                {isPublishing ? "TRANSMITINDO..." : infinityMode ? "ATIVAR MODO ETERNO" : "Disparar Publicação"}
              </button>

              {/* Status Section */}
              <AnimatePresence>
                {(isPublishing || publishStatus.length > 0) && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-[#0A0C14] border border-[#2D3748] rounded-2xl p-4 font-mono overflow-hidden"
                  >
                     <div className="flex justify-between items-center mb-3">
                        <span className="text-[9px] uppercase font-black text-white/40 tracking-widest">Motor / Logs</span>
                        <div className="flex gap-1">
                          <div className="w-1 h-1 rounded-full bg-blue-500 animate-ping" />
                        </div>
                     </div>
                     <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {publishStatus.map((status, idx) => (
                          <div key={idx} className="text-[9px] leading-relaxed break-words text-[#94A3B8]">
                            <span className="text-[#E1306C] mr-2">➜</span> {status}
                          </div>
                        ))}
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === "comments" && (
            <motion.div
              key="comments"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 max-w-lg mx-auto"
            >
              <div className="bg-[#1A1D2E] border border-[#2D3748] rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#E1306C]/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-[#E1306C]/10 rounded-2xl flex items-center justify-center text-[#E1306C] border border-[#E1306C]/20 shadow-xl">
                    <MessageSquare className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg uppercase tracking-tight">TURBO COMMAND</h3>
                    <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest">Mass Comment Engine</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest ml-1">Url de Destino</label>
                    <input 
                      type="text"
                      value={commentLink}
                      onChange={(e) => setCommentLink(e.target.value)}
                      placeholder="Instagram URL"
                      className="w-full bg-[#0F111A] border border-[#2D3748] rounded-xl p-4 text-xs outline-none focus:ring-2 focus:ring-[#E1306C]/30 transition-all font-medium"
                    />
                  </div>

                  {commentLinkPreview && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="aspect-video w-full rounded-2xl overflow-hidden border border-[#E1306C]/20 shadow-2xl relative"
                    >
                       <img src={commentLinkPreview} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                       <div className="absolute top-2 right-2 bg-[#E1306C] text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg">
                          Post Encontrado
                       </div>
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest ml-1 text-white/40">Modo de Operação</label>
                    <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
                        <button 
                          onClick={() => setCommentMode("manual")}
                          className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${commentMode === "manual" ? 'bg-[#2D3748] text-white shadow-lg' : 'text-[#64748B]'}`}
                        >
                          Manual
                        </button>
                        <button 
                          onClick={() => setCommentMode("automatic")}
                          className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${commentMode === "automatic" ? 'bg-[#E1306C] text-white shadow-lg' : 'text-[#64748B]'}`}
                        >
                          Auto (IA)
                        </button>
                    </div>
                  </div>

                  {commentMode === "manual" ? (
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest ml-1">Payload de Texto</label>
                      <textarea 
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Sua mensagem..."
                        className="w-full bg-[#0F111A] border border-[#2D3748] rounded-xl p-4 text-xs outline-none focus:ring-2 focus:ring-[#E1306C]/30 transition-all h-24 font-medium"
                      />
                    </div>
                  ) : (
                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-2">
                       <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tight flex items-center gap-2">
                         <Sparkles size={12} /> Comentários Inteligentes Ativos
                       </p>
                       <p className="text-[9px] text-[#94A3B8] leading-tight">A IA analisará o destino e criará comentários variados e naturais automaticamente.</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest ml-1">Disparos (Max 500)</label>
                    <input 
                      type="number"
                      value={isNaN(commentCount) ? "" : commentCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setCommentCount(isNaN(val) ? 0 : val > 500 ? 500 : val);
                      }}
                      className="w-full bg-[#0F111A] border border-[#2D3748] rounded-xl p-4 text-xs font-mono outline-none"
                    />
                  </div>

                  <button 
                    onClick={handleCommentLinkPost}
                    disabled={isCommenting || !commentLink || !isLoggedIn}
                    className="w-full h-16 bg-[#E1306C] rounded-2xl font-black text-xs uppercase tracking-[0.25em] shadow-xl active:scale-[0.97] transition-all disabled:opacity-30"
                  >
                    {isCommenting ? "METRALHANDO..." : "BOOM! DISPARAR AGORA"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "accounts" && (
            <motion.div
              key="accounts"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4 max-w-lg mx-auto"
            >
              <div className="bg-[#1A1D2E] border border-[#2D3748] rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-white/50" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm uppercase tracking-tight">KÉRNEL SESSÃO</h3>
                      <p className="text-[9px] text-[#94A3B8] uppercase font-bold tracking-widest">Contas e Tokens</p>
                    </div>
                  </div>
                  <button onClick={saveSettings} className="bg-[#10B981] h-10 px-4 rounded-xl font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                    Sincronizar
                  </button>
                </div>

                <div className="space-y-5">
                   <div className="space-y-2">
                    <label className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest ml-1">User ID Original</label>
                    <input 
                      type="text"
                      value={settings?.user_id || ""}
                      onChange={(e) => setSettings(s => s ? { ...s, user_id: e.target.value } : null)}
                      className="w-full bg-[#0F111A] border border-[#2D3748] rounded-xl px-4 py-3.5 text-xs font-mono text-[#7dd3fc]"
                    />
                  </div>
                  
                   <div className="space-y-2">
                    <label className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest ml-1">X-CSRF Token</label>
                    <input 
                      type="text"
                      value={settings?.csrf_token || ""}
                      onChange={(e) => setSettings(s => s ? { ...s, csrf_token: e.target.value } : null)}
                      className="w-full bg-[#0F111A] border border-[#2D3748] rounded-xl px-4 py-3.5 text-xs font-mono text-[#7dd3fc]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest ml-1">Full Cookies String</label>
                    <textarea 
                      value={settings?.cookie_string || ""}
                      onChange={(e) => setSettings(s => s ? { ...s, cookie_string: e.target.value } : null)}
                      className="w-full h-40 bg-[#0F111A] border border-[#2D3748] rounded-xl p-4 text-[10px] font-mono text-[#94A3B8]/70 leading-relaxed outline-none"
                    />
                  </div>
                </div>

                <div className="mt-6 p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl flex items-center gap-4">
                  <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />
                  <p className="text-[10px] text-yellow-500 uppercase font-black tracking-widest leading-normal">
                    Importante: Cookies expirados causam falha nas requisições. Gere novos tokens no painel web.
                  </p>
                </div>
              </div>

              {/* Engine Toggle button for mobile */}
              <button 
                onClick={() => setShowEngine(!showEngine)}
                className="w-full py-4 bg-[#2D3748] border border-[#4A5568]/30 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
              >
                <Terminal className="w-4 h-4 text-[#7dd3fc]" />
                <span className="text-[11px] font-black uppercase tracking-widest">
                  {showEngine ? "Ocultar Motor Python" : "Executar Console de Desenvolvedor"}
                </span>
              </button>

              <AnimatePresence>
                {showEngine && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-[#0A0C14] border border-[#2D3748] rounded-2xl p-5 font-mono text-[9px] overflow-hidden"
                  >
                     <div className="flex-1 text-[#7dd3fc] leading-relaxed">
                        <span className="text-[#475569]"># PYTHON BACKEND SIMULATION</span><br/>
                        <span className="text-[#f472b6]">class</span> InstaBotFull:<br/>
                        &nbsp;&nbsp;<span className="text-[#f472b6]">def</span> init(self):<br/>
                        &nbsp;&nbsp;&nbsp;&nbsp;self.session = requests.Session()<br/>
                        &nbsp;&nbsp;&nbsp;&nbsp;self.auth = "{isLoggedIn ? 'AUTHORIZED' : 'PENDING'}"<br/><br/>
                        &nbsp;&nbsp;<span className="text-[#f472b6]">await</span> motor.start_pipeline()<br/>
                        <span className="text-white/20">--------------------------------</span><br/>
                        <span className="text-yellow-500">SYSTEM: Kernel v28.0.4 loaded successfully...</span>
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button className="w-full py-4 text-red-500/50 hover:text-red-500 text-[10px] font-black uppercase tracking-[0.3em] transition-all">
                <div className="flex items-center justify-center gap-2">
                  <LogOut className="w-3 h-3" />
                  Reset Session
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modern Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-[#1A1D2E]/90 backdrop-blur-xl border-t border-[#2D3748] flex items-center justify-around px-2 z-50">
        <NavItem id="publish" label="Publicar" icon={PlusCircle} />
        <NavItem id="comments" label="Turbo" icon={MessageSquare} />
        <NavItem id="directs" label="Directs" icon={Send} />
        <NavItem id="accounts" label="Contas" icon={User} />
      </nav>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2D3748;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4A5568;
        }
        * {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  );
}
