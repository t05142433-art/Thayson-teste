import requests
import time
import random
import os
import json
import re
import uuid
import io
from PIL import Image
from urllib.parse import quote

# =================================================================
# 🔥 BOT INSTAGRAM SESSION SUPREMO - VERSÃO TURBO HYPER FAST V28 🔥
# INTEGRADO: FEED (FULL LOG PAYLOAD) + STORY + COMENTÁRIO INSTANTÂNEO
# PERFORMANCE: STATUS 200 GARANTIDO VIA GRAPHQL + ASBD-ID ATUALIZADO
# =================================================================

class InstaBotFull:
    def __init__(self):
        self.api_url = "https://i.instagram.com/api/v1/"
        self.graphql_url = "https://www.instagram.com/graphql/query"
        self.user_id = "80209457261"
        
        # --- CAMPOS EXTRAÍDOS EXATAMENTE DOS SEUS LOGS ---
        self.user_agent = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36"
        self.lsd_token = "5vO96BLhgv3VQMlbaWzQ6Y"
        self.fb_dtsg = "NAfuZknNCOtoS_tp7aDPLDpd6e-4hWIEElFI2CQO_FVzLSkKEmeNa4Q:17864789131057511:1776026917"
        self.jazoest = "26197"
        self.csrf_token = "ZidFKP6f5np9bvAog8PeIZafgtEyPnPr"
        self.doc_id = "26232567166401842" # Comentário mutation
        self.bloks_id = "f0fd53409d7667526e529854656fe20159af8b76db89f40c333e593b51a2ce10"
        self.ajax_rev = "1037177439"
        
        # Cookie string consolidada do seu log mais recente
        self.cookie_string = (
            "datr=vozQaZ9FTfSuYSDOh8c3S56v; "
            "ig_did=0A7CD33E-D3EC-401D-9761-77259A2493C3; "
            "ps_l=1; ps_n=1; dpr=2.206249952316284; "
            "mid=adFo6AABAAG5tAitm_wsuvQy4hMH; "
            "csrftoken=ZidFKP6f5np9bvAog8PeIZafgtEyPnPr; "
            "ds_user_id=80209457261; "
            "sessionid=80209457261%3AbEhuNzGpKh9z7U%3A3%3AAYjVCkClTzHeHKxawHPrwRhxwix2y6KT0DDE4R_H4w; "
            "wd=489x920; "
            'rur="FRC\\05480209457261\\0541807574517:01fe16de064e646c87ed3c71ce16b5f36aa93ec774689e34be3b9568e4d42cb6ccff6fd2"'
        )

        self.session = requests.Session()
        self.headers = {
            "User-Agent": self.user_agent,
            "Accept": "*/*",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "X-IG-App-ID": "1217981644879628",
            "X-FB-LSD": self.lsd_token,
            "X-ASBD-ID": "359341",
            "X-CSRFToken": self.csrf_token,
            "X-Bloks-Version-Id": self.bloks_id,
            "X-Instagram-AJAX": self.ajax_rev,
            "X-Web-Session-Id": f"eslgsg:hl3nz7:{random.randint(100,999)}hez",
            "X-IG-WWW-Claim": "hmac.AR01hT2S57wLh1S828fQvcHS_h6_QE1faXaPQySmf8R8kuJC",
            "X-Requested-With": "XMLHttpRequest",
            "Cookie": self.cookie_string,
            "Origin": "https://www.instagram.com",
            "Referer": "https://www.instagram.com/",
            "Content-Type": "application/x-www-form-urlencoded"
        }

    def login_check(self):
        print("🌀 Validando sessão real via Logs Atuais...")
        try:
            res = self.session.get("https://www.instagram.com/accounts/edit/?__a=1", headers=self.headers, timeout=10)
            if "form_data" in res.text or res.status_code == 200:
                print(f"✅ SESSÃO ATIVA! (ID: {self.user_id})")
                return True
            return False
        except: return False

    def get_id_real(self, url):
        try:
            if "/p/" in url or "/reel/" in url or "/reels/" in url:
                shortcode = re.search(r'/(?:p|reel|reels|tv)/([A-Za-z0-9_-]+)', url).group(1)
                alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
                id_num = 0
                for char in shortcode:
                    id_num = (id_num * 64) + alphabet.find(char)
                return str(id_num)
            return url 
        except: return None

    def comentar_normal(self, media_id, texto):
        """Posta comentário normal sem fixar conforme seu log de mutação"""
        media_id = str(media_id).split('_')[0]
        print(f"💬 Comentando no post {media_id}...")
        
        variables = {
            "connections": [f"client:root:__PolarisPostComments__xdt_api__v1__media__media_id__comments__connection_connection(data:{{}},media_id:\"{media_id}\",sort_order:\"recent\")"],
            "request_data": {"comment_text": texto},
            "media_id": media_id,
            "tracking_token": None
        }
        
        data = {
            "av": "17841480197836182", "__d": "www", "__user": "0", "__a": "1", "__req": "29",
            "fb_dtsg": self.fb_dtsg, "jazoest": self.jazoest, "lsd": self.lsd_token,
            "variables": json.dumps(variables), "doc_id": self.doc_id
        }
        
        h_comment = self.headers.copy()
        h_comment["X-FB-Friendly-Name"] = "PolarisPostCommentInputRevampedMutation"
        
        try:
            res = self.session.post(self.graphql_url, data=data, headers=h_comment)
            if "xdt_web__comments" in res.text:
                print("✅ Comentário enviado com sucesso!")
            else:
                print(f"❌ Erro ao comentar: {res.text[:100]}")
        except: pass

    def disparar_comentarios_link(self, link, texto, quantidade, delay):
        """Lógica instantânea (Opção 4) baseada no seu log GraphQL"""
        media_id = self.get_id_real(link)
        if not media_id: return
        print(f"🚀 MODO HYPER FAST: {quantidade} comentários no ID {media_id}")
        for i in range(quantidade):
            try:
                variables = {
                    "connections": [f"client:root:__PolarisPostComments__xdt_api__v1__media__media_id__comments__connection_connection(data:{{}},media_id:\"{media_id}\",sort_order:\"recent\")"],
                    "request_data": {"comment_text": f"{texto} {random.randint(10,99)}"},
                    "media_id": media_id,
                    "tracking_token": None
                }
                data = {
                    "av": "17841480197836182", "__d": "www", "__user": "0", "__a": "1", "__req": "29",
                    "fb_dtsg": self.fb_dtsg, "jazoest": self.jazoest, "lsd": self.lsd_token,
                    "variables": json.dumps(variables), "doc_id": self.doc_id
                }
                h_comment = self.headers.copy()
                h_comment["X-FB-Friendly-Name"] = "PolarisPostCommentInputRevampedMutation"
                res = self.session.post(self.graphql_url, data=data, headers=h_comment)
                if "xdt_web__comments" in res.text:
                    print(f"⚡ [{i+1}] Comentado!")
                if delay > 0: time.sleep(delay)
            except: continue

    def postar_story(self, caminho_arquivo):
        if not os.path.exists(caminho_arquivo): return
        print("🔧 Processando Story...")
        try:
            img = Image.open(caminho_arquivo)
            if img.mode != 'RGB': img = img.convert('RGB')
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='JPEG', quality=95)
            img_data = img_byte_arr.getvalue()
        except: return

        upload_id = str(int(time.time() * 1000))
        up_params = {"media_type": 1, "upload_id": upload_id, "upload_media_height": img.height, "upload_media_width": img.width}
        
        up_headers = self.headers.copy()
        up_headers.update({
            "offset": "0", "x-entity-type": "image/jpeg", "x-entity-name": f"fb_uploader_{upload_id}",
            "x-entity-length": str(len(img_data)), "Content-Type": "image/jpeg",
            "X-Instagram-Rupload-Params": json.dumps(up_params)
        })
        
        self.session.post(f"https://i.instagram.com/rupload_igphoto/fb_uploader_{upload_id}", data=img_data, headers=up_headers)
        
        conf_payload = {
            "caption": "", "configure_mode": "1", "share_to_facebook": "",
            "share_to_fb_destination_id": "", "share_to_fb_destination_type": "USER",
            "upload_id": upload_id, "jazoest": "22895"
        }
        res_fin = self.session.post(f"{self.api_url}media/configure_to_story/", data=conf_payload, headers=self.headers)
        if res_fin.status_code == 200: print(f"✅ Story publicado!")

    def postar_foto(self, caminho_arquivo):
        if not os.path.exists(caminho_arquivo): return None
        
        legenda = "Post Real"
        comentario_manual = ""
        if os.path.exists("legenda.json"):
            with open("legenda.json", "r", encoding="utf-8") as f:
                js = json.load(f)
                legenda = js.get("legenda", legenda)
                comentario_manual = js.get("comentario", "")

        print("🔧 Processando imagem do Feed...")
        try:
            img = Image.open(caminho_arquivo)
            if img.mode != 'RGB': img = img.convert('RGB')
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='JPEG', quality=95)
            img_data = img_byte_arr.getvalue()
        except: return None

        upload_id = str(int(time.time() * 1000))
        up_params = {"media_type": 1, "upload_id": upload_id, "upload_media_height": img.height, "upload_media_width": img.width}
        
        up_headers = self.headers.copy()
        up_headers.update({
            "offset": "0", "x-entity-type": "image/jpeg", "x-entity-name": f"fb_uploader_{upload_id}",
            "x-entity-length": str(len(img_data)), "Content-Type": "image/jpeg",
            "X-Instagram-Rupload-Params": json.dumps(up_params)
        })

        self.session.post(f"https://i.instagram.com/rupload_igphoto/fb_uploader_{upload_id}", data=img_data, headers=up_headers)

        print("💎 Configurando Feed (Payload Completo do Log)...")
        conf_data = {
            "caption": legenda,
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
            "upload_id": upload_id,
            "video_subtitles_enabled": "0",
            "jazoest": "22895"
        }
        res_fin = self.session.post(f"{self.api_url}media/configure/", data=conf_data, headers=self.headers)
        
        if res_fin.status_code == 200:
            media_id = res_fin.json()['media']['id']
            print(f"✅ Feed Postado! (ID: {media_id})")
            if comentario_manual:
                time.sleep(2)
                self.comentar_normal(media_id, comentario_manual)
            return media_id
        return None

    def auto_responder(self, texto):
        print("📩 Lendo Directs...")
        processed_messages = set()
        while True:
            try:
                res = self.session.get(f"{self.api_url}direct_v2/inbox/", headers=self.headers)
                threads = res.json().get('inbox', {}).get('threads', [])
                for t in threads:
                    items = t.get('items', [])
                    if not items: continue
                    msg_id = items[0]['item_id']
                    if str(items[0]['user_id']) != self.user_id and msg_id not in processed_messages:
                        send_data = {'action': 'send_item', 'text': texto, 'client_context': str(uuid.uuid4()), 'device_id': "0A7CD33E-D3EC-401D-9761-77259A2493C3", 'mutation_token': str(uuid.uuid4())}
                        self.session.post(f"{self.api_url}direct_v2/threads/{t['thread_id']}/broadcast/text/", data=send_data, headers=self.headers)
                        print("✅ Resposta Direct Enviada!")
                        processed_messages.add(msg_id)
                time.sleep(5)
            except: time.sleep(5)

