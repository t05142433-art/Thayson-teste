import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import axios from "axios";
import sharp from "sharp";
import FormData from "form-data";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY || GEMINI_KEY === "MY_GEMINI_API_KEY") {
    console.warn("⚠️ ALERTA: GEMINI_API_KEY não detectada ou inválida. Por favor, adicione sua chave nas Configurações (Settings) do AI Studio.");
}
const ai = new GoogleGenerativeAI(GEMINI_KEY && GEMINI_KEY !== "MY_GEMINI_API_KEY" ? GEMINI_KEY : "DUMMY_KEY");

interface Task {
    id: string;
    type: "publish" | "comment";
    status: "running" | "completed" | "error";
    progress: string[];
    config: any;
    startTime: number;
}

const tasks: Record<string, Task> = {};
const publishedImageHashes = new Set<string>();

// Helper for wait in background
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Infinite Mode Themes
const THEMES = [
    "BMW M4 esportiva acelerando na chuva à noite com luzes neon e reflexos",
    "Mercedes-Benz AMG de luxo em alta velocidade na rodovia tom de chuva",
    "Carros de corrida de Fórmula 1 em disputa cinematográfica na pista molhada",
    "Super carros tunados e rebaixados em cenário urbano chuvoso e sombrio",
    "Mercedes G63 AMG atravessando poças de água em estilo cinematic racing",
    "BMW e Mercedes em racha noturno com clima de tempestade e adrenalina",
    "Gatos fofos fazendo coisas engraçadas e fofas",
    "Flamengo o maior do mundo, mengão, raca amore e paixao",
    "Memes zoando rivais do futebol brasileiro engraçados",
    "Paisagens futuristas de cidades cyberpunk chuvosas",
    "Toyota Supra MK4 soltando fogo pelo escapamento drift",
    "Nissan Skyline R34 azul em garagem japonesa tradicional",
    "Lamborghini Aventador amarela em Dubai à noite",
    "Ferrari LaFerrari vermelha cortando o trânsito da Europa",
    "Porsche 911 GT3 RS em pista de corrida famosa Nurburgring",
    "Audi R8 Spyder v10 acelerando em túnel som alto",
    "Carros antigos clássicos restaurados em estilo vintage",
    "Interior de carro de luxo com painel digital iluminado",
    "Roda de carro esportivo girando em alta velocidade",
    "Drift cinematográfico com muita fumaça e luzes"
];

const BACKUP_COMMENTS = [
    "Foguete não tem ré! 🚀", "Máquina de guerra! 🔥", "Simplesmente épico visual! 🏎️",
    "O brabo tem nome! 💎", "Respeita o projeto! 🛠️", "Velocidade é arte! 🎨",
    "Sonho de consumo total! 😍", "Deu aula agora! 📈", "A meta é essa! 🏁",
    "Incrível demais essa nave! 🛸", "Top demais irmão! 👊", "Sem palavras pra isso! 🤐",
    "Que registro sensacional! 📸", "Potência pura! 💪", "Estilo e performance! 🌪️",
    "O melhor que temos! 👑", "Brabo demais! 🔥🏎️", "Coisa de maluco! 🤯",
    "Sensacional essa BMW! 💎", "Mercedes no estilo! 🌟", "Vou ter uma dessa! 🙏",
    "Deixa os likes voarem! ❤️", "Acelera que o tempo voa! ⏳", "No topo sempre! 🔋",
    "Visual agressivo demais! 🐯", "Perfeito em cada detalhe! 👌", "Ficou pesado esse video! 🐘",
    "Zerei a vida com esse post! 🎮", "Top 1 do mundo! 🏆", "Isso é vida! 🌊"
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

const SESSION_FILE = path.join(__dirname, "bot_session.json");

// In-memory storage for bot settings
let botSettings = {
    user_id: "80209457261",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    lsd_token: "5vO96BLhgv3VQMlbaWzQ6Y",
    fb_dtsg: "NAfuZknNCOtoS_tp7aDPLDpd6e-4hWIEElFI2CQO_FVzLSkKEmeNa4Q:17864789131057511:1776026917",
    jazoest: "26197",
    csrf_token: "evbfFA2Ql2raMA2hNvUqI3DkFEXyx5V1",
    doc_id: "26232567166401842",
    bloks_id: "f0fd53409d7667526e529854656fe20159af8b76db89f40c333e593b51a2ce10",
    ajax_rev: "1037177439",
    cookie_string: 'datr=vozQaZ9FTfSuYSDOh8c3S56v; ig_did=0A7CD33E-D3EC-401D-9761-77259A2493C3; ps_l=1; ps_n=1; dpr=2.206249952316284; mid=adFo6AABAAG5tAitm_wsuvQy4hMH; csrftoken=evbfFA2Ql2raMA2hNvUqI3DkFEXyx5V1; ds_user_id=80209457261; sessionid=80209457261%3AxBOsuFTw8plBk5%3A20%3AAYjHVpoyUm__UQN7cpVyLu238h3r3w-cIxyhsnuB6A; wd=489x920; rur="FRC\\05480209457261\\0541807930682:01fe54421beab7f01566abe25d980098a5636faba301cc7269fc6c076bf0c31f6e18079c"'
};

// Load saved session
if (fs.existsSync(SESSION_FILE)) {
    try {
        const saved = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
        botSettings = { ...botSettings, ...saved };
        console.log("✅ Sessão carregada do disco!");
    } catch (e) {
        console.error("❌ Falha ao carregar sessão");
    }
}

function saveSession() {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(botSettings, null, 2));
}

