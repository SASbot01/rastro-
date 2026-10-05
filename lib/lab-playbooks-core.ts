// Modulo puro (sin imports con alias) para poder probarlo con node --test.
/**
 * Guías por servicio: cuando el equipo encuentra un puerto/servicio, estas
 * plantillas dan los comandos de ENUMERACIÓN típicos (recon, no explotación),
 * ya con el host puesto. Es la "fase 2": conocimiento reutilizable que acelera
 * cada máquina. Solo enumeración; nada de disparar exploits.
 */
export interface PlaybookStep { label: string; cmd: string }
export interface Playbook { service: string; ports: number[]; names: RegExp; steps: (host: string, port: number) => PlaybookStep[] }

const H = (h: string) => (/^[a-z0-9.:_-]{1,255}$/i.test(h) ? h : "<host>");

export const PLAYBOOKS: Playbook[] = [
  { service: "http", ports: [80, 8080, 8000, 8008, 8888], names: /^(http|www|http-proxy|http-alt)$/i, steps: (h, p) => [
    { label: "Tecnología web", cmd: `whatweb -a3 http://${H(h)}:${p}` },
    { label: "Cabeceras", cmd: `curl -sSIL http://${H(h)}:${p}/` },
    { label: "Directorios y ficheros", cmd: `ffuf -w <dir>:FUZZ -u http://${H(h)}:${p}/FUZZ -e .php,.txt,.html,.bak -ic` },
    { label: "Vhosts", cmd: `ffuf -w <sub>:FUZZ -u http://${H(h)}:${p}/ -H "Host: FUZZ.<dominio>" -fs <tam>` },
    { label: "robots.txt / sitemap", cmd: `curl -sS http://${H(h)}:${p}/robots.txt; curl -sS http://${H(h)}:${p}/sitemap.xml` },
  ] },
  { service: "https", ports: [443, 8443], names: /^(https|ssl\/http|https-alt)$/i, steps: (h, p) => [
    { label: "Certificado (nombres/SAN)", cmd: `echo | openssl s_client -connect ${H(h)}:${p} 2>/dev/null | openssl x509 -noout -text | grep -A1 "Subject Alternative Name"` },
    { label: "Tecnología web", cmd: `whatweb -a3 https://${H(h)}:${p}` },
    { label: "Directorios", cmd: `ffuf -w <dir>:FUZZ -u https://${H(h)}:${p}/FUZZ -ic -k` },
  ] },
  { service: "ssh", ports: [22, 2222], names: /^ssh$/i, steps: (h, p) => [
    { label: "Versión y algoritmos", cmd: `nmap -p${p} --script ssh2-enum-algos,ssh-hostkey ${H(h)}` },
    { label: "Usuarios por defecto / notas", cmd: `# probar credenciales obtenidas en otras fases; nunca fuerza bruta en programas que lo prohíban` },
  ] },
  { service: "ftp", ports: [21], names: /^ftp$/i, steps: (h, p) => [
    { label: "Login anónimo", cmd: `curl -sS ftp://${H(h)}:${p}/ --user anonymous:anonymous` },
    { label: "Scripts de nmap", cmd: `nmap -p${p} --script ftp-anon,ftp-syst ${H(h)}` },
  ] },
  { service: "smb", ports: [139, 445], names: /^(microsoft-ds|netbios-ssn|smb)$/i, steps: (h) => [
    { label: "Recursos y sesión nula", cmd: `netexec smb ${H(h)} -u '' -p '' --shares` },
    { label: "Enumerar con enum4linux-ng", cmd: `enum4linux-ng -A ${H(h)}` },
    { label: "Listar recursos (smbclient)", cmd: `smbclient -L //${H(h)}/ -N` },
  ] },
  { service: "dns", ports: [53], names: /^(domain|dns)$/i, steps: (h) => [
    { label: "Transferencia de zona", cmd: `dig axfr @${H(h)} <dominio>` },
    { label: "Registros básicos", cmd: `dig any @${H(h)} <dominio>` },
  ] },
  { service: "ldap", ports: [389, 636, 3268], names: /^(ldap|ldapssl|globalcat)$/i, steps: (h, p) => [
    { label: "Base naming contexts", cmd: `ldapsearch -x -H ldap://${H(h)}:${p} -s base namingcontexts` },
    { label: "Volcado anónimo", cmd: `ldapsearch -x -H ldap://${H(h)}:${p} -b "<base-dn>"` },
  ] },
  { service: "mysql", ports: [3306], names: /^mysql$/i, steps: (h, p) => [
    { label: "Scripts de nmap", cmd: `nmap -p${p} --script mysql-info,mysql-empty-password ${H(h)}` },
  ] },
  { service: "mssql", ports: [1433], names: /^ms-sql-s$/i, steps: (h) => [
    { label: "Info / login", cmd: `netexec mssql ${H(h)} -u <user> -p <pass>` },
  ] },
  { service: "rdp", ports: [3389], names: /^(ms-wbt-server|rdp)$/i, steps: (h) => [
    { label: "Info de RDP", cmd: `nmap -p3389 --script rdp-ntlm-info ${H(h)}` },
  ] },
  { service: "smtp", ports: [25, 465, 587], names: /^(smtp|smtps)$/i, steps: (h, p) => [
    { label: "Usuarios (VRFY/EXPN)", cmd: `nmap -p${p} --script smtp-commands,smtp-enum-users ${H(h)}` },
  ] },
  { service: "snmp", ports: [161], names: /^snmp$/i, steps: (h) => [
    { label: "Community strings", cmd: `onesixtyone ${H(h)} public private; snmpwalk -v2c -c public ${H(h)}` },
  ] },
  { service: "redis", ports: [6379], names: /^redis$/i, steps: (h, p) => [
    { label: "Info sin auth", cmd: `redis-cli -h ${H(h)} -p ${p} info` },
  ] },
  { service: "nfs", ports: [2049], names: /^(nfs|rpcbind)$/i, steps: (h) => [
    { label: "Exports", cmd: `showmount -e ${H(h)}` },
  ] },
];

/** Guía que corresponde a un servicio (por nombre o puerto). Devuelve null si no hay. */
export function playbookFor(opts: { name?: string; port?: number }): Playbook | null {
  const name = (opts.name ?? "").trim();
  const port = opts.port ?? 0;
  return PLAYBOOKS.find((pb) => (name && pb.names.test(name)) || (port && pb.ports.includes(port))) ?? null;
}

/** Pasos de enumeración rellenados para un servicio concreto. */
export function playbookSteps(opts: { name?: string; port?: number; host: string }): PlaybookStep[] {
  const pb = playbookFor(opts);
  return pb ? pb.steps(opts.host, opts.port ?? pb.ports[0]) : [];
}

/** Para buscar CVEs: producto + versión a partir del banner/servicio ("Apache httpd 2.4.68" -> {product:"Apache httpd", version:"2.4.68"}). */
export function productFromVersion(version: string): { product: string; version: string | null } {
  const v = (version || "").trim();
  const m = v.match(/^(.*?)[\s/]*v?(\d+\.\d+(?:\.\d+)?(?:p\d+)?)/);
  if (m && m[1].trim()) return { product: m[1].trim().replace(/\s+(httpd|server|daemon)$/i, (x) => x), version: m[2] };
  return { product: v.slice(0, 60), version: null };
}