# --- MENU DE EXECUÇÃO ---
bot = InstaBotFull()

if bot.login_check():
    while True:
        os.system("clear" if os.name == "posix" else "cls")
        print("==========================================")
        print("    BOT SUPREMO V28 - FEED & TURBO")
        print("     SESSÃO: " + bot.user_id)
        print("==========================================")
        print("1 - Auto-Responder Directs")
        print("2 - Publicar Feed 'principal.jpg' (Delay 3s)")
        print("3 - Publicar Story 'principal.jpg'")
        print("4 - 🔥 COMENTAR POR LINK (MAX SPEED - INSTANT) 🔥")
        print("5 - Extrair ID de Post/Link")
        print("0 - Sair")
        
        op = input("\nEscolha: ")
        
        if op == "1":
            msg = input("Mensagem de resposta: "); bot.auto_responder(msg)
            
        elif op == "2":
            legenda_txt = input("Digite a LEGENDA: ")
            coment_txt = input("Digite o COMENTÁRIO: ")
            with open("legenda.json", "w", encoding="utf-8") as f:
                json.dump({"legenda": legenda_txt, "comentario": coment_txt}, f)
            try:
                qtd = int(input("Quantidade: "))
                for i in range(qtd):
                    print(f"\n📦 Post Feed {i+1} de {qtd}...")
                    bot.postar_foto("principal.jpg")
                    if i < qtd - 1:
                        print(f"⏱️ Aguardando 3 segundos fixos..."); time.sleep(3)
            except Exception as e: print(f"Erro: {e}")
            input("\nFim do ciclo. Enter...")

        elif op == "3":
            try:
                qtd = int(input("Quantos Stories? "))
                for i in range(qtd):
                    bot.postar_story("principal.jpg")
                    time.sleep(2)
            except: pass
            input("\nFim. Enter...")

        elif op == "4":
            link = input("🔗 Link do Post: ")
            msg = input("✍️ Mensagem: ")
            qty = int(input("🔢 Quantidade: "))
            bot.disparar_comentarios_link(link, msg, qty, 0) # Instantâneo
            input("\nFim. Enter...")

        elif op == "5":
            link = input("Link: "); print(f"✅ ID Real: {bot.get_id_real(link)}"); input("\nEnter...")

        elif op == "0": break
