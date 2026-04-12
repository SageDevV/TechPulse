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

    # Servidor com suporte a threads para não travar
    class ThreadingSimpleServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
        pass

    # Usa a porta 0 para pegar uma porta livre automaticamente
    server = ThreadingSimpleServer(("127.0.0.1", 0), http.server.SimpleHTTPRequestHandler)
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