const getHeaders = () => {
    return {
        "User-Agent": botSettings.user_agent,
        "Accept": "*/*",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "X-IG-App-ID": "1217981644879628",
        "X-FB-LSD": botSettings.lsd_token,
        "X-ASBD-ID": "129477",
        "X-CSRFToken": botSettings.csrf_token,
        "X-Bloks-Version-Id": botSettings.bloks_id,
        "X-Instagram-AJAX": botSettings.ajax_rev,
        "X-Web-Session-Id": `eslgsg:hl3nz7:${Math.floor(Math.random() * 900) + 100}hez`,
        "X-IG-WWW-Claim": "0",
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": botSettings.cookie_string,
        "Origin": "https://www.instagram.com",
        "Referer": "https://www.instagram.com/",
        "Content-Type": "application/x-www-form-urlencoded"
    };
};

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get("/api/bot/tasks/status", (req, res) => {
    res.json(Object.values(tasks));
});

app.post("/api/bot/tasks/stop", (req, res) => {
    const { id } = req.body;
    if (tasks[id]) {
        tasks[id].status = "completed";
        tasks[id].progress.push("⛔ Interrupção solicitada pelo usuário.");
    }
    res.json({ status: "ok" });
});

// API Routes
function getShortcode(url: string) {
    const match = url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : url;
}

function getMediaId(url: string) {
    if (!url) return "";
    const cleanUrl = url.trim();
    if (/^\d+(_\d+)?$/.test(cleanUrl)) {
        return cleanUrl.split("_")[0];
    }
    try {
        const shortcode = getShortcode(cleanUrl);
        if (/^\d+(_\d+)?$/.test(shortcode)) {
            return shortcode.split("_")[0];
        }
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        let idNum = BigInt(0);
        for (let i = 0; i < shortcode.length; i++) {
            const idx = alphabet.indexOf(shortcode[i]);
            if (idx === -1) continue;
            idNum = (idNum * BigInt(64)) + BigInt(idx);
        }
        return idNum.toString();
    } catch {
        return cleanUrl.split("_")[0];
    }
}

