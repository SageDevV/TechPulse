import http.server
import socketserver
import webbrowser
import os
import threading
import sys
import time

def main():
    # Resolve o diretório do projeto dinamicamente (onde o script está)
    application_path = os.path.dirname(os.path.abspath(__file__))

    os.chdir(application_path)

    # Handler customizado que silencia ConnectionResetError
    # (ocorre quando o navegador cancela o download de arquivos grandes como hacker.mp3)
    class QuietHTTPHandler(http.server.SimpleHTTPRequestHandler):
        def handle_one_request(self):
            try:
                super().handle_one_request()
            except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
                pass  # Navegador cancelou a conexão — comportamento normal

        def log_message(self, format, *args):
            # Mantém os logs normais
            super().log_message(format, *args)

    # Servidor com suporte a threads para não travar
    class ThreadingSimpleServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
        # Silencia exceções de conexão resetada no nível do servidor também
        def handle_error(self, request, client_address):
            import sys
            error = sys.exc_info()[1]
            if isinstance(error, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)):
                pass  # Ignora silenciosamente — é o navegador cancelando download
            else:
                super().handle_error(request, client_address)

    # Usa a porta 0 para pegar uma porta livre automaticamente
    server = ThreadingSimpleServer(("127.0.0.1", 0), QuietHTTPHandler)
    port = server.server_address[1]

    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()

    url = f"http://127.0.0.1:{port}/"
    
    print("\n" + "="*60)
    print(" SERVIDOR INICIADO COM SUCESSO! ")
    print("="*60)
    print(f" O aplicativo esta rodando em: {url}")
    print(" Abrindo no seu navegador padrao...")
    print("="*60)
    print(" ATENCAO: MANTENHA ESTA JANELA ABERTA! ")
    print(" Se voce fechar esta tela preta, o aplicativo")
    print(" parara de funcionar no seu navegador.")
    print(" Para encerrar o sistema, basta fechar esta janela.")
    print("="*60 + "\n")

    # Espera um pouco para garantir que o servidor subiu
    time.sleep(0.5)
    webbrowser.open(url)

    # Mantém a janela do terminal aberta
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        print("\nEncerrando o servidor...")
        server.shutdown()
        sys.exit(0)

if __name__ == "__main__":
    main()
