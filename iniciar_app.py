import http.server
import socketserver
import webbrowser
import os
import threading
import sys
import time
import pystray
import traceback
from PIL import Image

def resource_path(relative_path):
    """ Obtém o caminho absoluto para o recurso, funcionando para dev e PyInstaller """
    try:
        # O PyInstaller cria uma pasta temporária e armazena o caminho em _MEIPASS
        if hasattr(sys, '_MEIPASS'):
            return os.path.join(sys._MEIPASS, relative_path)
    except Exception:
        pass
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

def log_error(msg):
    try:
        with open("techpulse_error.log", "a", encoding="utf-8") as f:
            f.write(f"[{time.ctime()}] {msg}\n")
    except:
        pass

def main():
    try:
        # Resolve o diretório onde os arquivos estão localizados
        application_path = resource_path(".")
        
        # Handler customizado que apenas silencia logs de requisição para o terminal
        # Mas permite que o diretório seja passado corretamente
        class RobustHTTPHandler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=application_path, **kwargs)
            
            def log_message(self, format, *args):
                # Silencia mensagens de log normais para não poluir
                pass

        # Servidor com suporte a threads para não travar
        class ThreadingSimpleServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
            daemon_threads = True
            def handle_error(self, request, client_address):
                error = traceback.format_exc()
                log_error(f"Erro no servidor (Handler): {error}")
                super().handle_error(request, client_address)

        # Usa a porta 0 para pegar uma porta livre automaticamente
        # Binda apenas ao localhost por segurança e compatibilidade
        server = ThreadingSimpleServer(("127.0.0.1", 0), RobustHTTPHandler)
        port = server.server_address[1]

        server_thread = threading.Thread(target=server.serve_forever)
        server_thread.daemon = True
        server_thread.start()

        url = f"http://127.0.0.1:{port}/"
        
        print("\n" + "="*60)
        print(" TECHPULSE — SERVIDOR INICIADO ")
        print("="*60)
        print(f" URL: {url}")
        print(" Rodando em segundo plano (Bandeja)")
        print("="*60 + "\n")

        # Espera um pouco para garantir que o servidor subiu (delay aumentado)
        time.sleep(1.5)
        webbrowser.open(url)

        # Configuração do Ícone da Bandeja (Tray Icon)
        def on_quit(icon, item):
            icon.stop()
            server.shutdown()
            os._exit(0)

        try:
            icon_path = resource_path("app_icon.ico")
            image = Image.open(icon_path)
            icon = pystray.Icon(
                "TechPulse",
                image,
                "TechPulse Server",
                menu=pystray.Menu(
                    pystray.MenuItem("TechPulse está rodando", lambda: None, enabled=False),
                    pystray.MenuItem("Abrir no Navegador", lambda: webbrowser.open(url)),
                    pystray.Menu.Separator(),
                    pystray.MenuItem("Sair", on_quit)
                )
            )
            icon.run()
        except Exception as e:
            error = traceback.format_exc()
            log_error(f"Erro no Tray Icon: {error}")
            # Fallback para o loop original se o tray falhar
            while True:
                time.sleep(3600)

    except Exception as e:
        error = traceback.format_exc()
        log_error(f"Erro Crítico no Main: {error}")
        print(f"Erro Crítico: {e}")
        time.sleep(10) # Dá tempo de ler se houver console
        sys.exit(1)

if __name__ == "__main__":
    main()