app.post("/api/bot/preview", async (req, res) => {
    const { link } = req.body;
    try {
        const shortcode = getShortcode(link);
        const url = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
        const headers = {
            ...getHeaders(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "X-Requested-With": undefined,
            "Content-Type": undefined
        };
        const response = await axios.get(url, { headers, timeout: 5000 });
        const media = response.data.graphql?.shortcode_media || response.data.items?.[0];
        const thumbnail = media?.display_url || media?.image_versions2?.candidates?.[0]?.url;
        res.json({ thumbnail });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch preview" });
    }
});

app.post("/api/bot/tasks/publish", async (req, res) => {
    const { config, iterations, infinityMode } = req.body;
    const taskId = `task_${Date.now()}`;
    
    tasks[taskId] = {
        id: taskId,
        type: "publish",
        status: "running",
        progress: ["🚀 Inicializando Motor em Segundo Plano..."],
        config: { ...config, iterations, infinityMode },
        startTime: Date.now()
    };

    // Response immediately to client
    res.json({ taskId });

    // Run in background
    (async () => {
        const task = tasks[taskId];
        try {
            const count = infinityMode ? 9999 : iterations;
            const publishedHashes = new Set<string>();

            for (let i = 0; i < count; i++) {
                if (task.status !== "running") break;

                let currentCaption = config.caption;
                let currentFileBuffer: Buffer | null = null;
                let currentTheme = "Carros esportivos na chuva"; // Default

                if (infinityMode) {
                    currentTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
                    task.progress.push(`🎨 Preparando postagem (Tema: ${currentTheme})...`);
                    
                    try {
                        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
                        const genResponse = await model.generateContent(
                            `Gere uma legenda ÚNICA, impactante e curta em Português para um post do Instagram sobre: ${currentTheme}. Use emojis. Apenas o texto.`
                        );
                        currentCaption = genResponse.response.text().trim() || "Post Automático #Turbo";

                        const keywords = currentTheme.split(" ").slice(0, 3).join(",");
                        const imgUrl = `https://loremflickr.com/1080/1080/${encodeURIComponent(keywords)}?lock=${Math.random().toString(36).substring(7)}`;
                        const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 15000 });
                        currentFileBuffer = Buffer.from(imgRes.data);
                        task.progress.push(`✨ Conteúdo exclusivo gerado!`);
                    } catch (e) {
                        task.progress.push(`⚠️ Backup ativado: Gerando conteúdo alternativo...`);
                        currentCaption = `Explorando: ${currentTheme} 🏎️💨 #Turbo #Automotivo`;
                        const keywordsBackup = currentTheme.split(" ").slice(0, 2).join(",");
                        const imgRes = await axios.get(`https://loremflickr.com/1080/1080/${encodeURIComponent(keywordsBackup)}?lock=${Math.random()}`, { responseType: 'arraybuffer', timeout: 15000 });
                        currentFileBuffer = Buffer.from(imgRes.data);
                    }
                } else {
                    // Logic for normal mode with specific file would need to be passed differently 
                    // since we are in background. For now, focus on Infinity Mode for background.
                    if (i === 0) task.progress.push("ℹ️ Modo específico requer client-side upload por enquanto.");
                    break;
                }

                if (currentFileBuffer) {
                    const imgHash = crypto.createHash('md5').update(currentFileBuffer).digest('hex');
                    if (publishedImageHashes.has(imgHash)) {
                        task.progress.push("🔄 Imagem duplicada detectada, tentando buscar outra...");
                        i--; // Try this iteration again
                        await wait(1000);
                        continue;
                    }

                    const uploadId = Date.now().toString();
                    const imgBuffer = await sharp(currentFileBuffer)
                        .resize(1080, 1080, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
                        .jpeg({ quality: 90 }).toBuffer();

                    const upHeaders: any = {
                        ...getHeaders(),
                        "Offset": "0", "X-Entity-Type": "image/jpeg",
                        "X-Entity-Name": `fb_uploader_${uploadId}`,
                        "X-Entity-Length": imgBuffer.length.toString(),
                        "Content-Type": "image/jpeg",
                        "X-Instagram-Rupload-Params": JSON.stringify({
                            media_type: "1", upload_id: uploadId, upload_media_height: "1080", upload_media_width: "1080"
                        })
                    };

                    const upRes = await axios.post(`https://i.instagram.com/rupload_igphoto/fb_uploader_${uploadId}`, imgBuffer, { headers: upHeaders });
                    
                    if (upRes.status === 200) {
                        const endpoint = "https://i.instagram.com/api/v1/media/configure/";
                        const payload = {
                            "caption": currentCaption,
                            "clips_share_preview_to_feed": "1",
                            "disable_comments": "0",
                            "igtv_share_preview_to_feed": "1",
                            "is_meta_only_post": "0",
                            "is_unified_video": "1",
                            "like_and_view_counts_disabled": "0",
                            "media_share_flow": "creation_flow",
                            "share_to_facebook": "",
                            "share_to_fb_destination_id": "",
                            "share_to_fb_destination_type": "USER",
                            "source_type": "library",
                            "upload_id": uploadId,
                            "video_subtitles_enabled": "0",
                            "jazoest": "22895"
                        };

                        const pubRes = await axios.post(endpoint, new URLSearchParams(payload), { headers: getHeaders() });
                        if (pubRes.data.status === "ok") {
                            publishedImageHashes.add(imgHash);
                            const mediaId = pubRes.data.media?.id || pubRes.data.id;
                            const msg = `✅ Post ${i+1} enviado com sucesso! ID: ${mediaId}`;
                            task.progress.push(msg);
                            console.log(msg);
                            
                            if (mediaId) {
                                // 💖 AUTO-LIKE Own Post
                                try {
                                    const hLike = getHeaders();
                                    const likeData = new URLSearchParams({
                                        "fb_dtsg": botSettings.fb_dtsg,
                                        "jazoest": botSettings.jazoest
                                    });
                                    await axios.post(`https://www.instagram.com/api/v1/web/likes/${mediaId}/like/`, likeData, { headers: hLike });
                                    task.progress.push(`💖 Autocurtida realizada no post ${i+1}`);
                                } catch (le: any) {
                                    console.error("Erro no Like Post:", le.response?.data || le.message);
                                }

                                // 💬 AUTO-COMMENT with unique AI content
                                if (infinityMode) {
                                    try {
                                        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
                                        const aiRes = await model.generateContent(
                                            `Escreva um comentário curto, épico e natural em Português para uma foto de ${currentTheme}. Use emojis. Apenas o texto.`
                                        );
                                        const dynamicComment = aiRes.response.text().trim() || "Foguete não tem ré! 🚀";
                                        
                                        const commentVar = {
                                            "media_id": mediaId,
                                            "comment_text": dynamicComment,
                                            "container_module": "feed_timeline"
                                        };
                                        const commentData = new URLSearchParams({
                                            "av": botSettings.user_id, "__d": "www", "__user": "0", "__a": "1", "__req": "29",
                                            "fb_dtsg": botSettings.fb_dtsg, "jazoest": botSettings.jazoest, "lsd": botSettings.lsd_token,
                                            "variables": JSON.stringify(commentVar), "doc_id": "8531113036984361"
                                        });
                                        try {
                                            const commentBody = new URLSearchParams({
                                                "comment_text": dynamicComment,
                                                "replied_to_comment_id": "",
                                                "fb_dtsg": botSettings.fb_dtsg,
                                                "jazoest": botSettings.jazoest
                                            });
                                            const hCom = getHeaders();
                                            await axios.post(`https://www.instagram.com/api/v1/web/comments/${mediaId}/add/`, commentBody, { headers: hCom });
                                            task.progress.push(`💬 Autocomentário inteligente enviado!`);
                                        } catch (ce: any) {
                                            const isApiKeyErr = ce.message?.includes("API key not valid") || ce.response?.data?.message?.includes("API key not valid");
                                            const fallbackComment = BACKUP_COMMENTS[Math.floor(Math.random() * BACKUP_COMMENTS.length)];
                                            
                                            if (isApiKeyErr) {
                                                console.warn("⚠️ ALERTA: GEMINI_API_KEY no Settings está inválida. Usando Backup.");
                                                task.progress.push(`⚠️ Usando comentário de backup (Chave Gemini inválida).`);
                                            } else {
                                                console.error("Erro no Comentário IA:", ce.response?.data || ce.message);
                                                task.progress.push(`⚠️ Falha na IA, usando Backup.`);
                                            }

                                            try {
                                                const backBody = new URLSearchParams({ 
                                                    "comment_text": fallbackComment,
                                                    "fb_dtsg": botSettings.fb_dtsg,
                                                    "jazoest": botSettings.jazoest
                                                });
                                                await axios.post(`https://www.instagram.com/api/v1/web/comments/${mediaId}/add/`, backBody, { headers: getHeaders() });
                                                task.progress.push(`💬 Comentário de backup enviado!`);
                                            } catch (bcErr: any) {
                                                console.error("Falha fatal no comentário de backup:", bcErr.response?.data || bcErr.message);
                                            }
                                        }
                                }
                            }
                        } else {
                            task.progress.push(`❌ Falha no post ${i+1}: ${JSON.stringify(pubRes.data)}`);
                        }
                    } else {
                        task.progress.push(`❌ Falha no upload ${i+1}`);
                    }
                }

                await wait(infinityMode ? 1000 : 5000); // 1s delay for infinity as requested
            }
            task.status = "completed";
        } catch (err: any) {
            task.status = "error";
            task.progress.push(`🔥 Erro Fatal: ${err.message}`);
        }
    })();
});

app.post("/api/bot/tasks/comment", async (req, res) => {
    const { link, text, count, automatic } = req.body;
    const taskId = `comment_${Date.now()}`;
    
    tasks[taskId] = {
        id: taskId,
        type: "comment",
        status: "running",
        progress: [`🚀 Turbo de Comentários iniciado (${automatic ? 'IA' : 'Manual'})...`],
        config: { link, text, count, automatic },
        startTime: Date.now()
    };

    res.json({ taskId });

    (async () => {
        const task = tasks[taskId];
        try {
            const mediaId = getMediaId(link);
            task.progress.push(`🎯 Alvo detectado: ${mediaId}`);
            
            for (let i = 0; i < count; i++) {
                if (task.status !== "running") break;
                
                let commentText = text;
                if (automatic) {
                    try {
                        const aiRes = await ai.getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent(
                            "Gere um comentário curto, engraçado e natural em Português para uma foto aleatória de Instagram. Apenas o texto. Use emojis."
                        );
                        commentText = aiRes.response.text().trim();
                    } catch (e: any) {
                        const isApiKeyErr = e.message?.includes("API key not valid") || e.response?.data?.message?.includes("API key not valid");
                        if (isApiKeyErr) {
                            console.error("❌ ERRO: Sua GEMINI_API_KEY no Settings está inválida.");
                        }
                        commentText = BACKUP_COMMENTS[Math.floor(Math.random() * BACKUP_COMMENTS.length)];
                    }
                } else {
                    commentText = `${text} ${Math.floor(Math.random() * 999)}`;
                }

                task.progress.push(`💬 Enviando comentário ${i + 1}/${count}...`);

                try {
                    const turboBody = new URLSearchParams({ 
                        "comment_text": commentText,
                        "fb_dtsg": botSettings.fb_dtsg,
                        "jazoest": botSettings.jazoest
                    });
                    const turboHeaders = getHeaders();
                    const commentRes = await axios.post(`https://www.instagram.com/api/v1/web/comments/${mediaId}/add/`, turboBody, { headers: turboHeaders });
                    
                    const msgCom = `✅ Comentário ${i+1}/${count} enviado.`;
                    task.progress.push(msgCom);
                    console.log(msgCom);

                    // 💖 AUTO-LIKE THE COMMENT
                    if (commentRes.status === 200) {
                        try {
                            const newCommentId = commentRes.data.id || commentRes.data.comment?.id;
                            if (newCommentId) {
                                const hL = getHeaders();
                                const likeComData = new URLSearchParams({
                                    "fb_dtsg": botSettings.fb_dtsg,
                                    "jazoest": botSettings.jazoest
                                });
                                await axios.post(`https://www.instagram.com/api/v1/web/comments/${newCommentId}/like/`, likeComData, { headers: hL });
                                task.progress.push(`💖 Comentário ${i+1} curtido!`);
                            }
                        } catch (cl) {}
                    }
                } catch (ce: any) {
                    console.error("Erro no Turbo Comment:", ce.response?.data || ce.message);
                    task.progress.push(`⚠️ Falha no envio do comentário ${i+1}`);
                }

                await wait(50); // Nearly 0 delay for Turbo comments
            }
            task.status = "completed";
        } catch (err: any) {
            task.status = "error";
            task.progress.push(`🔥 Erro: ${err.message}`);
        }
    })();
});

app.get("/api/bot/settings", (req, res) => {
    res.json(botSettings);
});

app.post("/api/bot/settings", (req, res) => {
    botSettings = { ...botSettings, ...req.body };
    saveSession();
    res.json({ status: "ok", settings: botSettings });
});

app.get("/api/bot/check-login", async (req, res) => {
    try {
        const response = await axios.get("https://www.instagram.com/accounts/edit/?__a=1", {
            headers: getHeaders(),
            timeout: 10000,
            validateStatus: () => true,
            maxRedirects: 0
        });
        
        const dataStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        
        // Detailed check matching Python condition
        if (dataStr.includes("form_data") || response.status === 200 || dataStr.includes('"status":"ok"')) {
            res.json({ active: true, user_id: botSettings.user_id });
        } else if (dataStr.includes("checkpoint_required")) {
             console.log(`[Kernel Warning] Checkpoint detected!`);
             res.json({ active: false, reason: "checkpoint", message: "Verificação de segurança necessária no app do Instagram" });
        } else {
            console.log(`[Kernel Offline] Status: ${response.status}`);
            res.json({ active: false, status: response.status, snippet: dataStr.substring(0, 200) });
        }
    } catch (error: any) {
        console.error(`[Login Error] ${error.message}`);
        res.json({ active: false, error: error.message });
    }
});

function getShortcodeId(url: string) {
    return getMediaId(url);
}

app.post("/api/bot/comment", async (req, res) => {
    const { link, text } = req.body;
    const mediaId = getMediaId(link);
    if (!mediaId) return res.status(400).json({ error: "No media_id found" });
    
    try {
        const body = new URLSearchParams({ 
            "comment_text": text,
            "fb_dtsg": botSettings.fb_dtsg,
            "jazoest": botSettings.jazoest
        });
        const response = await axios.post(`https://www.instagram.com/api/v1/web/comments/${mediaId}/add/`, body, { headers: getHeaders() });
        res.json({ status: "success", data: response.data });
    } catch (error: any) {
        res.status(500).json({ status: "error", message: error.response?.data || error.message });
    }
});

app.post("/api/bot/like", async (req, res) => {
    const { media_id } = req.body;
    if (!media_id) return res.status(400).json({ error: "No media_id provided" });

    try {
        const hLike = getHeaders();
        const likeData = new URLSearchParams({
            "fb_dtsg": botSettings.fb_dtsg,
            "jazoest": botSettings.jazoest
        });
        const response = await axios.post(`https://www.instagram.com/api/v1/web/likes/${media_id}/like/`, likeData, { headers: hLike });
        res.json({ status: "success", data: response.data });
    } catch (error: any) {
        res.status(500).json({ status: "error", message: error.message });
    }
});

app.post("/api/bot/publish", upload.single("image"), async (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ error: "No image provided" });
    const { caption, type } = req.body; // type: 'feed' or 'story'
    
    try {
        const uploadId = Date.now().toString();
        
        // Use sharp to force 1:1 aspect ratio (1080x1080) with padding
        // This fixes the "Uploaded image isn't in an allowed aspect ratio" error
        const imgBuffer = await sharp(req.file.buffer)
            .resize(1080, 1080, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 1 } // Black background for padding
            })
            .jpeg({ quality: 90 })
            .toBuffer();
        
        const ruploadParams = {
            media_type: "1",
            upload_id: uploadId,
            upload_media_height: "1080",
            upload_media_width: "1080"
        };

        const upHeaders: any = {
            ...getHeaders(),
            "Offset": "0",
            "X-Entity-Type": "image/jpeg",
            "X-Entity-Name": `fb_uploader_${uploadId}`,
            "X-Entity-Length": imgBuffer.length.toString(),
            "Content-Type": "image/jpeg",
            "X-Instagram-Rupload-Params": JSON.stringify(ruploadParams)
        };

        // Step 1: Upload photo
        const uploadRes = await axios.post(`https://i.instagram.com/rupload_igphoto/fb_uploader_${uploadId}`, imgBuffer, { headers: upHeaders });
        
        if (uploadRes.status !== 200) {
           return res.status(400).json({ status: "error", message: "Upload failed", details: uploadRes.data });
        }

        // Step 2: Configure
        let endpoint = "https://i.instagram.com/api/v1/media/configure/";
        let payload: any = {
            "caption": caption || "",
            "upload_id": uploadId,
            "jazoest": "22895",
            "source_type": "library"
        };

        if (type === "story") {
            endpoint = "https://i.instagram.com/api/v1/media/configure_to_story/";
            payload = {
                "caption": "",
                "configure_mode": "1",
                "share_to_facebook": "",
                "share_to_fb_destination_id": "",
                "share_to_fb_destination_type": "USER",
                "upload_id": uploadId,
                "jazoest": "22895"
            };
        } else {
            payload = {
                "caption": caption || "",
                "clips_share_preview_to_feed": "1",
                "disable_comments": "0",
                "igtv_share_preview_to_feed": "1",
                "is_meta_only_post": "0",
                "is_unified_video": "1",
                "like_and_view_counts_disabled": "0",
                "media_share_flow": "creation_flow",
                "share_to_facebook": "",
                "share_to_fb_destination_id": "",
                "share_to_fb_destination_type": "USER",
                "source_type": "library",
                "upload_id": uploadId,
                "video_subtitles_enabled": "0",
                "jazoest": "22895"
            };
        }

        const configResponse = await axios.post(endpoint, new URLSearchParams(payload), { headers: getHeaders() });
        res.json({ status: "success", media: configResponse.data });
    } catch (error: any) {
        const errorData = error.response?.data;
        const errorMessage = typeof errorData === 'object' ? JSON.stringify(errorData) : errorData || error.message;
        console.error("Publish error:", errorMessage);
        res.status(500).json({ 
            status: "error", 
            message: errorMessage,
            details: errorData 
        });
    }
});


// Vite middleware
async function startServer() {
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
