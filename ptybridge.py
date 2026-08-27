#!/usr/bin/env python3
"""Ponte de terminal do Cockpit.

Abre um terminal de verdade (pty) para o comando pedido e liga esse terminal
na entrada e na saida deste processo. Assim o Cockpit roda coisas interativas
(login, escolher opcao, colar codigo) dentro do proprio app, sem precisar
abrir o Terminal do Mac.

uso: ptybridge.py <colunas> <linhas> <comando...>
fd 3 (se existir): canal de controle, aceita linhas "resize <colunas> <linhas>"
"""
import os
import sys
import select
import signal
import struct
import fcntl
import termios


def set_size(fd, cols, rows):
    try:
        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, 0, 0))
    except Exception:
        pass


def main():
    if len(sys.argv) < 4:
        sys.stderr.write('uso: ptybridge.py <colunas> <linhas> <comando...>\n')
        return 2
    cols = max(20, min(500, int(sys.argv[1])))
    rows = max(5, min(300, int(sys.argv[2])))
    cmd = sys.argv[3:]

    pid, master = os.forkpty()
    if pid == 0:
        os.environ['TERM'] = os.environ.get('TERM', 'xterm-256color')
        os.environ['COLUMNS'] = str(cols)
        os.environ['LINES'] = str(rows)
        try:
            os.execvp(cmd[0], cmd)
        except Exception as e:
            sys.stderr.write('nao consegui rodar: %s\n' % e)
            os._exit(127)

    set_size(master, cols, rows)

    # fd 3 = canal de controle, so existe se quem chamou criou
    ctrl = 3
    try:
        os.fstat(ctrl)
    except OSError:
        ctrl = None
    ctrl_buf = b''

    fontes = [master, 0] + ([ctrl] if ctrl is not None else [])
    vivo = True
    while vivo:
        try:
            prontos, _, _ = select.select(fontes, [], [], 0.2)
        except (InterruptedError, OSError):
            break

        for f in prontos:
            if f == master:
                try:
                    dados = os.read(master, 65536)
                except OSError:
                    dados = b''
                if not dados:
                    vivo = False
                    break
                os.write(1, dados)
            elif f == 0:
                try:
                    dados = os.read(0, 65536)
                except OSError:
                    dados = b''
                if not dados:
                    fontes = [x for x in fontes if x != 0]
                    continue
                try:
                    os.write(master, dados)
                except OSError:
                    vivo = False
                    break
            elif ctrl is not None and f == ctrl:
                try:
                    dados = os.read(ctrl, 4096)
                except OSError:
                    dados = b''
                if not dados:
                    fontes = [x for x in fontes if x != ctrl]
                    ctrl = None
                    continue
                ctrl_buf += dados
                while b'\n' in ctrl_buf:
                    linha, ctrl_buf = ctrl_buf.split(b'\n', 1)
                    partes = linha.decode('utf8', 'ignore').split()
                    if len(partes) == 3 and partes[0] == 'resize':
                        try:
                            set_size(master, int(partes[1]), int(partes[2]))
                            os.kill(pid, signal.SIGWINCH)
                        except Exception:
                            pass

        # o filho terminou?
        try:
            fim, status = os.waitpid(pid, os.WNOHANG)
        except ChildProcessError:
            break
        if fim == pid:
            # esvazia o que sobrou na tela antes de sair
            while True:
                try:
                    resto = os.read(master, 65536)
                except OSError:
                    break
                if not resto:
                    break
                os.write(1, resto)
            return os.waitstatus_to_exitcode(status) if hasattr(os, 'waitstatus_to_exitcode') else 0

    try:
        os.kill(pid, signal.SIGHUP)
    except Exception:
        pass
    try:
        _, status = os.waitpid(pid, 0)
        return os.waitstatus_to_exitcode(status) if hasattr(os, 'waitstatus_to_exitcode') else 0
    except Exception:
        return 0


if __name__ == '__main__':
    sys.exit(main())
