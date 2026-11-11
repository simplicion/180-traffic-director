#!/usr/bin/env python3
"""
Synchronises the nginx configuration that fronts the Traffic Director edge backend.

Every hostname and port comes strictly from environment variables:

  PUBLIC_EDGE_URL           backend/API origin (its host becomes the primary server_name)
  TRAFFIC_DIRECTOR_WEB_URL  portal origin (its apex is served by Cloudflare Pages, so it is excluded)
  DEFAULT_EDGE_DOMAIN       operational edge domain used for smart links & injection scripts
  AVAILABLE_EDGE_DOMAINS    extra edge domains offered in the domain switcher (comma separated)
  NGINX_EXTRA_SERVER_NAMES  any additional hostnames (comma separated, optional)
  TD_PORT / PORT            port the Traffic Director backend listens on
  NGINX_CONF_PATH           nginx.conf to patch (comma separated candidates, optional)
  NGINX_PROXY_CONTAINER     docker container running nginx, if any (optional)
"""
import os
import re
import subprocess
import sys
from urllib.parse import urlparse

BLOCK_MARKER = "# 180 Traffic Director Sovereign Edge Gateway & APIs"


def _split(raw):
    return [d.strip().lower() for d in (raw or '').split(',') if d.strip()]


def load_env_file():
    candidates = ['.env', '../.env', '/opt/traffic-director/.env']
    for cand in candidates:
        if os.path.exists(cand):
            try:
                with open(cand, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            k, v = line.split('=', 1)
                            k = k.strip()
                            v = v.strip().strip('"').strip("'")
                            if k and k not in os.environ:
                                os.environ[k] = v
                break
            except Exception:
                pass


def _host(value):
    value = (value or '').strip()
    if not value:
        return ''
    if '://' not in value:
        value = 'https://' + value
    return (urlparse(value).hostname or '').lower()


def resolve_server_names():
    load_env_file()
    names = []
    api_host = _host(os.environ.get('PUBLIC_EDGE_URL'))
    if api_host:
        names.append(api_host)

    portal_host = _host(os.environ.get('TRAFFIC_DIRECTOR_WEB_URL'))
    edge_domains = [os.environ.get('DEFAULT_EDGE_DOMAIN', '')] + _split(os.environ.get('AVAILABLE_EDGE_DOMAINS'))
    for raw in edge_domains:
        domain = _host(raw)
        # The portal apex lives on Cloudflare Pages; only dedicated edge domains are served here.
        if domain and domain != portal_host:
            names.extend([domain, '*.' + domain])

    names.extend(_split(os.environ.get('NGINX_EXTRA_SERVER_NAMES')))

    unique = []
    for n in names:
        if n and n not in unique:
            unique.append(n)
    return unique


def build_server_block(server_name_line):
    return (
        "\n    # -------------------------------------------------------------\n"
        f"    {BLOCK_MARKER}\n"
        "    # -------------------------------------------------------------\n"
        "    server {\n"
        "        listen 80;\n"
        "        listen [::]:80;\n"
        f"        {server_name_line}\n"
        "\n"
        "        client_max_body_size 50M;\n"
        "\n"
        "        location / {\n"
        "            proxy_pass http://traffic_director_upstream;\n"
        "            proxy_http_version 1.1;\n"
        "            proxy_set_header Upgrade $http_upgrade;\n"
        "            proxy_set_header Connection $connection_upgrade;\n"
        "            proxy_set_header Host $host;\n"
        "            proxy_set_header X-Real-IP $remote_addr;\n"
        "            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
        "            proxy_set_header X-Forwarded-Proto $forwarded_proto;\n"
        "            proxy_set_header X-Forwarded-Host $host;\n"
        "            proxy_read_timeout 300s;\n"
        "            proxy_connect_timeout 75s;\n"
        "        }\n"
        "    }\n"
    )


def sync_nginx_conf():
    server_names = resolve_server_names()
    if not server_names:
        print("[sync-nginx-td] No server names configured (set PUBLIC_EDGE_URL / DEFAULT_EDGE_DOMAIN). Aborting.")
        sys.exit(1)

    upstream_port = (os.environ.get('TD_PORT') or os.environ.get('PORT') or '').strip()
    if not upstream_port:
        print("[sync-nginx-td] TD_PORT (or PORT) is not set. Aborting.")
        sys.exit(1)

    server_name_line = "server_name " + " ".join(server_names) + ";"
    api_host = server_names[0]
    proxy_container = (os.environ.get('NGINX_PROXY_CONTAINER') or '').strip()

    candidates = _split(os.environ.get('NGINX_CONF_PATH')) or ['/home/ubuntu/app/nginx/nginx.conf', '/etc/nginx/nginx.conf', './nginx.conf']
    target_path = next((p for p in candidates if os.path.exists(p)), None)

    if target_path:
        print(f"[sync-nginx-td] Inspecting {target_path}...")
        try:
            with open(target_path, 'r', encoding='utf-8') as f:
                original = f.read()
            conf = original

            # 1. Ensure traffic_director_upstream exists
            if 'upstream traffic_director_upstream' not in conf:
                upstream_block = (
                    "\n    # 180 Traffic Director Dedicated Edge Backend Upstream\n"
                    "    upstream traffic_director_upstream {\n"
                    f"        server host.docker.internal:{upstream_port};\n"
                    f"        server 172.17.0.1:{upstream_port} backup;\n"
                    f"        server 127.0.0.1:{upstream_port} backup;\n"
                    "        keepalive 32;\n"
                    "    }\n"
                )
                target = "upstream core_backend_upstream {"
                if target in conf:
                    idx_end = conf.find("}", conf.find(target)) + 1
                    conf = conf[:idx_end] + upstream_block + conf[idx_end:]
                    print("[sync-nginx-td] Injected upstream traffic_director_upstream after core_backend_upstream.")
                else:
                    first_server = conf.find("server {")
                    if first_server != -1:
                        conf = conf[:first_server] + upstream_block + "\n" + conf[first_server:]
                    else:
                        conf = upstream_block + "\n" + conf
                    print("[sync-nginx-td] Injected upstream traffic_director_upstream.")

            # 2. Ensure the server block exists, and keep its server_name in sync with env
            existing = re.search(r"server_name\s+[^;]*(?<![\w.-])" + re.escape(api_host) + r"(?![\w.-])[^;]*;", conf)
            if existing:
                # Merge: keep every hostname already configured, append any new ones from env.
                current = existing.group(0)[len("server_name"):].rstrip(';').split()
                merged = current + [n for n in server_names if n not in current]
                if merged != current:
                    conf = conf[:existing.start()] + "server_name " + " ".join(merged) + ";" + conf[existing.end():]
                    print(f"[sync-nginx-td] Updated server_name -> {' '.join(merged)}")
            else:
                last_brace = conf.rfind("}")
                if last_brace != -1:
                    conf = conf[:last_brace] + build_server_block(server_name_line) + "\n" + conf[last_brace:]
                    print(f"[sync-nginx-td] Injected server block for {' '.join(server_names)}.")

            if conf != original:
                backup_path = target_path + '.bak'
                with open(backup_path, 'w', encoding='utf-8') as f:
                    f.write(original)
                with open(target_path, 'w', encoding='utf-8') as f:
                    f.write(conf)
                print(f"[sync-nginx-td] Successfully updated {target_path} (backup at {backup_path}).")
            else:
                print("[sync-nginx-td] Configuration already up to date.")
        except Exception as e:
            print(f"[sync-nginx-td] Warning while modifying {target_path}: {e}")

    # 3. Standalone /etc/nginx/conf.d/ config
    if os.path.exists('/etc/nginx/conf.d') and os.access('/etc/nginx/conf.d', os.W_OK):
        standalone_conf = '/etc/nginx/conf.d/traffic-director.conf'
        standalone_content = (
            "upstream traffic_director_standalone_upstream {\n"
            f"    server 127.0.0.1:{upstream_port};\n"
            "    keepalive 32;\n"
            "}\n\n"
            "server {\n"
            "    listen 80;\n"
            "    listen [::]:80;\n"
            f"    {server_name_line}\n\n"
            "    client_max_body_size 50M;\n\n"
            "    location / {\n"
            "        proxy_pass http://traffic_director_standalone_upstream;\n"
            "        proxy_http_version 1.1;\n"
            "        proxy_set_header Upgrade $http_upgrade;\n"
            "        proxy_set_header Connection 'upgrade';\n"
            "        proxy_set_header Host $host;\n"
            "        proxy_set_header X-Real-IP $remote_addr;\n"
            "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
            "        proxy_set_header X-Forwarded-Proto $scheme;\n"
            "        proxy_read_timeout 300s;\n"
            "        proxy_connect_timeout 75s;\n"
            "    }\n"
            "}\n"
        )
        try:
            with open(standalone_conf, 'w', encoding='utf-8') as f:
                f.write(standalone_content)
            print(f"[sync-nginx-td] Written standalone config to {standalone_conf}")
        except Exception as e:
            print(f"[sync-nginx-td] Standalone write skipped: {e}")

    # 4. Reload nginx
    print("[sync-nginx-td] Reloading Nginx...")
    if proxy_container:
        subprocess.run([
            "sh", "-c",
            f'docker exec "{proxy_container}" nginx -t && docker exec "{proxy_container}" nginx -s reload '
            f'|| docker restart "{proxy_container}" 2>/dev/null || true'
        ])
    subprocess.run("sudo nginx -t && sudo nginx -s reload 2>/dev/null || true", shell=True)
    print("[sync-nginx-td] Nginx reload dispatched.")


if __name__ == '__main__':
    sync_nginx_conf()
